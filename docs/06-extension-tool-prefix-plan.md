# План: вынос префикса имени инструмента в `.env` (dev-версия `searxng-tools`)

## Контекст

**Проблема.** В каталоге `F:\prj\pi-experiments\searxng\.pi\extensions\searxng-tools-dev\`
лежит **dev-проект** расширения `searxng-tools` (полная копия действующего).
Когда пользователь запускает `pi` из каталога `F:\prj\pi-experiments\searxng\`,
pi автодискаверит оба расширения — действующее (`~/.pi/agent/extensions/searxng-tools/`)
и dev-версию. Оба регистрируют инструмент с **одинаковым именем** `searxng_search`
(и `web_fetch`), что приводит к конфликту при загрузке.

**Цель.** Дать dev-версии уникальные имена инструментов, чтобы не было
конфликта с действующим расширением. Решение должно быть:

- **обратимым** — можно переключить dev на «без префикса» одной строкой;
- **в `.env`** — там же, где лежат `SEARXNG_URL` и `SAVE_RAW_DATA`;
- **с префиксом по умолчанию** `_dev_` (т.е. инструменты станут
  `_dev_searxng_search`, `_dev_web_fetch`).

## Что меняем

### 1. `.env` (dev-проект)

Файл: `F:\prj\pi-experiments\searxng\.pi\extensions\searxng-tools-dev\.env`

Добавить строку:

```bash
# Tool name prefix (empty = no prefix, "_dev_" = use dev names)
# Example: with "_dev_", searxng_search becomes "_dev_searxng_search"
SEARXNG_TOOL_PREFIX=_dev_
```

### 2. `.env.example` (dev-проект)

Файл: `F:\prj\pi-experiments\searxng\.pi\extensions\searxng-tools-dev\.env.example`

То же, что в `.env`, без фактического значения:

```bash
# Tool name prefix (empty = no prefix, "_dev_" = use dev names)
SEARXNG_TOOL_PREFIX=
```

### 3. `index.ts` (dev-проект)

Файл: `F:\prj\pi-experiments\searxng\.pi\extensions\searxng-tools-dev\index.ts`

**3.1.** Добавить функцию-резолвер (рядом с `isSaveRawData()`,
строки 70-80):

```typescript
/**
 * Tool name prefix. Default "_dev_" (set in .env) — применяется ко всем
 * именам инструментов этого расширения. Пустое значение (или отсутствие
 * в .env) — префикс не добавляется, имена совпадают с продом.
 *
 * Пример: SEARXNG_TOOL_PREFIX="_dev_" → "searxng_search" становится
 *   "_dev_searxng_search". Это позволяет запускать dev-версию рядом с
 *   действующей без конфликта по именам инструментов.
 */
function getToolPrefix(): string {
  return process.env.SEARXNG_TOOL_PREFIX ?? readEnvFile().SEARXNG_TOOL_PREFIX ?? "_dev_";
}
```

**3.2.** Применить ко всем трём `registerTool` (строки 290, 352, 408):

- `name: "searxng_search"` → `name: \`${getToolPrefix()}searxng_search\``
- `name: "searxng_fetch"` → `name: \`${getToolPrefix()}searxng_fetch\``
- `name: "web_fetch"` → `name: \`${getToolPrefix()}web_fetch\``

**3.3.** Обновить JSDoc у каждого инструмента — упомянуть, что имя
содержит префикс.

## Что НЕ меняем

- **Действующее расширение** в `C:\Users\dima\.pi\agent\extensions\searxng-tools\`
  — **НЕ ТРОГАЕМ**. Префикс нужен только в dev-версии, чтобы прод
  сохранил «чистые» имена `searxng_search` / `web_fetch`.
- **`name` в `package.json`** обоих проектов — `searxng-tools`. Это
  **публичное имя npm-пакета**, к именам инструментов отношения не имеет.
  pi его не использует (берёт имя из `registerTool({name})`).

## Проверка после правки

1. Открыть pi из каталога `F:\prj\pi-experiments\searxng\`.
2. В списке инструментов должны быть:
   - **`searxng_search`** и **`web_fetch`** — от действующего расширения.
   - **`_dev_searxng_search`** и **`_dev_web_fetch`** — от dev.
3. Запустить тестовый поиск через `_dev_searxng_search` — должен работать.
4. Запустить через продовый `searxng_search` — должен работать как раньше.
5. Конфликта быть не должно.

## Альтернативы (рассмотрены, не выбраны)

- **Хардкод префикса в `index.ts`** — работает, но менее гибко (нужно
  править код, чтобы отключить).
- **Префикс через CLI-флаг pi** — не предусмотрено API.
- **Полностью уникальные имена без префикса** (`dev_searxng_search` и т.п.) —
  работает, но при переименовании надо править код. Префикс универсальнее.
- **Отключение прод-расширения на время разработки** — неудобно, не
  гарантирует «как в проде».

## Связанные документы

- `docs/02-searxng-search-prompt-proposal.md` — предложение по правкам
  действующего расширения (план, не реализовано).
- `docs/04-searxng-search-categories-proposal.md` — то же (для dev —
  та же задача).
- `docs/05-editing-ub2026-mini-config.md` — про конфиг серверного
  SearXNG, не про расширение.
