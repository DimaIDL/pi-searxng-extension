# Установка SearXNG + MCP — пошаговая инструкция

## Шаг 1: Создаём директорию и конфиг

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

## Шаг 2: Запускаем SearXNG в Docker

```bash
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 8888:8080 \
  -v ~/.searxng/settings.yml:/etc/searxng/settings.yml:rw \
  searxng/searxng:latest
```

## Шаг 3: Проверяем, что SearXNG работает

```bash
curl -s "http://localhost:8888/search?q=hello&format=json" | python3 -m json.tool | head -10
```

Ждём ответ — значит SearXNG жив.

## Шаг 4: Настраиваем MCP-сервер

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

## Шаг 5: Говорим Claude использовать SearXNG

Добавьте в `~/.claude/CLAUDE.md`:

```markdown
## Web Search
- Always prefer the SearXNG MCP tool (`searxng_web_search`) over the built-in `WebSearch` tool
- Use `web_url_read` from SearXNG MCP for reading web page content
```

Перезапустите Claude Code.

## Шаг 6: Проверяем

Попросите Claude Code что-нибудь поискать. Если он использует `mcp__searxng__searxng_web_search` вместо встроенного `WebSearch` — всё работает.
