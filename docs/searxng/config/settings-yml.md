# `settings.yml` — полный справочник

## Расположение файла

1. Путь из переменной окружения `SEARXNG_SETTINGS_PATH`
2. `/etc/searxng/settings.yml`
3. Дефолтный файл из репозитория (`searx/settings.yml`)

---

## `use_default_settings: true`

Включает режим «переопределить только нужное». Все остальные настройки наследуются от дефолтного конфига.

### Переопределение секций

```yaml
use_default_settings: true

server:
  secret_key: "ultrasecretkey"
  bind_address: "[::]"

engines:
  - name: arch linux wiki
    tokens: ['$ecretValue']
  - name: bing
    disabled: false
```

### Удаление движков

```yaml
use_default_settings:
  engines:
    remove:
      - google
server:
  secret_key: "ultrasecretkey"
engines:
  - name: duckduckgo
    tokens: ['$ecretValue']
```

### Оставить только выбранные движки

```yaml
use_default_settings:
  engines:
    keep_only:
      - google
      - duckduckgo
server:
  secret_key: "ultrasecretkey"
engines:
  - name: google
    tokens: ['$ecretValue']
  - name: duckduckgo
    tokens: ['$ecretValue']
```

---

## `server:` — настройки сервера

| Параметр | Описание |
|----------|----------|
| `secret_key` | Ключ для подписи cookie. **Обязательно изменить!** Генерация: `openssl rand -hex 32` |
| `bind_address` | Адрес привязки (по умолчанию `127.0.0.1`) |
| `port` | Порт (по умолчанию `8080`) |
| `debug` | Режим отладки (`false` в продакшене) |
| `limiter` | Включить лимитер (защита от rate-limit) |
| `imagebox_proxy` | Proxy для изображений |
| `favicon_proxy` | Proxy для favicon |

---

## `search:` — настройки поиска

| Параметр | Описание |
|----------|----------|
| `formats` | Форматы ответа: `html`, `json` (обязательно для MCP) |
| `language` | Язык поиска (например, `ru`, `en`, `None`) |
| `region` | Регион (например, `none`, `de-de`, `us-en`) |
| `safesearch` | Безопасный поиск: `0`=выкл, `1`=проверка, `2`=жесткий |
| `default_timeout` | Таймаут запроса в секундах (по умолчанию 3.0) |
| `max_page` | Максимальное количество страниц результатов |

---

## `outgoing:` — исходящие настройки

| Параметр | Описание |
|----------|----------|
| `request_timeout` | Таймаут одного запроса к движку (сек, по умолчанию 30.0) |
| `max_requests` | Максимум одновременных запросов к одному движку |
| `surrogate_proxy` | Прокси-сервер для исходящих запросов |
| `using_tor_proxy` | Маршрутизация через Tor-прокси |

### User-Agent и защита от детекции

Каждый запрос использует случайный User-Agent из пула (`searx/data/useragents.json`). SearXNG перемешивает TLS-шифры (`shuffle_ciphers()`) для защиты от TLS-фингерпринтинга.

```python
headers["User-Agent"] = gen_useragent()      # случайный Firefox
headers["Accept-Encoding"] = "gzip, deflate"
headers["Cache-Control"] = "no-cache"
headers["DNT"] = "1"                         # Do Not Track
headers["Connection"] = "keep-alive"
cookies = {}                                 # всегда пустые
```

---

## `engines:` — движки поиска

### Структура

Каждый движок определяется объектом с полями:

| Параметр | Описание |
|----------|----------|
| `name` | Имя движка (уникальный идентификатор) |
| `enabled` | Включён ли движок (`true`/`false`) |
| `disabled` | Альтернативный способ отключения |
| `tokens` | Токены доступа для платных API |
| `base_url` | Базовый URL (для кастомных движков) |

### Примеры

```yaml
engines:
  - name: google
    enabled: true
    categories: general
    search_url: https://www.google.com/search?q={searchTerms}
    url_suffix: '&num=10&start='

  - name: duckduckgo
    enabled: true
    categories: general

  - name: arch linux wiki
    enabled: true
    tokens: ['$ecretValue']
    categories: linux
```

### Управление через `use_default_settings`

```yaml
# Удалить google, добавить токены для arch linux
use_default_settings:
  engines:
    remove:
      - google

engines:
  - name: arch linux wiki
    tokens: ['$ecretValue']
```

---

## `plugins:` — плагины

### Встроенные плагины

| Плагин | Описание |
|--------|----------|
| `calculator` | Вычисления (например, "100 * 25") |
| `hash_values` | Хеши MD5, SHA1, SHA256 и др. |
| `hostnames` | Информация о хосте |
| `infinite_scroll` | Бесконечная прокрутка результатов |
| `self_info` | Проверка IP и данных браузера |
| `tor_check` | Проверка Tor-выходного узла |
| `unit_converter` | Конвертер единиц измерения |
| `time_zone` | Информация о часовых поясах |

### Включение/выключение

```yaml
plugins:
  - name: calculator
    enabled: true
  - name: infinite_scroll
    enabled: false
```

---

## `categories_as_tabs:` — категории как вкладки

Определяет, какие категории отображаются как вкладки в интерфейсе:

| Категория | Описание |
|-----------|----------|
| general | Общий поиск |
| files | Файлы |
| itc | IT и компьютеры |
| music | Музыка |
| video | Видео |
| communication | Коммуникация |
| enotes | Заметки |
| other | Другое |

```yaml
categories_as_tabs:
  - general
  - files
  - itc
  - music
  - video
```

---

## `ui:` — настройки интерфейса

| Параметр | Описание |
|----------|----------|
| `default_locale` | Язык интерфейса (например, `ru`, `en`) |
| `theme` | Тема оформления |
| `results_on_responsive` | Количество результатов на мобильных |
| `disabled` | Список отключённых плагинов в UI |

---

## `brand:` — брендинг

Настройки для кастомизации instance:

```yaml
brand:
  about: "Мой SearXNG Instance"
  static_urls:
    - /static/searx.png
  contact_no_email: true
  github: https://github.com/my/searxng-instance
```

---

## `redis:` — кэширование Redis

```yaml
redis:
  url: "redis://localhost:6379"
  key_prefix: "searxng_"
  ttl: 3600
```

---

## `valkey:` — кэширование Valkey (альтернатива Redis)

```yaml
valkey:
  url: "valkey://localhost:6379"
  key_prefix: "searxng_"
  ttl: 3600
```

---

## Полный пример для MCP

```yaml
use_default_settings: true

search:
  formats:
    - html
    - json   # обязательно для MCP

server:
  secret_key: "<openssl rand -hex 32>"
  limiter: false

outgoing:
  request_timeout: 10.0
```
