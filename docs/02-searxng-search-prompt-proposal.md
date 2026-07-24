# Предложение: улучшить документацию инструмента `searxng_search` в расширении `searxng-tools`

## Контекст

Расширение `.pi/extensions/searxng-tools-dev/index.ts` регистрирует в pi инструмент `_dev_searxng_search`. Сравнение с соседним инструментом `_dev_web_fetch` показало несогласованность в том, как скилл сообщает модели о поведении «сохранить сырой JSON в `.pi/fetch-raw/`».

## Текущее состояние

### `_dev_web_fetch` (образец, как сделано хорошо)

- Объявлен `promptSnippet`, который явно говорит модели:
  - внутри `<IT_IS_NOT_FETCH_DATA>` — метаданные, а не контент статьи;
  - это **supplementary information for the LLM**;
  - если понадобится сырой HTML/Markdown — путь к файлу берётся из `savedPaths`.
- Возвращает `details` с `savedPaths: { htmlPath, mdPath }`.
- `description` тоже подсказывает про сохранение.

### `_dev_searxng_search` (как сейчас, плохо)

1. **`promptSnippet` отсутствует.** У инструмента нет короткой инструкции, которую модель увидит перед вызовом.
2. **`description` короткий и неполный.** Содержит только: «Search … AND save results to .pi/fetch-raw/. Do NOT read saved files without special permission.» — не объясняет, что именно лежит в файле (сырой JSON от SearXNG), какие у него поля, и когда туда лезть.
3. **`details` не возвращается.** В JSDoc-комментарии (строка 284) обещано:
   ```
   details — resultsCount: количество найденных результатов, savedPaths: { jsonPath }
   ```
   Но в `execute(...)` возвращается только `{ content: [{ type: "text", text }] }` — без `details`. Модель узнаёт о сохранении только из строки в тексте ответа:
   ```
   [Results saved to .pi/fetch-raw/search_<запрос>_<хэш>_<дата>.json]
   ```
   Это **часть пользовательского ответа**, а не структурированная мета-информация.
4. **Несогласованность JSDoc и кода.** Если в JSDoc указано `details: { resultsCount, savedPaths }`, а код его не возвращает — это либо баг, либо забытая правка.

## Почему это важно

- Модель не знает, что файл содержит **сырой** JSON со всеми полями SearXNG (`results`, `unresponsive_engines`, `answers`, `corrections`, `infoboxes`, `suggestions`). Может неверно интерпретировать, что туда стоит лезть за «доп. деталями».
- Нет явного «не читай без разрешения» в структурированной форме — только в свободном тексте ответа, который модель может проигнорировать как шум.
- `details.savedPaths` — стандартное место для путей к сохранённым файлам (как у `web_fetch`). Его отсутствие у `searxng_search` ломает единообразие между инструментами.

## Предложение

Привести `searxng_search` к тому же уровню явности, что у `web_fetch`.

### 1. Добавить `promptSnippet`

По аналогии с `web_fetch`, в `registerTool` добавить поле:

```ts
promptSnippet: "Results are saved to .pi/fetch-raw/search_<query>_<hash>_<date>.json. " +
  "This is the RAW JSON response from SearXNG API (results[], unresponsive_engines, answers, " +
  "corrections, infoboxes, suggestions). Do NOT read this file without explicit permission — " +
  "the formatted list in content is the canonical result.",
```

### 2. Возвращать `details`

В `execute(...)` после `formatResults` собрать и вернуть:

```ts
const details: {
  resultsCount: number;
  query: string;
  savedPaths?: { jsonPath: string };
} = {
  resultsCount: data.results?.length ?? 0,
  query: params.query,
};
if (jsonPath) {
  details.savedPaths = { jsonPath };
}
return { content: [{ type: "text", text }], details };
```

### 3. Обновить `description`, чтобы он соответствовал поведению

```ts
description: isSaveRawData()
  ? "Search the web using SearXNG metasearch engine. Returns formatted top results; raw JSON is saved to .pi/fetch-raw/. Do NOT read saved files without special permission."
  : "Search the web using SearXNG metasearch engine.",
```

### 4. Поправить JSDoc

Привести JSDoc-комментарий к фактическому поведению — `details` теперь действительно отдаётся, `savedPaths` появляется только при `SAVE_RAW_DATA=true`.

## Где патчить

`.pi/extensions/searxng-tools-dev/index.ts` — строки ~289–322 (определение инструмента `_dev_searxng_search`).

## Чего это предложение НЕ меняет

- Логику сохранения файлов (`saveSearchResults`) — она работает, файл создаётся, проверено.
- URL формирование запроса — это отдельная тема (см. `04-searxng-search-categories-proposal.md`).
- Движки, форматы, конфиг SearXNG — не в зоне расширения.

## Статус

- **Не применено.** Это предложение, а не правка. Ждёт решения пользователя.
- После одобрения — могу подготовить готовый diff (патч строк) в этом же документе или в отдельном `docs/03-patch-searxng-search.md`.
