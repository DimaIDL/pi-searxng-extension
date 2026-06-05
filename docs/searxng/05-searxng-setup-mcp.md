# SearXNG через MCP — настройка MCP-клиента

## Ссылка на основу

Полная инструкция по установке и доступу к SearXNG — в [04-searxng-our-setup.md](./04-searxng-our-setup.md). Здесь описываем только настройку MCP-интеграции.

## Наша топология

- **Удалённый сервер** (`ub2026-mini`, 192.168.1.132): SearXNG в Docker, порт 9097 → nginx → порт 9098
- **Локальная машина** (Windows): MCP-клиент подключается к SearXNG по `http://ub2026-mini:9098`

SSH-туннель не нужен — SearXNG доступен напрямую через HTTP из локальной сети.

## Шаг 1: Проверяем доступность SearXNG

С Windows-машины убеждаемся, что SearXNG отвечает:

```powershell
curl -s "http://ub2026-mini:9098/search?q=test&format=json" | head -5
```

Если видишь в ответе `"title"` и `"url"` — сервис доступен.

## Шаг 2: Добавляем SearXNG как глобальный MCP-сервер

Выполняем на Windows-машине через Git Bash:

```bash
claude mcp add --scope user searxng \
  --transport stdio \
  --env SEARXNG_URL=http://ub2026-mini:9098 \
  -- npx -y mcp-searxng
```

Это создаёт запись в `~/.claude.json` (user scope):

```json
{
  "mcpServers": {
    "searxng": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "mcp-searxng"],
      "env": {
        "SEARXNG_URL": "http://ub2026-mini:9098"
      }
    }
  }
}
```

Проверяем:

```bash
claude mcp list
```

Должен появиться `searxng`.

## Шаг 3: Добавляем правила в глобальный CLAUDE.md

В файл `~/.claude/CLAUDE.md` добавляем две секции:

```markdown
## Web Search
- Always prefer the SearXNG MCP tool (`searxng_web_search`) over the built-in `WebSearch` tool

## Fetch
- Always prefer `web_url_read` from SearXNG MCP over the built-in `Fetch` tool for reading web page content
```

Перезапускаем Claude Code (или начинаем новую сессию).

## Верификация

1. SearXNG доступен по `http://ub2026-mini:9098`
2. `claude mcp list` показывает searxng
3. Попроси Claude поискать что-нибудь — должен использовать `mcp__searxng__searxng_web_search` вместо встроенного WebSearch
4. Попроси прочитать веб-страницу — должен использовать `web_url_read` вместо встроенного Fetch