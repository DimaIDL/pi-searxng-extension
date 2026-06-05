# SearXNG + MCP — локальный поиск для Claude Code

## Зачем

Встроенный `WebSearch` отправляет каждый поисковый запрос на серверы Anthropic. Они видят все ваши запросы.

SearXNG через MCP — это прямой поиск без посредников: бесплатно, без лимитов, без API-ключей. Запрос идёт локально → SearXNG → поисковики. Anthropic не участвует в цепочке.

---

## Архитектура

```
Claude Code → MCP-клиент (JSON-RPC 2.0, stdio)
                 ↓
         MCP-сервер (mcp-searxng, Node.js процесс)
                 ↓
         HTTP GET http://localhost:8888/search?q=...&format=json
                 ↓
         SearXNG (localhost, Docker)
                 ↓ (параллельно, в отдельных потоках)
    ┌────────────┼────────────┬────────────┬────────────┐
  Google     DuckDuckGo     Brave     Wikipedia    Wikidata
    └────────────┼────────────┴────────────┴────────────┘
                 ↓
         Агрегация, дедупликация, скоринг
                 ↓
         JSON-ответ → обратно по цепочке → Claude Code
```

MCP-сервер — обычный Node.js-процесс. Общается с Claude Code через stdin/stdout. Никаких API-ключей, никакого сетевого оверхеда.

---

## Как работает SearXNG под капотом

SearXNG (25 500+ звёзд на GitHub) — open-source метапоисковик. У него нет собственного индекса. Он отправляет запрос параллельно в Google, DuckDuckGo, Brave и ~245 других движков, собирает результаты и отдаёт вам.

### Параллельные запросы в потоках

Каждый движок — отдельный поток:

```python
# searx/search/__init__.py
for engine_name, query, request_params in requests:
    th = threading.Thread(
        target=PROCESSORS[engine_name].search,
        args=(query, request_params, self.result_container, ...),
    )
    th.start()
```

Потоки идентифицируются по UUID. Главный поток ждёт завершения каждого с таймаутом. Не успел — движок помечается как `unresponsive`.

Реальные данные с инстанса (заголовок `Server-Timing`):

| Движок | Время |
|--------|-------|
| Google | 1.27 сек |
| DuckDuckGo | 1.96 сек |
| Wikidata | 2.01 сек |
| Brave | 2.09 сек |
| Wikipedia | 3.58 сек (bottleneck) |
| **Итого** | **3.58 сек** (= время самого медленного движка) |

### Что SearXNG отправляет поисковикам

Каждый запрос формируется в `OnlineProcessor.get_params()` (`searx/search/processors/online.py`):

```python
headers["User-Agent"] = gen_useragent()      # случайный Firefox
headers["Accept-Encoding"] = "gzip, deflate"
headers["Cache-Control"] = "no-cache"
headers["DNT"] = "1"                         # Do Not Track
headers["Connection"] = "keep-alive"
cookies = {}                                 # всегда пустые
```

User-Agent генерируется случайно из пула (`searx/data/useragents.json`):

```json
{
  "os": ["Windows NT 10.0; Win64; x64", "X11; Linux x86_64"],
  "ua": "Mozilla/5.0 ({os}; rv:{version}) Gecko/20100101 Firefox/{version}",
  "versions": ["148.0", "147.0"]
}
```

Каждый запрос выглядит как новый пользователь с новым Firefox. SearXNG также перемешивает TLS-шифры (`shuffle_ciphers()`), чтобы защитить от TLS-фингерпринтинга.

### Дедупликация и скоринг

Результаты из всех движков собираются в потокобезопасный `ResultContainer` (`searx/results.py`).

Если один URL пришёл из Google и DuckDuckGo — результаты мержатся: берётся более длинный content, HTTPS предпочитается HTTP.

Скоринг простой и прозрачный:

```python
score = 0
for position in result['positions']:
    score += weight / position
```

Результат на 1-й позиции в трёх движках: `1/1 + 1/1 + 1/1 = 3.0`. На 10-й позиции в одном: `1/10 = 0.1`. Чем больше движков подтвердили результат и выше позиция — тем выше score.

---

## Анонимность: «запросы не покидают машину»

Это архитектурное свойство, а не маркетинг. Разберём каждый слой:

| Данные | MCP-сервер | SearXNG | Google, DuckDuckGo и др. |
|--------|-----------|---------|------------------------|
| Текст запроса | Да (stdin) | Да (localhost HTTP) | Да |
| IP пользователя | N/A (stdio) | 127.0.0.1 | Ваш IP (не Anthropic) |
| User-Agent | Нет | Случайный Firefox | Рандомизированный |
| Cookies | Нет | Пустые | Пустые |
| Referer | Нет | Нет | Нет |
| TLS fingerprint | N/A | N/A | Рандомизированный |
| Логирование | Нет (stateless) | Нет (по умолчанию) | Их дело |

Сравните с `WebSearch`: ваш запрос уходит на серверы Anthropic → их инфраструктура ищет → результаты возвращаются. Anthropic видит каждый ваш поисковый запрос. С SearXNG — запрос идёт `localhost` → ваш IP → поисковики. Anthropic не участвует.

MCP-сервер (`mcp-searxng`) — Node.js-процесс на вашей машине, общается с Claude Code через stdin/stdout. Никакой сети.
SearXNG — Flask-приложение за `granian` (ASGI-сервер) в Docker. Не логирует запросы (`debug: false`). Не ведёт сессий. Stateless.

Поисковики видят ваш IP (как если бы вы сами зашли в Google), но с рандомным User-Agent, пустыми cookies и заголовком DNT. Для Google каждый запрос выглядит как новый человек с нового компьютера.

Для ещё более сильной анонимности SearXNG поддерживает маршрутизацию через прокси и Tor (`outgoing.using_tor_proxy: true`). Но для разработческого использования это избыточно.

---

## Установка за 10 минут

### Шаг 1. SearXNG в Docker

```bash
mkdir -p ~/.searxng
```

Создайте `~/.searxng/settings.yml`:

```yaml
use_default_settings: true

search:
  formats:
    - html
    - json    # обязательно для MCP

server:
  secret_key: "сгенерируйте-случайную-строку"
  limiter: false

outgoing:
  request_timeout: 10.0
```

Важно: `json` в `search.formats` — обязательное условие. Без него MCP-сервер не получит результаты.

```bash
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  -v ~/.searxng/settings.yml:/etc/searxng/settings.yml:rw \
  searxng/searxng:latest
```

Проверяем:

```bash
curl -s "http://localhost:8888/search?q=hello&format=json" | python3 -m json.tool | head -10
```

### Шаг 2. MCP-сервер

Создайте `~/.mcp.json`:

```json
{
  "mcpServers": {
    "searxng": {
      "command": "npx",
      "args": ["-y", "mcp-searxng"],
      "env": {
        "SEARXNG_URL": "http://localhost:8888"
      }
    }
  }
}
```

Альтернатива на Python: `uvx mcp-searxng` (SecretiveShell/MCP-searxng).

### Шаг 3. Говорим Claude использовать SearXNG

Добавьте в `~/.claude/CLAUDE.md`:

```markdown
## Web Search
- Always prefer the SearXNG MCP tool (`searxng_web_search`) over the built-in `WebSearch` tool
- Use `web_url_read` from SearXNG MCP for reading web page content
```

Перезапустите Claude Code. Готово.

### Проверка

Попросите Claude Code что-нибудь поискать. Если он использует `mcp__searxng__searxng_web_search` вместо встроенного `WebSearch` — всё работает.
