# Result Types — типы результатов SearXNG

## Обзор

Result Types (типы результатов) — это система типизации объектов результатов поиска в SearXNG. С 2013 года результаты представляли собой простые словари без типизации, что затрудняло разработку новых функций и поддержку кода. Система типов `searx.result_types` решает эту проблему, предоставляя классы с чёткими полями для каждого типа результата.

**Модуль:** `searx.result_types`
**Исходный код:** [searx/result_types/](https://github.com/searxng/searxng/blob/master/searx/result_types/)

### Иерархия типов

```
Result (базовый)
├── LegacyResult          # не типизированные результаты (словари)
└── MainResult            # основные результаты поиска
    ├── KeyValue          # таблица ключ-значение
    ├── Code              # блоки кода
    ├── Paper             # научные статьи
    └── File              # файлы

BaseAnswer                # базовый класс ответов
├── Answer                # простой текстовый ответ
├── Translations          # переводы
├── WeatherAnswer         # погода
└── AnswerSet             # агрегатор BaseAnswer в контейнере результатов

Correction                # исправления запроса (словарь)
Suggestion                # предложения (словарь)
Infobox                   # информационные блоки (словарь)
```

### Области отображения

Результаты каждого типа отображаются в определённой области:

| Область | Типы результатов | Описание |
|---------|------------------|----------|
| **Main Results** | `MainResult`, `KeyValue`, `Code`, `Paper`, `File` | Основной список результатов поиска |
| **Answers** | `Answer`, `Translations`, `WeatherAnswer` | Краткие ответы на запрос |
| **Infobox** | `Infobox` (dict) | Дополнительная информация (карточки Wikipedia, карты и т.д.) |
| **Suggestions** | `Suggestion` (dict) | Альтернативные поисковые термины |
| **Corrections** | `Correction` (dict) | Исправления орфографии / альтернативные формулировки |

---

## Result — базовый класс всех результатов

```python
class searx.result_types._base.Result:
    url: str | None = None
    engine: str | None = ''
    parsed_url: ParseResult | None = None
```

Базовый класс для всех типов результатов. Содержит общие поля: `url` — ссылка на результат, `engine` — имя движка, вернувшего результат, `parsed_url` — распарсенный URL через `urllib.parse.ParseResult`.

---

## LegacyResult — не типизированные результаты

```python
class searx.result_types._base.LegacyResult:
    # Используется внутренне для результатов без типизации
    # Шаблоны служат ориентиром до полной типизации
```

`LegacyResult` используется для результатов, которые ещё не прошли через систему типов. Это обратная совместимость с legacy-словарями. Шаблоны (`default.html`, `images.html`, `videos.html`, `torrent.html`, `map.html`, `packages`, `products`) служат ориентиром до полной типизации всех типов.

---

## MainResult — основные результаты поиска

```python
class searx.result_types._base.MainResult:
    template: str = 'default.html'
    title: str = ''
    content: str = ''
    img_src: str = ''
    iframe_src: str = ''
    audio_src: str = ''
    thumbnail: str = ''
    publishedDate: datetime | None = None
    pubdate: str = ''
    length: timedelta | None = None
    views: str = ''
    author: str = ''
    metadata: str = ''
    priority: Literal['', 'high', 'low'] = ''
    engines: set[str] = <factory>
    open_group: bool = False
    close_group: bool = False
    positions: list[int] = <factory>
    score: float = 0
    category: str = ''

    def normalize_result_fields(self) -> None: ...
```

Базовый класс для всех результатов, отображаемых в основной области поиска. По умолчанию использует шаблон `result_templates/default.html`.

### Поля MainResult

| Поле | Тип | Описание |
|------|-----|----------|
| `template` | `str` | Имя шаблона для рендеринга (по умолing: `'default.html'`) |
| `title` | `str` | Заголовок / текст ссылки результата |
| `content` | `str` | Извлечение или описание результата |
| `img_src` | `str` | URL изображения, отображаемого в результате |
| `iframe_src` | `str` | URL встроенного `<iframe>` (сворачиваемый) |
| `audio_src` | `str` | URL встроенного аудио (`<audio controls>`) |
| `thumbnail` | `str` | URL миниатюры, отображаемой в результате |
| `publishedDate` | `datetime \| None` | Дата публикации материала |
| `pubdate` | `str` | Строковое представление даты (deprecated) |
| `length` | `timedelta \| None` | Продолжительность воспроизведения в секундах |
| `views` | `str` | Количество просмотров в human-readable формате |
| `author` | `str` | Автор материала |
| `metadata` | `str` | Разная дополнительная метаданные |
| `priority` | `Literal['', 'high', 'low']` | Приоритет (устанавливается плагином Hostnames) |
| `engines` | `set[str]` | Имена движков, вернувших этот результат в объединённом списке |
| `open_group` | `bool` | Разметка группы результатов |
| `close_group` | `bool` | Разметка группы результатов |
| `positions` | `list[int]` | Позиции результата в разных движках |
| `score` | `float` | Оценка релевантности |
| `category` | `str` | Категория результата |

### Методы

**`normalize_result_fields()`** — нормализует поля `url` и `parse_url`:
- Если поле `url` установлено, а `parsed_url` нет — инициализирует `parsed_url` из `url`
- Поле `url` инициализируется результатом из `parsed_url`, если они различаются

---

## KeyValue Results — таблица ключ-значение

```python
class searx.result_types.keyvalue.KeyValue:
    # Наследует все поля MainResult + дополнительные:
    template: str = 'keyvalue.html'
    kvmap: dict[str, Any] | OrderedDict[str, Any]
    caption: str = ''
    key_title: str = ''
    value_title: str = ''
```

Отображается через шаблон `result_templates/keyvalue.html`. Представляет простую таблицу с двумя столбцами: ключи (первый столбец) и значения (второй столбец). Наследует все поля `MainResult`.

### Поля KeyValue

| Поле | Тип | Описание |
|------|-----|----------|
| `kvmap` | `dict[str, Any] \| OrderedDict[str, Any]` | Словарь с ключами и значениями. Для сохранения порядка использовать `OrderedDict` |
| `caption` | `str` | Опциональная подпись для результата |
| `key_title` | `str` | Заголовок столбца ключей |
| `value_title` | `str` | Заголовок столбца значений |

### Пример использования

```python
KeyValue(
    title="Characteristics",
    kvmap={
        "CPU": "Intel i7-10700K",
        "RAM": "32 GB DDR4",
        "GPU": "NVIDIA RTX 3080"
    },
    caption="System Specifications",
    key_title="Parameter",
    value_title="Value"
)
```

---

## Code Results — блоки кода

```python
class searx.result_types.code.Code:
    # Наследует все поля MainResult + дополнительные:
    template: str = 'code.html'
    repository: str | None = None
    codelines: list[tuple[int, str]] = <factory>
    hl_lines: set[int] = <factory>
    code_language: str = '<guess>'
    filename: str | None = None
    strip_newlines: bool = True
    strip_whitespace: bool = False

    def HTML(**options) -> str: ...
```

Отображается через шаблон `result_templates/code.html`. Для подсветки синтаксиса используется [Pygments](https://pygments.org). Наследует все поля `MainResult`.

### Поля Code

| Поле | Тип | Описание |
|------|-----|----------|
| `repository` | `str \| None` | Ссылка на репозиторий, связанный с результатом |
| `codelines` | `list[tuple[int, str]]` | Список строк кода: кортеж `(номер_строки, текст_строки)` |
| `hl_lines` | `set[int]` | Номера строк для подсветки (highlight) |
| `code_language` | `str` | Имя лексера Pygments (`'text'`, `'python'`, `'javascript'` и т.д.). Значение `'&lt;guess&gt;'` автоматически определяет язык по `filename` или содержимому |
| `filename` | `str \| None` | Имя файла — помогает определить язык кода для `<guess>` |
| `strip_newlines` | `bool` | Удалять начальные и конечные пустые строки (по умолing: `True`) |
| `strip_whitespace` | `bool` | Удалять весь начальный/конечный пробельный код (по умолing: `False`). Включение может нарушить отступы кода |

### Методы

**`HTML(**options) -> str`** — рендерит HTML-код с подсветкой синтаксиса. Дополнительные параметры передаются в `HtmlFormatter` Pygments.

### Определение языка кода

При `code_language='&lt;guess&gt;' применяется следующая логика:
1. Если `filename` установлен → `pygments.lexers.guess_lexer_for_filename()`
2. Иначе → `pygments.lexers.guess_lexer()` по содержимому
3. При неудаче → fallback на `'text'`

### Пример использования

```python
Code(
    title="example.py",
    repository="https://github.com/user/repo",
    codelines=[
        (1, "def hello(name):"),
        (2, '    print(f"Hello, {name}!")'),
        (3, ""),
        (4, "hello('World')")
    ],
    hl_lines={2},
    code_language='python',
    filename="example.py"
)
```

---

## Paper Results — научные статьи

```python
class searx.result_types.paper.Paper:
    # Наследует все поля MainResult + дополнительные:
    template: str = 'paper.html'
    date_of_publication: DateTime | None = None
    comments: str = ''
    tags: list[str] = <factory>
    type: str = ''
    authors: list[str] | set[str] = <factory>
    editor: str = ''
    publisher: str = ''
    journal: str = ''
    volume: str | int = ''
    pages: str = ''
    number: str = ''
    doi: str = ''
    issn: list[str] = <factory>
    isbn: list[str] = <factory>
    pdf_url: str = ''
    html_url: str = ''
```

Отображается через шаблон `result_templates/paper.html`. Подходит для отображения научных статей и других документов. Связан с [BibTeX field types](https://en.wikipedia.org/wiki/BibTeX#Field_Types) и форматом BibTeX. Наследует все поля `MainResult`.

### Поля Paper

| Поле | Тип | Описание |
|------|-----|----------|
| `date_of_publication` | `DateTime \| None` | Дата публикации документа |
| `comments` | `str` | Произвольный текст, отображаемый курсивом под содержанием |
| `tags` | `list[str]` | Свободный список тегов |
| `type` | `str` | Краткое описание типа носителя (например: `'book'`, `'pdf'`, `'html'`) |
| `authors` | `list[str] \| set[str]` | Список авторов работы (с суффиксом «s» — множественное; поле `author` из MainResult — для единственного автора) |
| `editor` | `str` | Редактор книги/статьи |
| `publisher` | `str` | Издатель |
| `journal` | `str` | Название журнала или издания |
| `volume` | `str \| int` | Номер тома |
| `pages` | `str` | Диапазон страниц статьи |
| `number` | `str` | Номер отчёта или номер выпуска журнала |
| `doi` | `str` | DOI номер (например: `'10.1038/d41586-018-07848-2'`) |
| `issn` | `list[str]` | Список ISSN номеров (например: `['1476-4687']`) |
| `isbn` | `list[str]` | Список ISBN номеров (например: `['9780201896831']`) |
| `pdf_url` | `str` | URL полной версии статьи в PDF |
| `html_url` | `str` | URL полной версии статьи в HTML |

### Пример использования

```python
Paper(
    title="Attention Is All You Need",
    authors=["Vaswani, A.", "Shazeer, N.", "Parmar, N."],
    journal="Advances in Neural Information Processing Systems",
    volume="31",
    doi="10.48550/arXiv.1706.03762",
    date_of_publication=DateTime(year=2017),
    type="pdf",
    tags=["transformer", "neural networks", "attention"],
    pdf_url="https://arxiv.org/pdf/1706.03762.pdf"
)
```

---

## File Results — файлы

```python
class searx.result_types.file.File:
    # Наследует все поля MainResult + дополнительные:
    template: str = 'file.html'
    filename: str = ''
    size: str = ''
    time: str = ''
    mimetype: str = ''
    abstract: str = ''
    embedded: str = ''
    mtype: str = ''
    subtype: str = ''
```

Отображается через шаблон `result_templates/file.html`. Класс для результатов типа файлов. Наследует все поля `MainResult` (кроме `author`, который перемещён в конец списка параметров конструктора).

### Поля File

| Поле | Тип | Описание |
|------|-----|----------|
| `filename` | `str` | Имя файла |
| `size` | `str` | Размер в байтах в human-readable формате (`'MB'` для 1024×1024 байт) |
| `time` | `str` | Время: дата последнего изменения или создания. Простая строка, формат зависит от контекста |
| `mimetype` | `str \| None` | MIME-тип/подтип файла. Для `audio` и `video` URL передаётся в поле `embedded`. Если значение не указано — MIME-тип определяется из `filename` или `embedded` |
| `abstract` | `str` | Аннотация (резюме) файла |
| `embedded` | `str` | URL встроенного медиа (audio/video) — сворачиваемый |
| `mtype` | `str` | Используется для отображения `embedded`. Автоматически заполняется из базового типа `mimetype`. Можно явно установить `'audio'` или `'video'`, если mimetype например `'application/ogg'` |
| `subtype` | `str` | Используется для отображения `embedded`. Автоматически заполняется из подтипа `mimetype`. Можно явно установить подтип для элемента `embedded` |

### Пример использования

```python
File(
    title="document.pdf",
    filename="report_2024.pdf",
    size="2.5 MB",
    time="2024-12-15",
    mimetype="application/pdf",
    abstract="Annual financial report for fiscal year 2024"
)
```

---

## Answer Results — область ответов

Область ответов (Answer area) отображает краткую информацию, найденную по поисковому запросу. Результаты рендерятся в шаблоне [answers.html](https://github.com/searxng/searxng/blob/master/searx/templates/simple/elements/answers.html).

### BaseAnswer — базовый класс ответов

```python
class searx.result_types.answer.BaseAnswer:
    url: str | None = None
    engine: str | None = ''
    parsed_url: ParseResult | None = None
```

Базовый класс для всех типов ответов. Абстрактный — экземпляры этого класса не создаются напрямую. Наследует `Result`.

### Answer — простой текстовый ответ

```python
class searx.result_types.answer.Answer(BaseAnswer):
    template: str = 'answer/legacy.html'
    answer: str
```

Простой тип ответа, где `answer` — строка с дополнительным полем `url` для ссылки на ресурс (статья, карта и т.д.).

| Поле | Тип | Описание |
|------|-----|----------|
| `template` | `str` | Шаблон: `'answer/legacy.html'` |
| `answer` | `str` | Текст ответа |

### Translations — переводы

```python
class searx.result_types.answer.Translations(BaseAnswer):
    template: str = 'answer/translations.html'
    translations: list[Translations.Item]
```

Тип ответа со списком переводов. Шаблон: `answer/translations.html`.

| Поле | Тип | Описание |
|------|-----|----------|
| `template` | `str` | Шаблон: `'answer/translations.html'` |
| `translations` | `list[Item]` | Список переводов |

#### Translations.Item

```python
class Translations.Item:
    text: str                    # Переведённый текст (обязательное)
    transliteration: str = ''    # Транслитерация
    examples: list[str] = <factory>  # Примеры использования
    definitions: list[str] = <factory>   # Определения
    synonyms: list[str] = <factory>      # Синонимы
```

### WeatherAnswer — погода

```python
class searx.result_types.answer.WeatherAnswer(BaseAnswer):
    template: str = 'answer/weather.html'
    current: WeatherAnswer.Item
    forecasts: list[WeatherAnswer.Item] = <factory>
    service: str = ''
```

Тип ответа для данных о погоде. Шаблон: `answer/weather.html`.

| Поле | Тип | Описание |
|------|-----|----------|
| `template` | `str` | Шаблон: `'answer/weather.html'` |
| `current` | `Item` | Текущая погода в локации |
| `forecasts` | `list[Item]` | Прогнозы погоды для локации |
| `service` | `str` | Сервис погоды, откуда получены данные |

#### WeatherAnswer.Item

```python
class WeatherAnswer.Item:
    location: GeoLocation        # Гео-локация (например: "Berlin, Germany")
    temperature: Temperature     # Температура воздуха на высоте 2м
    condition: Literal['clear sky', 'partly cloudy', 'cloudy', 'fair', 'fog', ...]
                                # Стандардизированное состояние погоды
    datetime: DateTime | None    # Время прогноза (не нужно для текущей погоды)
    summary: str | None          # Однострочное описание прогноза
    feels_like: Temperature | None   # Ощущаемая температура
    pressure: Pressure | None        # Давление на уровне моря (например: 1030 hPa)
    humidity: RelativeHumidity | None  # Относительная влажность в % (на высоте 2м)
    wind_from: Compass           # Направление ветра (откуда дует)
    wind_speed: WindSpeed | None     # Скорость ветра на высоте 10м (10-минутное среднее)
    cloud_cover: int | None      # Облачность в % (для всех высот)

    @property
    def url(self) -> str | None:   # Data URL с символом погоды
```

Состояния погоды (`condition`): `'clear sky'`, `'partly cloudy'`, `'cloudy'`, `'fair'`, `'fog'`, `'light rain'`, `'rain'`, `'heavy rain'`, `'snow'`, `'heavy snow'`, `'sleet'`, `'heavy sleet'` и их варианты с `'and thunder'` / `'showers'`.

### AnswerSet — агрегатор ответов

```python
class searx.result_types.answer.AnswerSet:
    # Агрегатор для BaseAnswer элементов в контейнере результатов
```

Класс-агрегатор для `BaseAnswer` элементов. Используется для группировки нескольких ответов в контейнере результатов.

### Пример использования

```python
# Простой ответ
Answer(answer="The capital of France is Paris.", url="https://en.wikipedia.org/wiki/Paris")

# Перевод
Translations(
    translations=[
        Translations.Item(
            text="Bonjour",
            synonyms=["Hi", "Hey"],
            examples=["Bonjour, comment allez-vous?"],
            definitions=["French greeting used during the day"]
        )
    ],
    url="https://www.deepl.com/translator"
)

# Погода
WeatherAnswer(
    current=WeatherAnswer.Item(
        location=GeoLocation(lat=52.52, lon=13.405),
        temperature=Temperature(value=18.5, unit="C"),
        condition="partly cloudy",
        feels_like=Temperature(value=17.0, unit="C"),
        wind_speed=WindSpeed(value=12.5, unit="km/h"),
        wind_from=Compass(degrees=240),
        humidity=RelativeHumidity(percent=65)
    ),
    service="OpenWeatherMap"
)
```

---

## Correction Results — исправления запроса

Область corrections показывает пользователю альтернативные поисковые термины, обычно возникающие из-за исправлений орфографии. Типизация ещё не реализована — используется структура словаря. Шаблон: [corrections.html](https://github.com/searxng/searxng/blob/master/searx/templates/simple/elements/corrections.html).

### Структура Correction

Базовая структура — простой словарь с одним ключом:

```python
{"correction": "lorem ipsum ..."}
```

Из этого создаётся расширенная структура:

```python
{
    "url": "!bang lorem ipsum ...",   # Не URL, а значение для HTML-формы SearXNG query
    "title": "lorem ipsum ..."        # Исправленный поисковый термин
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | `str` | Исправленный поисковый термин |
| `url` | `str` | Значение для вставки в HTML-форму SearXNG query (не настоящий URL) |

---

## Suggestion Results — предложения

Область suggestions показывает пользователю альтернативные поисковые термины. Можно кликнуть на предложение, и поиск будет выполнен с этим термином. Типизация ещё не реализована — используется структура словаря. Шаблон: [suggestions.html](https://github.com/searxng/searxng/blob/master/searx/templates/simple/elements/suggestions.html).

### Структура Suggestion

Базовая структура — простой словарь с одним ключом:

```python
{"suggestion": "lorem ipsum ..."}
```

Из этого создаётся расширенная структура (использует RawTextQuery для получения URL с тем же bang):

```python
{
    "url": "!bang lorem ipsum ...",   # Значение для HTML-формы SearXNG query
    "title": "lorem ipsum"            # Предложенный поисковый термин
}
```

| Поле | Тип | Описание |
|------|-----|----------|
| `title` | `str` | Предложенный поисковый термин |
| `url` | `str` | Значение для вставки в HTML-форму SearXNG query (не настоящий URL) |

---

## Infobox Results — информационные блоки

Область infobox показывает дополнительную информацию пользователю: выдержки из Wikipedia, карты и другие источники. Типизация ещё не реализована — используется структура словаря. Шаблон элементов: [infobox.html](https://github.com/searxng/searxng/blob/master/searx/templates/simple/elements/infobox.html).

### Поля Infobox

| Поле | Тип | Описание |
|------|-----|----------|
| `img_src` | `str` | URL изображения или миниатюры в infobox |
| `infobox` | `str` | Заголовок информационного блока |
| `content` | `str` | Текст информационного блока |

### Подсекции Infobox

#### Attributes (Атрибуты)

```python
attributes: list[dict]
```

Список атрибутов. Атрибут — словарь с ключами:

| Ключ | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `label` | `str` | Да | Метка атрибута |
| `value` | `str` | Да | Значение атрибута |
| `image` | `list[dict]` | Нет | Список изображений |

Каждое изображение — словарь с ключами:

| Ключ | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `src` | `str` | Да | URL изображения/миниатюры |
| `alt` | `str` | Да | Альтернативный текст |

#### URLs (Ссылки)

```python
urls: list[dict]
```

Список ссылок. Каждая ссылка — словарь:

| Ключ | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `url` | `str` | Да | URL ссылки |
| `title` | `str` | Да | Заголовок ссылки |

#### Related Topics (Связанные темы)

```python
relatedTopics: list[dict]
```

Список тем. Каждая тема — словарь:

| Ключ | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `name` | `str` | Да | Название темы |
| `suggestions` | `list[dict]` | Нет | Список предложений |

Каждое предложение — простой словарь с одним ключом:

| Ключ | Тип | Обязательно | Описание |
|------|-----|-------------|----------|
| `suggestion` | `str` | Да | Предложенный поисковый термин |

### Пример Infobox

```python
{
    "img_src": "https://example.com/image.jpg",
    "infobox": "Albert Einstein",
    "content": "German-born theoretical physicist...",
    "attributes": [
        {"label": "Born", "value": "March 14, 1879"},
        {"label": "Died", "value": "April 18, 1955"},
        {
            "label": "Photo",
            "image": [{"src": "https://example.com/einstein.jpg", "alt": "Einstein portrait"}]
        }
    ],
    "urls": [
        {"url": "https://en.wikipedia.org/wiki/Einstein", "title": "Wikipedia"},
        {"url": "https://www.nobelprize.org/einstein", "title": "Nobel Prize"}
    ],
    "relatedTopics": [
        {
            "name": "Physics",
            "suggestions": [{"suggestion": "quantum mechanics"}, {"suggestion": "relativity"}]
        }
    ]
}
```

---

## Полный пример агрегации результатов

```python
from searx.result_types import MainResult, Code, Paper, File, Answer, WeatherAnswer
from searx.result_types.answer import Translations

# Основной результат поиска
results = [
    MainResult(
        title="SearXNG — GitHub",
        url="https://github.com/searxng/searxng",
        content="SearXNG is a free privacy-res..."
    ),

    # Код из репозитория
    Code(
        title="result_types.py",
        repository="https://github.com/searxng/searxng",
        codelines=[
            (1, "class MainResult:"),
            (2, "    template: str = 'default.html'"),
            (3, "    title: str = ''")
        ],
        code_language='python',
        filename="result_types.py"
    ),

    # Научная статья
    Paper(
        title="Attention Is All You Need",
        authors=["Vaswani, A.", "Shazeer, N."],
        journal="NeurIPS 2017",
        doi="10.48550/arXiv.1706.03762",
        pdf_url="https://arxiv.org/pdf/1706.03762.pdf"
    ),

    # Файл для скачивания
    File(
        title="report.pdf",
        filename="annual_report_2024.pdf",
        size="3.2 MB",
        mimetype="application/pdf"
    ),
]

# Ответы (отдельный контейнер)
answers = [
    Answer(answer="The capital of Germany is Berlin."),
    WeatherAnswer(
        current=WeatherAnswer.Item(
            temperature=Temperature(value=-5, unit="C"),
            condition="snow",
            wind_speed=WindSpeed(value=15, unit="km/h")
        ),
        service="OpenWeatherMap"
    ),
    Translations(translations=[
        Translations.Item(text="Bonjour", synonyms=["Hi"])
    ])
]

# Corrections и Suggestions (словари)
corrections = [{"url": "!berlín", "title": "berlín"}]
suggestions = [{"url": "!berlin germany", "title": "berlin germany"}]
infobox = {
    "img_src": "https://example.com/berlin.jpg",
    "infobox": "Berlin",
    "content": "Capital city of Germany...",
    "attributes": [{"label": "Population", "value": "3.7 million"}],
    "urls": [
        {"url": "https://en.wikipedia.org/wiki/Berlin", "title": "Wikipedia"}
    ]
}
```

---

## Связь с источниками результатов

Все источники (engines, plugins, answerers) могут добавлять результаты в любые области:

| Источник | Основная область | Примечание |
|----------|-----------------|------------|
| **Engines** | Main Results | Движки заполняют основной список результатов |
| **Answerers** | Answers | Ответчики генерируют Answer Results |
| **Plugins** | Любая область | Плагины могут фильтровать и модифицировать результаты (например, плагин Hostnames меняет URL) |

---

## Текущее состояние типизации

Система типов находится в стадии разработки. Статус:

| Тип | Статус |
|-----|--------|
| `Result` / `LegacyResult` | ✅ Реализовано |
| `MainResult` | ✅ Реализовано |
| `KeyValue` | ✅ Реализовано |
| `Code` | ✅ Реализовано |
| `Paper` | ✅ Реализовано |
| `File` | ✅ Реализовано |
| `BaseAnswer` / `Answer` | ✅ Реализовано |
| `Translations` | ✅ Реализовано |
| `WeatherAnswer` | ✅ Реализовано |
| `AnswerSet` | ✅ Реализовано |
| `Correction` | ⚠️ Словарная структура (без класса) |
| `Suggestion` | ⚠️ Словарная структура (без класса) |
| `Infobox` | ⚠️ Словарная структура (без класса) |

Типизация `Correction`, `Suggestion` и `Infobox` ещё не реализована — шаблоны служат ориентиром для определения структуры.

---

## Исходный код модуля

Файл: [searx/result_types/__init__.py](https://github.com/searxng/searxng/blob/master/searx/result_types/__init__.py)

```python
__all__ = [
    "Result",
    "MainResult",
    "KeyValue",
    "EngineResults",
    # ... и подмодули: code, file, keyvalue, paper, answer
]
```

Подмодули:
- `searx.result_types._base` — `Result`, `LegacyResult`, `MainResult`
- `searx.result_types.code` — `Code`
- `searx.result_types.file` — `File`
- `searx.result_types.keyvalue` — `KeyValue`
- `searx.result_types.paper` — `Paper`
- `searx.result_types.answer` — `BaseAnswer`, `Answer`, `Translations`, `WeatherAnswer`, `AnswerSet`
