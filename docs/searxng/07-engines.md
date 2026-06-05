# Движки SearXNG — полный справочник

SearXNG поддерживает **до 249 поисковых сервисов** (engines). Они делятся на две категории: **онлайн-движки** (используют HTTP для запросов к внешним сервисам) и **офлайн-движки** (работают локально, без сетевого подключения).

---

## Онлайн-движки

Онлайн-движки — это адаптеры между SearXNG и внешними поисковыми сервисами. Каждый движок реализует метод `search(query, params)` и возвращает список результатов.

### Поисковые системы

| Движок | Описание |
|--------|----------|
| Google | Основной поисковик Google |
| Bing | Поисковик Microsoft |
| DuckDuckGo | Приватный поисковик (без отслеживания) |
| Brave Search | Приватный поисковик от разработчиков браузера Brave |
| Qwant | Французский приватный поисковик |
| Startpage | Поиск без отслеживания (прокси Google) |
| Yahoo | Поисковик Yahoo |
| Presearch | Децентрализованный приватный поисковик |
| Yacy | Peer-to-peer поисковик |
| AOL | Поисковик AOL |

### Академические и научные

| Движок | Описание |
|--------|----------|
| arXiv | Предварительные публикации в физике, математике, CS |
| Semantic Scholar | AI-поисковик научных публикаций (AI2) |
| PubMed | Биомедицинская литература |
| OpenAlex | Полный индекс научных работ (преемник Microsoft Academic) |
| Springer Nature | Научные публикации Springer |
| CrossRef | DOI-ссылки и научные цитирования |
| CORE | Научные статьи и preprints |
| Astrophysics Data System (ADS) | Астрофизика, астрономия, физика |

### Код и разработка

| Движок | Описание |
|--------|----------|
| GitHub Code | Поиск по репозиториям GitHub |
| GitLab | Поиск по проектам GitLab |
| Sourcehut | Git-хостинг sourcehut |
| Gitea | Поиск по инстансам Gitea |
| Discourse Forums | Поиск по форумам Discourse |

### Социальные сети и коммуникация

| Движок | Описание |
|--------|----------|
| Lemmy | Децентралированный Reddit-аналог (Fediverse) |
| Mastodon | Поиск по инстансам Mastodon (ActivityPub) |
| Matrix Rooms Search (MRS) | Поиск комнат в Matrix |

### Вики и знания

| Движок | Описание |
|--------|----------|
| Wikipedia / Wikimedia | Все языковые разделы Wikipedia, Wikidata, Commons |
| MediaWiki | Любой инстанс MediaWiki |
| Open Library | Книги и библиография |
| Library of Congress | Библиотека Конгресса США |

### Медиа

| Движок | Описание |
|--------|----------|
| Piped | YouTube-альтернатива (F-Droid) |
| Peertube | Децентрализованное видео |
| Dailymotion | Видеохостинг |
| Odysee | Видео на Blockstack |
| Soundcloud | Аудио и музыка |
| RadioBrowser | Поиск радиостанций |
| Wallhaven | Стеновые обои (wallpapers) |

### Специализированные

| Движок | Описание |
|--------|----------|
| Z-Library | Электронная библиотека |
| Anna's Archive | Метапоисковик библиотек |
| Hugging Face | AI-модели и датасеты |
| BT4G | Поиск торрентов (BitTorrent4Google) |
| Geizhals | Сравнение цен (Германия/Австрия) |

---

## Офлайн-движки

Офлайн-движок — это движок, который **не требует интернет-соединения** и **не использует HTTP** для коммуникации. Все запросы выполняются локально на сервере SearXNG.

### Демо-движок (demo_offline)

Простой пример офлайн-движка:

```yaml
- name: my offline engine
  engine: demo_offline
  shortcut: demo
  disabled: false
```

Используется как шаблон для разработки собственных офлайн-движков.

**API:**
- `init(engine_settings=None)` — инициализация движка перед приёмом запросов
- `search(query, params)` — выполняет поиск, возвращает список результатов

### SQL Engines

Подключает реляционные базы данных к SearXNG. Поддерживаемые СУБД: **SQLite**, **PostgreSQL**, **MySQL/MariaDB**.

#### SQLite

Не требует дополнительных зависимостей.

```yaml
- name: mediathekview
  engine: sqlite
  shortcut: mediathekview
  categories: [general, videos]
  result_type: MainResult
  database: searx/data/filmliste-v2.db
  query_str: >-
    SELECT title || ' (' || time(duration, 'unixepoch') || ')' AS title,
           COALESCE( NULLIF(url_video_hd,''), NULLIF(url_video_sd,''), url_video) AS url,
           description AS content
      FROM film
     WHERE title LIKE :wildcard OR description LIKE :wildcard
     ORDER BY duration DESC
```

**Параметры:**
| Параметр | Описание |
|----------|----------|
| `database` | Путь к файлу `.db` |
| `query_str` | SQL-запрос с плейсхолдером `:wildcard` (или `%(query)s`) |
| `result_type` | `MainResult` или `KeyValue` |

#### PostgreSQL

Требует `pip install psycopg2`.

```yaml
- name: my_database
  engine: postgresql
  database: my_database
  username: searxng
  password: "<password>"
  query_str: 'SELECT * FROM my_table WHERE my_column = %(query)s'
```

**Параметры:**
| Параметр | Описание |
|----------|----------|
| `host` | Хост БД (default: `127.0.0.1`) |
| `port` | Порт (default: `5432`) |
| `database` | Имя базы данных |
| `username` | Пользователь |
| `password` | Пароль |
| `query_str` | SQL-запрос с плейсхолдером `%(query)s` |

#### MySQL / MariaDB

Требует `pip install mysql-connector-python` (MySQL) или `pip install mariadb` (MariaDB).

```yaml
- name: my_database
  engine: mysql_server
  database: my_database
  username: searxng
  password: "<password>"
  limit: 5
  query_str: 'SELECT * FROM my_table WHERE my_column=%(query)s'
```

**Параметры:** аналогичны PostgreSQL + `auth_plugin` (default: `caching_sha2_password`)

### NoSQL databases

#### Valkey Server (бывший Redis)

Требует `pip install valkey`.

```yaml
- name: myvalkey
  shortcut: rds
  engine: valkey_server
  exact_match_only: false
  host: '127.0.0.1'
  port: 6379
  db: 0
```

**Параметры:**
| Параметр | Описание |
|----------|----------|
| `host` | Хост (default: `127.0.0.1`) |
| `port` | Порт (default: `6379`) |
| `db` | Номер базы данных |
| `exact_match_only` | Точное совпадение или частичный поиск |

#### MongoDB

Требует `pip install pymongo`.

```yaml
- name: mymongo
  engine: mongodb
  shortcut: md
  exact_match_only: false
  host: '127.0.0.1'
  port: 27017
  database: 'business'
  collection: 'reviews'
  key: 'name'
```

**Параметры:**
| Параметр | Описание |
|----------|----------|
| `host` | Хост (default: `127.0.0.1`) |
| `port` | Порт (default: `27017`) |
| `database` | Имя базы данных |
| `collection` | Имя коллекции |
| `key` | Поле для поиска |

### Command Line Engines

Позволяет выполнить **любую shell-команду** с подстановкой поискового запроса через `{{QUERY}}`.

⚠️ **Внимание:** при публичном инстансе ограничивайте доступ через `tokens` — это потенциальная дыра безопасности.

```yaml
- name: find files
  engine: command
  shortcut: fnd
  command: ['find', '.', '-name', '{{QUERY}}']
  query_type: path
  delimiter:
    chars: ' '
    keys: ['line']
  working_dir: /path/to/search
```

**Параметры:**
| Параметр | Описание |
|----------|----------|
| `command` | Список элементов команды; `{{QUERY}}` — место для поискового запроса |
| `query_type` | `path` (проверка пути) или `enum` (список разрешённых запросов) |
| `query_enum` | Список допустимых значений при `query_type: enum` |
| `working_dir` | Рабочая директория (default: `./`) |
| `delimiter` | Разделитель для парсинга вывода (`chars` + `keys`) |
| `parse_regex` | Регулярные выражения для каждого ключа результата |
| `result_separator` | Символ-разделитель результатов (default: `\n`) |

---

## Конфигурация движков в settings.yml

### Базовая структура

```yaml
engines:
  - name: example          # имя движка во всей системе SearXNG
    engine: example        # имя Python-файла движка (например, google.py)
    shortcut: demo         # префикс для !bang (!demo)
    categories: general    # категории (вкладки UI)
    disabled: false        # включён по умолчанию
    timeout: 3.0           # таймаут запроса (переопределяет outgoing.request_timeout)
    weight: 1              # вес результатов (для ранжирования)
```

### Язык и регион

```yaml
- name: google english
  engine: google
  language: en             # ISO-код языка для конкретного движка
```

### Multilingual Search (обходной путь)

SearXNG не поддерживает истинный многоязычный поиск. Обходное решение — добавить один и тот же движок с разными языками:

```yaml
search:
  default_lang: "de"

engines:
  - name: google           # дефолтный (немецкий)
    engine: google

  - name: google english   # дополнительный (английский)
    engine: google
    language: en
```

### Сеть и прокси

```yaml
- name: example
  engine: example
  enable_http: false       # включить HTTP (по умолчанию только HTTPS)
  using_tor_proxy: false   # использовать Tor-прокси для этого движка
  network: ipv4            # или "ipv6" — только соответствующая IP-версия

  proxies:
    http:
      - http://proxy1:8080
    https:
      - http://proxy2:8080
      - socks5://user:password@proxy3:1080
```

### Пул соединений (pool limit)

Переопределяет настройки `outgoing:` для конкретного движка:

```yaml
- name: example
  engine: example
  max_connections: 100           # pool_connections
  max_keepalive_connections: 10  # pool_maxsize
  keepalive_expiry: 5.0          # seconds
```

### Retry на HTTP-ошибки

```yaml
- name: example
  engine: example
  retry_on_http_error: true              # все 400-599
  # или
  retry_on_http_error: 403               # только 403
  # или
  retry_on_http_error: [403, 429]        # конкретные коды
```

---

## Private Engines (tokens)

Для ограничения доступа к приватным движкам (особенно офлайн — базы данных, shell-команды) используется механизм токенов.

### На стороне сервера

```yaml
- name: arch linux wiki
  engine: archlinux
  tokens: ['my-secret-token']
```

Если пользователь не предоставил валидный токен:
- Движок **скрыт** из списка на странице Preferences
- Движок **не возвращается** в `/config` API
- Запросы к движку возвращают ошибку

### На стороне клиента

Пользователь вводит токены через страницу Preferences — список строк через запятую. Если токен совпадает — движок становится доступен.

---

## Управление через use_default_settings

### Включить/выключить конкретный движок

```yaml
use_default_settings: true

engines:
  - name: google
    disabled: false        # включить (если был выключен)
  - name: bing
    inactive: true         # удалить из настроек полностью
```

### Удалить лишние движки

```yaml
use_default_settings:
  engines:
    remove:
      - google
      - bing
```

### Оставить только выбранные

```yaml
use_default_settings:
  engines:
    keep_only:
      - duckduckgo
      - wikipedia
```

---

## Result Types (типы результатов)

SearXNG поддерживает несколько типов результатов для разных движков:

| Тип | Описание |
|-----|----------|
| `MainResult` | Основные результаты поиска (title, url, content) |
| `KeyValue` | Пары ключ-значение (для SQL/NoSQL) |
| `CodeResult` | Результаты с кодом (highlighted code block) |
| `PaperResult` | Научные статьи (abstract, citations) |
| `FileResult` | Файлы для скачивания |
| `AnswerResult` | Прямой ответ (calculator, time, etc.) |
| `CorrectionResult` | Исправления запроса ("Did you mean...") |
| `SuggestionResult` | Предложения автозаполнения |
| `InfoboxResult` | Информационный блок (wiki-style) |

---

## Источники документации

- [Engine Implementations](https://docs.searxng.org/dev/engines/index.html) — полный список движков
- [Configured Engines](https://docs.searxng.org/user/configured_engines.html) — пользовательский справочник
- [Settings: engines](https://docs.searxng.org/admin/settings/settings_engines.html) — конфигурация в settings.yml
- [Offline Concept](https://docs.searxng.org/dev/engines/offline_concept.html) — концепция офлайн-движков
- [SQL Engines](https://docs.searxng.org/dev/engines/offline/sql-engines.html) — SQL-интеграции
- [NoSQL databases](https://docs.searxng.org/dev/engines/offline/nosql-engines.html) — NoSQL-интеграции
- [Command Line Engines](https://docs.searxng.org/dev/engines/offline/command-line-engines.html) — shell-команды
