# Плагины SearXNG — полный справочник

## Обзор

SearXNG поддерживает систему плагинов, расширяющих или заменяющих функциональность различных компонентов. Плагины регистрируются в `PluginStore` через полностью определённое имя класса (fully qualified class name).

**Точки входа (hooks) плагина:**
- `pre_search` — до отправки запроса к движкам
- `post_search` — после получения результатов
- `on_result` — для каждого результата

---

## Регистрация плагинов в `settings.yml`

Все плагины (встроенные и внешние) регистрируются через секцию `plugins:`. Старая секция `enabled_plugins:` больше не используется.

```yaml
use_default_settings: true

plugins:
  searx.plugins.calculator.SXNGPlugin:
    active: false   # пользователь может включить

  searx.plugins.unit_converter.SXNGPlugin:
    active: true    # включён по умолчанию
```

Чтобы отключить все плагины:

```yaml
use_default_settings: true
plugins: {}
```

### Встроенные плагины (по умолчанию)

| Плагин | Класс | Активен по умолчанию |
|--------|-------|---------------------|
| Calculator | `searx.plugins.calculator.SXNGPlugin` | `true` |
| Hash Values | `searx.plugins.hash_plugin.SXNGPlugin` | `true` |
| Hostnames | `searx.plugins.hostnames.SXNGPlugin` | `true` |
| Infinite scroll | `searx.plugins.infinite_scroll.SXNGPlugin` | `false` |
| Self-Info | `searx.plugins.self_info.SXNGPlugin` | `true` |
| Tracker URL Remover | `searx.plugins.tracker_url_remover.SXNGPlugin` | `true` |
| Unit Converter | `searx.plugins.unit_converter.SXNGPlugin` | `true` |
| Ahmia Filter | `searx.plugins.ahmia_filter.SXNGPlugin` | `true` |
| OA DOI Rewrite | `searx.plugins.oa_doi_rewrite.SXNGPlugin` | `false` |
| Tor Check | `searx.plugins.tor_check.SXNGPlugin` | `false` |

---

## Calculator

**Класс:** `searx.plugins.calculator.SXNGPlugin`

Парсит и вычисляет математические выражения.

```python
id: str = 'calculator'
```

**Пример использования:** запрос `100 * 25` → результат `2500`.

---

## Hash Values (Хеши)

**Класс:** `searx.plugins.hash_plugin.SXNGPlugin`

Конвертирует строки в различные хеш-суммы. Результаты отображаются в области «ответов».

```python
id: str = 'hash_plugin'
keywords: list[str] = ['md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512']
```

**Пример использования:** запрос `md5 hello` → хеш MD5 строки «hello».

Поддерживаемые алгоритмы: MD5, SHA1, SHA224, SHA256, SHA384, SHA512.

---

## Hostnames (Хостнеймы)

**Класс:** `searx.plugins.hostnames.SXNGPlugin`

Перезаписывает хостнеймы, удаляет результаты или повышает их приоритет.

```python
id: str = 'hostnames'
```

### Конфигурация

Плагин требует настройки через секцию `hostnames:` в `settings.yml`. Без этой конфигурации плагин не загружается.

#### replace — замена доменов

Маппинг регулярных выражений к хостнеймам для замены:

```yaml
use_default_settings: true

hostnames:
  replace:
    '(.*\.)?youtube\.com$': 'invidious.example.com'
    '(.*\.)?youtu\.be$': 'invidious.example.com'
```

#### remove — удаление доменов из результатов

Список регулярных выражений для удаления результатов:

```yaml
hostnames:
  remove:
    - '(.*\.)?facebook.com$'
    - '(.*\.)?twitter\.com$'
```

#### high_priority — повышение приоритета

Результаты с этих доменов поднимаются выше в списке:

```yaml
hostnames:
  high_priority:
    - '(.*\.)?wikipedia.org$'
```

#### low_priority — понижение приоритета

Результаты с этих доменов опускаются ниже. Если URL попадает одновременно в `high_priority` и `low_priority`, побеждает `high_priority`.

```yaml
hostnames:
  low_priority:
    - '(.*\.)?google(\..*)?$'
```

#### Внешний файл маппингов

Можно вынести replace-маппинг в отдельный YAML-файл:

```yaml
use_default_settings: true

hostnames:
  replace: 'rewrite-hosts.yml'   # файл лежит рядом с settings.yml
  remove:
    - '(.*\.)?facebook.com$'
```

**API плагина:**

```python
def on_result(request, search, result) -> bool:
    # True — сохранить результат
    # False — удалить из списка

def filter_url_field(result, field_name, url_src) -> bool | str:
    # True — оставить URL как есть
    # False — игнорировать URL
    # str — новый URL для использования
```

---

## Infinite scroll (Бесконечная прокрутка)

**Класс:** `searx.plugins.infinite_scroll.SXNGPlugin`

Автоматически загружает следующую страницу при прокрутке вниз.

```python
id: str = 'infiniteScroll'
```

По умолчанию **отключен**.

---

## Self-Info (Информация о себе)

**Класс:** `searx.plugins.self_info.SXNGPlugin`

Отображает информацию о запросе пользователя: IP-адрес или HTTP User-Agent. Результаты отображаются в области «ответов».

```python
id: str = 'self_info'
keywords: list[str] = ['ip', 'user-agent']
```

**Пример использования:** запрос `ip` → показывает IP-адрес запроса. Запрос `user-agent` → показывает User-Agent браузера.

---

## Tor Check (Проверка Tor)

**Класс:** `searx.plugins.tor_check.SXNGPlugin`

Проверяет, является ли IP-адрес пользователя выходным узлом Tor (exit-node). Загружает список exit-nodes с `url_exit_list`.

```python
id: str = 'tor_check'
keywords: list[str] = ['tor-check', 'tor_check', 'torcheck', 'tor', 'tor check']

url_exit_list: str = 'https://check.torproject.org/exit-addresses'
```

По умолчанию **отключен**.

---

## Unit Converter (Конвертер единиц)

**Класс:** `searx.plugins.unit_converter.SXNGPlugin`

Конвертирует измеримые значения из одной единицы в другую. Ищет символы единиц измерения в запросе и выполняет конвертацию.

```python
id: str = 'unit_converter'
```

Поддерживаемые единицы определяются через `ADDITIONAL_UNITS`. При неоднозначности символов оцениваются совпадающие единицы измерений.

---

## Time Zone (Часовые пояса)

**Класс:** `searx.plugins.time_zone.SXNGPlugin`

Отображает текущее время в разных часовых поясах (обычно по городу из запроса).

```python
id: str = 'time_zone'
keywords: list[str] = ['time', 'timezone', 'now', 'clock', 'timezones']
```

Использует классы `searx.weather.GeoLocation` для определения часового пояса и `searx.weather.DateTime` для локализованного отображения даты и времени.

---

## External Plugins (Внешние плагины)

SearXNG поддерживает внешние плагины, которые можно подключить отдельно:

### TGWF Green Web Filter
[Only show green hosted results](https://github.com/return42/tgwf-searx-plugins/) — проверяет, входит ли домен в список Green WEB.

### BM25 Reranker
[SearXNG BM25 Reranker](https://github.com/Oaklight/searxng-bm25-reranker) — переупорядочивает результаты поиска с помощью BM25 текстового ранжирования для улучшения качества поиска.

---

## Полный пример конфигурации плагинов

```yaml
use_default_settings: true

plugins:
  searx.plugins.calculator.SXNGPlugin:
    active: false   # пользователь включает через UI

  searx.plugins.infinite_scroll.SXNGPlugin:
    active: false   # по умолчанию отключён

  searx.plugins.hash_plugin.SXNGPlugin:
    active: true    # включён всегда

  searx.plugins.self_info.SXNGPlugin:
    active: true

  searx.plugins.unit_converter.SXNGPlugin:
    active: true

  searx.plugins.hostnames.SXNGPlugin:
    active: true

hostnames:
  high_priority:
    - '(.*\.)?wikipedia.org$'
  low_priority:
    - '(.*\.)?google(\..*)?$'
```
