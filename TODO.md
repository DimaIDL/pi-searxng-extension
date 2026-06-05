# TODO — Future Solutions & Known Limitations

## 🚧 Implemented (v1)

- [x] Basic `searxng_fetch` testing across multiple news sources
- [x] HTTPS support added to fetch tool
- [x] Redirect handling improved for most sites

---

## 🔮 Planned Improvements (v2+)

### 1. Playwright Fallback для сложных сайтов

**Проблема:** `searxng_fetch` не может обработать:
- **SPA (Single Page Application)** — Ведомости (`vedomosti.ru`) рендерят контент через JavaScript
- **SSI (Server-Side Includes)** — Газета.ру (`gazeta.ru`) использует `mod_include`, сервер отдаёт только шаблон

**Решение:** Docker-контейнер с Playwright как fallback:
```
searxng_fetch(url) → успех? ✅ вернуть результат
                    ↓ провал?
                      → Playwright (Docker) → рендерить JS/SSI → вернуть
```

**Плюсы:**
- Работает со всеми SPA и SSI сайтами
- Сохраняет скорость `searxng_fetch` для простых случаев

---

### 2. Rate Limiting

**Проблема:** Частые запросы к одному домену → блокировка (IP ban)

**Решение:** Пауза между запросами к одному домену:
- Минимум **1–2 секунды** между запросами
- Случайная задержка для избежания детекции

---

### 3. Browser Headers

**Проблема:** Запросы без headers → подозрительный бот → блокировка

**Решение:** Имитация браузера:
- `User-Agent` — реальный браузер (Chrome/Firefox)
- `Accept-Language` — язык пользователя
- `Referer` — источник запроса

---

## ❌ Исключённые источники

| Источник | Причина | Статус |
|----------|---------|--------|
| **novosti-kosmonavtiki.ru** | Сайт не работает (fetch failed) | 🚫 Исключён из тестов |
| **gazeta.ru** | SSI + mod_include — требует Playwright fallback | ⏳ Отложено до v2 |
| **vedomosti.ru** | SPA — JS рендеринг, контент недоступен без браузера | ⏳ Отложено до v2 |

---

## 📊 Текущая статистика (v1)

| Источник | Статус | Причина |
|----------|--------|---------|
| Лента.ру | ✅ Работает | Простой HTML, без JS/SSI |
| EADaily | ✅ Работает | Простой HTML |
| Prokosmos | ✅ Работает | Простой HTML |
| Интерфакс | ✅ Работает | Простой HTML (редирект обработан) |
| Жэньминь Жибао | ✅ Работает | Простой HTML |
| Ведомости | ❌ Не работает | SPA — JS рендеринг |
| Газета.ру | ❌ Не работает | SSI + mod_include |

**Успешность:** 5/7 (71%) для простых сайтов, 0/2 (0%) для сложных.
