# Шаблоны тестов — структура импорта

5 готовых тестов в двух форматах: единый JSON и нормализованные CSV.

## Файлы

- **quiz_templates.json** — единый файл, удобно для NoSQL/document-БД или прямого парсинга в коде.
- **tests.csv / questions.csv / options.csv / results.csv** — нормализованная схема для реляционных БД (PostgreSQL, MySQL, SQLite). UTF-8 с BOM, разделитель `,`, все строки в двойных кавычках.
- **generate_csv.py** — скрипт, конвертирующий JSON → CSV. Запускать после правки JSON.

## Список тестов

| id              | title                                | вопросов | результатов | scoring         |
|-----------------|--------------------------------------|----------|-------------|-----------------|
| temperament     | Тип темперамента                     | 6        | 4           | max             |
| love_languages  | Какой у тебя язык любви?             | 6        | 5           | max             |
| career_fit      | Какая профессия тебе подойдёт?       | 6        | 6           | max             |
| burnout         | Уровень эмоционального выгорания     | 7        | 4 диапазона | sum_thresholds  |
| archetype       | Какой ты архетип личности?           | 6        | 6           | max             |

## Два типа подсчёта

### `max` (4 из 5 тестов)
Каждый ответ добавляет 1 балл одному `result_key`. Победитель — ключ с максимальной суммой. При равенстве — первый по порядку в `results`.

```python
scores = {}
for ans in answers:
    for key, val in ans["scores"].items():
        scores[key] = scores.get(key, 0) + val
winner = max(scores, key=scores.get)
```

### `sum_thresholds` (тест на выгорание)
Все баллы суммируются. Сумма попадает ровно в один диапазон `ranges` (включительно с обеих сторон).

```python
total = sum(ans["score"] for ans in answers)
result = next(r for r in ranges if r["min"] <= total <= r["max"])
```

## Схема CSV (для SQL)

```sql
CREATE TABLE tests (
  test_id       TEXT PRIMARY KEY,
  title         TEXT,
  subtitle      TEXT,
  description   TEXT,
  scoring_type  TEXT,  -- 'max' | 'sum_thresholds'
  score_min     INT,   -- только для sum_thresholds
  score_max     INT
);

CREATE TABLE questions (
  test_id        TEXT REFERENCES tests(test_id),
  question_num   INT,
  question_text  TEXT,
  PRIMARY KEY (test_id, question_num)
);

CREATE TABLE options (
  test_id       TEXT,
  question_num  INT,
  option_num    INT,
  option_text   TEXT,
  result_keys   TEXT,  -- для 'max': ключ результата (через ; если несколько)
  score         INT,   -- для 'sum_thresholds': числовой балл
  PRIMARY KEY (test_id, question_num, option_num),
  FOREIGN KEY (test_id, question_num) REFERENCES questions
);

CREATE TABLE results (
  test_id       TEXT,
  result_key    TEXT,
  title         TEXT,
  subtitle      TEXT,
  description   TEXT,
  score_min     INT,   -- только для sum_thresholds (диапазон)
  score_max     INT,
  PRIMARY KEY (test_id, result_key)
);
```

## Что в текстах результатов

Каждый результат содержит:
- **title** — заголовок («Холерик», «Слова поддержки», «Творец»)
- **subtitle** — подзаголовок-крючок («Огонь и инициатива», «Любовь в словах»)
- **description** — основной текст: характеристика + сильные стороны + зоны роста / тень архетипа / конкретные подходящие роли (для career_fit) / план действий (для burnout). Поддерживает `\n\n` для абзацев.

## Правки

Вноси изменения в `quiz_templates.json` → запускай `python3 generate_csv.py` → CSV-файлы перегенерируются.
