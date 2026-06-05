# SearXNG Tools — расширение для pi

## Постановка задачи

Разработать расширение для **pi** с тремя инструментами:
- `searxng_search` — поиск через SearXNG метапоисковик
- `searxng_fetch` — чтение веб-страниц с конвертацией HTML → Markdown
- `searxng_fetch_raw` — конвертация HTML → Markdown + сохранение сырого HTML в `.pi/fetch-raw/`. Не читать сохранённые файлы без особого разрешения.

Расширение заменяет текущую интеграцию через MCP (`mcp-searxng`) и работает нативно внутри pi без внешних процессов.

## Принятые решения

### Варианты реализации
| | A: Копия mcp-searxng | B: Native для pi (выбрано) |
|---|---|---|
| Зависимости | `undici`, `node-html-markdown`, proxy-модули, security-хелперы | Только `undici` + `node-html-markdown` |
| Объём кода | ~500 строк сложной логики | ~130 строк прямой HTTP-логики |
| Поддержка | Сложнее отлаживать, глубокая вложенность | Просто добавить параметры в запрос |

**Решение:** Вариант B — native для pi. Проще поддерживать и расширять по требованию.

### Структура расширения
```
.pi/extensions/searxng-tools/
├── package.json      # Зависимости + точка входа (pi.extensions)
├── index.ts          # Код расширения (экспортирует default function)
└── node_modules/     # Локальные зависимости
    ├── defuddle/
    ├── linkedom/
    └── undici/
```

### Автоматически создаваемые папки
- **`.pi/fetch-raw/`** — создаётся при первом вызове `searxng_fetch_raw`, содержит пары файлов: `<имя>.html` и `<имя>.md` с одинаковым базовым именем (домен_хэш_дата)

### Конфигурация
- **SearXNG URL:** `http://ub2026-mini:9098` (переопределяется через env `SEARXNG_URL`)
- **API поиска:** `GET /search?q=...&format=json`
- **Конвертация HTML → Markdown:** Defuddle (DOM analysis + CSS selectors) + JSON-LD fallback

## Эпы разработки

### Epic 1: Исследование и анализ MCP-интеграции ✅
- Изучена документация SearXNG (docs/searxng/)
- Протестирован HTTP API SearXNG (`http://ub2026-mini:9098`)
- Проанализирована реализация `mcp-searxng` (npm package)
- Определён формат JSON-ответа поиска

### Epic 2: Разработка расширения ✅
- Создано расширение в `.pi/extensions/searxng-tools/`
- Реализованы три инструмента: `searxng_search`, `searxng_fetch`, `searxng_fetch_raw`
- Настроены зависимости (`node-html-markdown`, `undici`)
- Протестирован поиск — работает корректно

### Epic 3: Многоуровневое извлечение контента ✅
- Заменён `node-html-markdown` на **Defuddle** (DOM analysis + CSS selectors)
- Добавлен **JSON-LD fallback** как второй уровень извлечения
- Defuddle автоматически удаляет sidebar, footer, ads по классам и атрибутам
- JSON-LD парсит `<script type="application/ld+json">` для бэкапа
- Возвращает metadata: title, author, description, published, image

## Текущий результат

### Работает ✅
- **Поиск:** `searxng_search` — возвращает агрегированные результаты из 249+ поисковых сервисов
- Формат вывода: нумерованный список с title, URL, snippet и score релевантности
- Параметры: `query`, `language`, `safesearch`, `time_range`

### В процессе 🔄
- **Чтение сайтов:** `searxng_fetch` — Defuddle + JSON-LD fallback (требует тестирования)
- HTTPS поддержка добавлена ✅
- Редиректы частично работают ✅
- Оставшиеся проблемы: HTTP→HTTPS редиректы (Vedomosti, Gazeta.ru), novosti-kosmonavtiki возвращает пустой ответ
- **Сырой HTML и Markdown:** `searxng_fetch_raw` — конвертирует HTML → Markdown, сохраняет оба файла (`.html` и `.md`) с одинаковым базовым именем в `.pi/fetch-raw/`. Не читать сохранённые файлы без особого разрешения.

## Дальнейшие задачи

1. **Фикс чтения сайтов** — обработка замечаний по `searxng_fetch`
2. **Debug search** — добавить отладочный вариант поиска для получения и анализа метаданных от поисковиков с целью их конфигурации (для понимания, какие движки возвращают какие данные)

## Зависимости

| Пакет | Назначение |
|-------|-----------|
| `undici` | HTTP-запросы к SearXNG API и внешним URL (HTTPS, редиректы) |
| `linkedom` | DOM-парсер для Defuddle (Node.js совместимый) |
| `defuddle` | Многоуровневое извлечение контента: DOM analysis + CSS selectors → Markdown |
| `node:url` | Парсинг URL для построения запросов к SearXNG |
| `typebox` | Схемы параметров инструментов (встроено в pi) |
| `@earendil-works/pi-ai` | StringEnum для enum-параметров (встроено в pi) |

## Инструменты

| Инструмент | Назначение |
|------------|-----------|
| `searxng_search` | Поиск через SearXNG API |
| `searxng_fetch` | Чтение сайтов с конвертацией HTML → Markdown |
| `searxng_fetch_raw` | Конвертация HTML → Markdown + сохранение сырого HTML в `.pi/fetch-raw/`. Не читать сохранённые файлы без особого разрешения. |

## Загрузка и тестирование

Расширение загружается автоматически при `/reload`. Для ручного теста:
```bash
pi -e ./.pi/extensions/searxng-tools/index.ts
```
