# Установка SearXNG + MCP — пошаговая инструкция

## Наша конфигурация (распределённая)

Инструкция [03-searxng-habr-setup-only.md](./03-searxng-habr-setup-only.md) писалась для случая "одна машина" (SearXNG + Claude Code на одной тачке). Наша реальная топология:

- **Удалённый сервер** (`ub2026-mini`, 192.168.1.132): Docker-контейнер SearXNG
- **Локальная машина** (Windows): MCP-клиент (Claude Code) подключается к SearXNG через сеть

SearXNG будет запущен на порту `9097`, с отображением в порт `9098` через nginx для доступа из локальной сети по адресу `http://192.168.1.132:9098`. SSH-туннель не нужен — SearXNG доступен напрямую через HTTP.

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
  secret_key: "<секретный_ключ>"    # при новой установке сгенерируйте случайную строку (openssl rand -hex 32)
  limiter: false

outgoing:
  request_timeout: 10.0
```

## Шаг 2: Запускаем SearXNG в Docker (**Удалённый сервер**)

```bash
docker run -d \
  --name searxng \
  --restart unless-stopped \
  -p 127.0.0.1:9097:8080 \
  -v ~/.searxng/settings.yml:/etc/searxng/settings.yml:rw \
  searxng/searxng:latest
```

Проверяем, что порт назначился правильно:

```bash
docker port searxng
```

Должно показать: `8080/tcp -> 127.0.0.1:9097`

## Шаг 3: Проверить, что SearXNG жив на порту 9097 (**Удалённый сервер**)

```bash
curl -s "http://localhost:9097/search?q=test&format=json" | head -5
```

Если видишь в ответе слова `"title"`, `"url"` — значит SearXNG работает. Он вернёт результаты поиска в формате JSON.

## Шаг 4: Открываем порты в фаерволе (ufw)

На этой машине стоит фаервол — он блокирует все входящие порты кроме SSH. Нужно разрешить 9098:

```bash
sudo ufw allow 9098/tcp
```

Проверить:

```bash
sudo ufw status
```

Должно показать строки `9098/tcp` со статусом `ALLOW`.

## Доступ к машине по имени

Машина настроена для NetBIOS-объявления имени `ub2026-mini`. Полная инструкция в [../netbios_setup.md](../netbios_setup.md).

С Windows-машины проверяем:
```powershell
ping ub2026-mini
```

Если видишь `Ответ от 192.168.1.132` — машина доступна по имени!

## Шаг 5: Nginx reverse-proxy (порт 9098 → localhost:9097)

Установить nginx и создать конфиг:

```bash
sudo apt update && sudo apt install -y nginx

sudo tee /etc/nginx/sites-available/searxng > /dev/null <<EOF
upstream searxng {
    server 127.0.0.1:9097;
}

server {
    listen 9098;
    server_name _;

    location / {
        proxy_pass http://searxng;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_buffering off;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/searxng /etc/nginx/sites-enabled/searxng
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Проверить из локальной сети (с Windows):
```powershell
curl -s "http://ub2026-mini:9098/search?q=test&format=json" | head -5
```
