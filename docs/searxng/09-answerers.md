# Answerers (Ответчики) SearXNG — полный справочник

## Обзор

Answerers (ответчики) — это встроенные компоненты SearXNG, которые предоставляют мгновенные ответы на основе содержимого поискового запроса. Они не выполняют поиск по внешним источникам, а генерируют ответ «на лету» внутри самого движка.

Ответчики активируются по ключевым словам (`keywords`). Если первое слово запроса совпадает с `keywords` какого-либо ответчика, SearXNG передаёт весь запрос этому ответчику и возвращает результат в область «ответов» (answer area).

**Точки входа:**
- Ответчики вызываются до или вместо поиска по движкам
- Результат отображается в области ответов (Answer Results)
- Не требуют внешних API — работают полностью офлайн

---

## Архитектура

### `AnswerStorage` — хранилище ответчиков

Центральное хранилище, которое управляет всеми зарегистрированными ответчиками.

```python
class searx.answerers.AnswerStorage:
    answerer_list: set[Answerer]          # список всех ответчиков
    load_builtins()                        # загружает встроенные из searx/answerers/
    register_by_fqn(fqn: str)             # регистрация по fully qualified class name
    register(answerer: Answerer)          # регистрация экземпляра
    ask(query: str) -> list[BaseAnswer]   # передаёт запрос всем ответчикам
```

Метод `ask()` проверяет каждое слово запроса — если оно совпадает с `keywords` какого-либо ответчика, этот ответчик обрабатывает весь запрос.

### Базовый класс `Answerer`

Абстрактный базовый класс для всех ответчиков.

```python
class searx.answerers.Answerer:
    keywords: list[str] = []              # ключевые слова-триггеры

    def answer(self, query: str) -> list[BaseAnswer]:
        """Возвращает список ответов на запрос (абстрактный метод)"""

    def info(self) -> AnswererInfo:
        """Возвращает информацию об ответчике для UI настроек"""
```

### `AnswererInfo` — метаданные ответчика

Объект, содержащий информацию об ответчике. Отображается в меню Preferences.

```python
class searx.answerers.AnswererInfo:
    name: str                             # имя ответчика
    description: str                      # краткое описание
    examples: list[str]                   # примеры запросов
    keywords: list[str]                   # ключевые слова
```

Тексты в `AnswererInfo` должны быть на английском и переведены через `flask_babel.gettext()`.

### `ModuleAnswerer` — обёртка для legacy-модулей

Вспомогательный класс для старых ответчиков, где `keywords`, `answer()` и `info()` определены на уровне модуля (не в классе). Используется внутренне при загрузке встроенных модулей.

---

## Регистрация ответчиков

Ответчики регистрируются через полностью определённое имя класса (FQN) в `PluginStore`. Старая секция `enabled_plugins:` не используется — ответчики загружаются автоматически из пакета `searx.answerers`.

```yaml
# Ответчики включены по умолчанию, без настроек в settings.yml
# searx/answerers/random.py  → keywords: ['random']
# searx/answerers/statistics.py → keywords: ['min', 'max', 'avg', 'sum', 'prod', 'range']
```

---

## Встроенные ответчики

### Random (Случайные значения)

**Класс:** `searx.answerers.random.SXNGAnswerer`

Генерирует различные случайные значения. Активируется по ключевому слову `random`.

```python
id: str = 'random'
keywords: list[str] = ['random']
```

#### Поддерживаемые типы генерации

| Тип | Функция | Пример результата |
|-----|---------|-------------------|
| `string` | Случайная строка (8-32 символа) | `aB3kx9Zm1pQ7` |
| `int` | Случайное целое (-2³¹ … 2³¹) | `-1405623891` |
| `float` | Случайное дробное (0.0 … 1.0) | `0.738291047` |
| `sha256` | SHA-256 хеш случайной строки | `e3b0c4...a1f6` |
| `uuid` | UUID v4 | `550e8400-bae7-4d90-ae4d-02f0e0eb834d` |
| `color` | Случайный HEX цвет | `#A3F2B1` |

#### Исходный код

```python
import hashlib
import random
import string
import uuid

class SXNGAnswerer(Answerer):
    keywords = ["random"]

    random_types = {
        "string":   random_string,     # 8-32 символа: a-z, A-Z, 0-9
        "int":      random_int,        # -2³¹ … +2³¹
        "float":    random_float,      # 0.0 … 1.0
        "sha256":   random_sha256,     # SHA-256 от случайной строки
        "uuid":     random_uuid,       # UUID v4
        "color":    random_color,      # HEX #RRGGBB
    }

    def info(self):
        return AnswererInfo(
            name="Random",
            description="Generate different random values",
            keywords=self.keywords,
            examples=["random string", "random int", "random float",
                       "random sha256", "random uuid", "random color"],
        )

    def answer(self, query: str) -> list[BaseAnswer]:
        parts = query.split()
        if len(parts) != 2 or parts[1] not in self.random_types:
            return []
        return [Answer(answer=self.random_types[parts[1]]())]
```

#### Примеры использования

| Запрос | Результат |
|--------|-----------|
| `random string` | Случайная строка 8-32 символа |
| `random int` | Случайное целое число в диапазоне ±2³¹ |
| `random float` | Случайное дробное число |
| `random sha256` | SHA-256 хеш случайной строки |
| `random uuid` | UUID v4 |
| `random color` | Случайный HEX цвет (#RRGGBB) |

---

### Statistics (Статистические функции)

**Класс:** `searx.answerers.statistics.SXNGAnswerer`

Вычисляет статистические функции от переданных в запросе чисел. Активируется по ключевым словам: `min`, `max`, `avg`, `sum`, `prod`, `range`.

```python
id: str = 'statistics'
keywords: list[str] = ['min', 'max', 'avg', 'sum', 'prod', 'range']
```

#### Поддерживаемые функции

| Ключевое слово | Функция | Описание | Пример |
|---------------|---------|----------|--------|
| `min` | `min()` | Минимум из аргументов | `min 10 5 8` → `5` |
| `max` | `max()` | Максимум из аргументов | `max 10 5 8` → `10` |
| `avg` | среднее | Среднее арифметическое | `avg 123 548 2.04 24.2` → `164.385` |
| `sum` | сумма | Сумма всех аргументов | `sum 10 20 30` → `60` |
| `prod` | произведение | Перемножение всех аргументов | `prod 2 3 4` → `24` |
| `range` | размах | Разница между max и min | `range 10 5 8` → `5` |

#### Исходный код

```python
from functools import reduce
from operator import mul
import babel
import babel.numbers

kw2func = [
    ("min",   min),
    ("max",   max),
    ("avg",   lambda args: sum(args) / len(args)),
    ("sum",   sum),
    ("prod",  lambda args: reduce(mul, args, 1)),
    ("range", lambda args: max(args) - min(args)),
]

class SXNGAnswerer(Answerer):
    keywords = [kw for kw, _ in kw2func]

    def info(self):
        return AnswererInfo(
            name="Statistics",
            description="Compute min/max/avg/sum/prod/range of the arguments",
            keywords=self.keywords,
            examples=["avg 123 548 2.04 24.2"],
        )

    def answer(self, query: str) -> list[BaseAnswer]:
        results = []
        parts = query.split()
        if len(parts) < 2:
            return results

        # Парсинг чисел с учётом локализации (разделитель дробной части)
        ui_locale = babel.Locale.parse(sxng_request.preferences.get_value('locale'), sep='-')
        try:
            args = [babel.numbers.parse_decimal(num, ui_locale, numbering_system="latn")
                    for num in parts[1:]]
        except Exception:
            return results

        # Поиск ключевого слова (первый элемент) и вычисление
        for k, func in kw2func:
            if k == parts[0]:
                res = func(args)
                res = babel.numbers.format_decimal(res, locale=ui_locale)
                f_str = ', '.join(babel.numbers.format_decimal(arg, locale=ui_locale) for arg in args)
                results.append(Answer(answer=f"[{ui_locale}] {k}({f_str}) = {res}"))
                break

        return results
```

#### Примеры использования

| Запрос | Результат |
|--------|-----------|
| `min 10 5 8` | `min(10, 5, 8) = 5` |
| `max 10 5 8` | `max(10, 5, 8) = 10` |
| `avg 123 548 2.04 24.2` | `avg(123, 548, 2.04, 24.2) = 164.385` |
| `sum 10 20 30` | `sum(10, 20, 30) = 60` |
| `prod 2 3 4` | `prod(2, 3, 4) = 24` |
| `range 10 5 8` | `range(10, 5, 8) = 5` |

#### Локализация чисел

Statistics учитывает локаль пользователя через `babel`. Это означает:
- Точка и запятая обрабатываются как разделители дробной части в зависимости от локали
- Форматирование результата соответствует локали интерфейса

---

## Полный пример пользовательского ответчика

```python
from flask_babel import gettext as _
from searx.answerers import Answerer, AnswererInfo
from searx.result_types import Answer

class MyAnswerer(Answerer):
    keywords = ["hello", "greeting"]

    def info(self):
        return AnswererInfo(
            name=_("Hello Greeting"),
            description=_("Says hello to the user"),
            examples=["hello", "greeting"],
            keywords=self.keywords,
        )

    def answer(self, query: str) -> list[Answer]:
        return [Answer(answer="Hello!")]
```

---

## Ответчики vs Плагины — сравнение

| Характеристика | Answerers | Plugins |
|----------------|-----------|---------|
| **Когда выполняется** | До/вместо поиска по движкам | Во время обработки результатов |
| **Точка входа** | `ask(query)` | `pre_search`, `post_search`, `on_result` |
| **Результат** | Answer Results (область ответов) | Модификация Main Results |
| **Активация** | По ключевым словам в запросе | Автоматически при активном статусе |
| **Настройка** | Без настроек, загружаются автоматически | Через `plugins:` в settings.yml |
| **Примеры** | Random, Statistics | Calculator, Hash, Hostnames |

---

## Result Types — где отображается результат

Ответчики генерируют результаты типа `Answer` (Answer Results). Они отображаются в специальной области ответов на странице результатов поиска.

Связанные типы результатов:
- **MainResult** — основные результаты поиска
- **KeyValue** — ключевые значения из результатов
- **Code** — блоки кода
- **Paper** — научные статьи
- **File** — файлы
- **Answer** — ответы от Answerers (и плагинов)
- **Correction** — исправления запроса
- **Suggestion** — предложения
- **Infobox** — информационные блоки
