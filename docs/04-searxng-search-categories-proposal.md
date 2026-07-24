# План доработок: _dev_searxng_search — добавить `categories` и `pageno`

## Контекст

Файл: `.pi/extensions/searxng-tools-dev/index.ts` — целевой для правок в этом плане.

Сейчас `_dev_searxng_search` (строки 282-303) объявляет параметры:
- `query` (обязательный)
- `language` (опциональный)
- `safesearch` (опциональный)
- `time_range` (опциональный, enum: day/month/year)

И шлёт в SearXNG: `q`, `format=json`, `language?`, `safesearch?`, `time_range?`.

**Не используются** параметры SearXNG API:
- `categories` — категория поиска (general/images/videos/...)
- `pageno` — номер страницы (default 1)

## Доступные категории SearXNG

Из исходников (`searx/settings_defaults.py`, `CATEGORIES_AS_TABS`):

| Код | Что ищет | Типичные движки |
|---|---|---|
| `general` | Обычный веб-поиск (по умолчанию) | google cse, bing, duckduckgo, fynd, privacywall, gmx, wikibooks/source/species/university, dogpile, ... |
| `images` | Картинки | duckduckgo images, startpage images, bing images, flickr, google cse images, openverse, artic, pinterest, wikicommons.images, ... |
| `videos` | Видео | duckduckgo videos, youtube, bing videos, dailymotion, wikicommons.videos, sepiasearch, ... |
| `news` | Новости | duckduckgo news, bing news, reuters, ... |
| `map` | Карты | openstreetmap, ... |
| `music` | Музыка | youtube, bandcamp, deezer, ... |
| `it` | IT-ресурсы | github, stackoverflow, ... |
| `science` | Наука | arxiv, pubmed, ... |
| `files` | Файлы (PDF, DOCX) | ... |
| `social media` | Соцсети | reddit, ... |

Сервер `ub2026-mini` и наш `localhost:9098` — стандартный `searxng/searxng:latest`, поддерживает все 10.

## Предлагаемые изменения

### Изменение 1: добавить `categories` (опциональный, enum)

В `parameters: Type.Object({...})` — добавить:
```typescript
categories: Type.Optional(StringEnum(
  ["general", "images", "videos", "news", "map", "music", "it", "science", "files", "social media"] as const,
  { description: "Search category. Default: general. Examples: 'images' for pictures, 'videos' for video content." }
)),
```

В теле `execute`:
```typescript
if (params.categories) url.searchParams.set("categories", params.categories);
```

### Изменение 2: добавить `pageno` (опциональный, number)

В `parameters`:
```typescript
pageno: Type.Optional(Type.Number({ description: "Page number (default: 1). Useful for paginated results." })),
```

В теле:
```typescript
if (params.pageno) url.searchParams.set("pageno", String(params.pageno));
```

### Изменение 3: обновить JSDoc

В JSDoc-блоке инструмента (строки 240-262) добавить описание двух новых параметров.

### Изменение 4: контекстная подсказка в `description`

Текущее `description`:
```
"Search the web using SearXNG metasearch engine, AND save results to .pi/fetch-raw/..."
```

Предлагаю добавить в `description` явное упоминание категорий, чтобы LLM понимала, что можно искать по изображениям/видео/новостям. Например:
```
"Search the web using SearXNG metasearch engine. Optionally restrict to a category (general, images, videos, news, map, music, it, science, files, social media) and page. AND save results to .pi/fetch-raw/..."
```

## Контекстная подстановка `categories`

По требованию: «categories должны подставляться исходя из контекста — что нужно пользователю». Это **решается на стороне LLM**, а не в скилле. Скилл лишь **даёт** параметр, а LLM **выбирает** значение по контексту:

| Пользователь говорит | LLM должна вызвать `_dev_searxng_search` с |
|---|---|
| «найди статьи про X» / «что такое X» / «X документация» | `categories: undefined` (= general) |
| «найди картинки X» / «фото X» / «изображения X» | `categories: "images"` |
| «найди видео X» / «видео про X» / «ролики про X» | `categories: "videos"` |
| «новости про X» / «что нового в X» | `categories: "news"` |
| «карта X» / «где находится X» | `categories: "map"` |
| «код X» / «stackoverflow X» / «github X» | `categories: "it"` |
| «исследования про X» / «научные статьи про X» | `categories: "science"` |
| «музыка X» / «песни X» | `categories: "music"` |

**Условие:** LLM должна видеть, что в `description` перечислены категории, и иметь `promptSnippet` (как у `_dev_web_fetch`) с явным напоминанием, когда что использовать. Сейчас у `_dev_searxng_search` **нет** `promptSnippet` (есть только у `_dev_web_fetch`). Этот пробел стоит закрыть — добавить `promptSnippet`.

### Изменение 5: добавить `promptSnippet` (по аналогии с `_dev_web_fetch`)

```typescript
promptSnippet: "When the user wants a specific type of content, pass the appropriate categories parameter: 'images' for pictures, 'videos' for video, 'news' for current events, 'map' for locations, 'it' for code/GitHub/StackOverflow, 'science' for research papers, 'music' for songs. Default (no parameter) is general web search. Use pageno to fetch additional pages of results."
```

## Изменение 6: возвращать `details` (как у `_dev_web_fetch`)

Сейчас `_dev_searxng_search` не возвращает `details` (хотя JSDoc обещает `resultsCount` и `savedPaths.jsonPath`). По аналогии с `_dev_web_fetch` — добавить:

```typescript
return {
  content: [{ type: "text", text }],
  details: {
    resultsCount: data.results?.length ?? 0,
    savedPaths: jsonPath ? { jsonPath } : undefined,
  },
};
```

## Изменение 7: `description` — обновить

Заменить:
```typescript
description: isSaveRawData()
  ? "Search the web using SearXNG metasearch engine, AND save results to .pi/fetch-raw/. Do NOT read saved files without special permission."
  : "Search the web using SearXNG metasearch engine.",
```

на:
```typescript
description: isSaveRawData()
  ? "Search the web using SearXNG metasearch engine. Supports categories (general, images, videos, news, map, music, it, science, files, social media) and pageno. AND save results to .pi/fetch-raw/. Do NOT read saved files without special permission."
  : "Search the web using SearXNG metasearch engine. Supports categories (general, images, videos, news, map, music, it, science, files, social media) and pageno.",
```

## Сводка изменений (один файл, ~30 строк)

| # | Что | Где | Размер |
|---|---|---|---|
| 1 | Добавить `categories` в `parameters` | `Type.Object({...})` | 4 строки |
| 2 | Добавить `pageno` в `parameters` | `Type.Object({...})` | 1 строка |
| 3 | Передавать `categories` и `pageno` в URL | `execute()` | 2 строки |
| 4 | Обновить JSDoc | комментарий | 4 строки |
| 5 | Обновить `description` | параметр инструмента | 2 строки |
| 6 | Добавить `promptSnippet` | параметр инструмента | 1 строка |
| 7 | Возвращать `details` с `resultsCount` и `savedPaths` | `return` | 4 строки |

## Связанные документы

- `02-searxng-search-prompt-proposal.md` — ранее предложенные правки (promptSnippet, details, description, JSDoc). Этот документ их **учитывает** (изменения 5, 6, 7 совпадают).
- `searxng/settings.yml` — наш серверный конфиг, с категориями совпадает.

## Что НЕ входит в этот план

- **Изменение поведения** `_dev_web_fetch` — он работает корректно, менять не нужно.
- **Закомментированный `_dev_searxng_fetch`** — он закомментирован до ~2026.09.05, не трогаем.
- **Изменение `.env` / `SEARXNG_URL`** — пользователь явно запретил трогать.

