# SearXNG — обзор

## Что такое SearXNG

**SearXNG** — бесплатный приватный метапоисковик (metasearch engine), который агрегирует результаты поиска из **249+ поисковых сервисов**. Пользователи не отслеживаются и не профилируются. Ветвь discontinued-проекта [searX](https://github.com/searxng/searx).

## Ключевые характеристики

| Характеристика | Описание |
|---|---|
| **Язык** | Python (Flask/Furo для документации) |
| **Лицензия** | Open Source |
| **Технологии** | Docker, uWSGI, Granian, NGINX, Apache |
| **API** | HTTP API с поддержкой GET и POST на `/` и `/search` |
| **Tor** | Поддержка поиска через Tor для анонимности |
| **Плагины** | Калькулятор, хеширование, конвертер единиц, таймзоны, бесконечная прокрутка |

## Архитектура

1. **Engines** — 249+ поисковых движков (Google, Bing, DuckDuckGo, Wikipedia, arXiv, GitHub и др.)
   - Онлайн-движки: Google, Bing, Brave, Startpage, Qwant, Yahoo, DuckDuckGo и сотни других
   - Офлайн-движки: SQL, NoSQL, CLI, локальные поисковые индексы
2. **Plugins** — встроенные плагины (Calculator, Hash, Hostnames, Infinite scroll, Self-info, Tor check, Unit converter, Time zone)
3. **Answerers** — специальные ответчики (Random, Statistics и др.)
4. **Result Types** — MainResult, CodeResults, PaperResults, FileResults, Answer, Correction, Suggestion, Infobox

## API

SearXNG поддерживает простой HTTP API:
- Endpoints: `/` и `/search`
- Методы: GET и POST
- Возвращает JSON с агрегированными результатами поиска

## Интеграции

- **LangChain** — готовый `searx_search` tool/provider
- **OpenWebUI** — встроенная поддержка веб-поиска
- **Rust** — crate `searxng-client`
- **TypeScript** — сервис для взаимодействия с API
- **Railway** — one-click деплой

## Установка

Основные способы:
1. **Docker** (рекомендуемый)
2. Скрипт установки (`./install-server.sh`)
3. Step-by-step установка
4. Веб-серверы: uWSGI, Granian, NGINX, Apache

## Текущая версия

Документация: `2026.5.10+df1f24fb7` — очень свежая версия.

---

**Ссылки:**
- [docs.searxng.org](https://docs.searxng.org/) — официальная документация
- [github.com/searxng/searxng](https://github.com/searxng/searxng) — репозиторий
- [searx.space](https://searx.space) — список публичных инстансов
- [Wikipedia](https://en.wikipedia.org/wiki/SearXNG)
