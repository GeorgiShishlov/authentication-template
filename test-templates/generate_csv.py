"""
Генерация нормализованных CSV-файлов из quiz_templates.json
Создаёт 4 файла: tests.csv, questions.csv, options.csv, results.csv
"""
import json
import csv
from pathlib import Path

BASE = Path(__file__).parent
SRC = BASE / "quiz_templates.json"

with open(SRC, encoding="utf-8") as f:
    data = json.load(f)

tests_rows = []
questions_rows = []
options_rows = []
results_rows = []

for test in data["tests"]:
    tid = test["id"]
    score_range = test.get("score_range", {})
    tests_rows.append({
        "test_id": tid,
        "title": test["title"],
        "subtitle": test.get("subtitle", ""),
        "description": test["description"],
        "scoring_type": test["scoring"],
        "score_min": score_range.get("min", ""),
        "score_max": score_range.get("max", ""),
    })

    for q_idx, q in enumerate(test["questions"], 1):
        questions_rows.append({
            "test_id": tid,
            "question_num": q_idx,
            "question_text": q["text"],
        })
        for o_idx, o in enumerate(q["options"], 1):
            if test["scoring"] == "max":
                # scores: {"choleric": 1} -> result_keys = "choleric"
                keys = ";".join(o["scores"].keys())
                options_rows.append({
                    "test_id": tid,
                    "question_num": q_idx,
                    "option_num": o_idx,
                    "option_text": o["text"],
                    "result_keys": keys,
                    "score": "",
                })
            else:  # sum_thresholds
                options_rows.append({
                    "test_id": tid,
                    "question_num": q_idx,
                    "option_num": o_idx,
                    "option_text": o["text"],
                    "result_keys": "",
                    "score": o["score"],
                })

    # results / ranges
    if test["scoring"] == "max":
        for r in test["results"]:
            results_rows.append({
                "test_id": tid,
                "result_key": r["key"],
                "title": r["title"],
                "subtitle": r.get("subtitle", ""),
                "description": r["description"],
                "score_min": "",
                "score_max": "",
            })
    else:
        for r in test["ranges"]:
            results_rows.append({
                "test_id": tid,
                "result_key": r["key"],
                "title": r["title"],
                "subtitle": r.get("subtitle", ""),
                "description": r["description"],
                "score_min": r["min"],
                "score_max": r["max"],
            })


def write_csv(name, rows, fields):
    path = BASE / name
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields, quoting=csv.QUOTE_ALL)
        w.writeheader()
        w.writerows(rows)
    print(f"  {name}: {len(rows)} rows")


print("Generating CSVs...")
write_csv("tests.csv", tests_rows,
         ["test_id", "title", "subtitle", "description", "scoring_type", "score_min", "score_max"])
write_csv("questions.csv", questions_rows,
         ["test_id", "question_num", "question_text"])
write_csv("options.csv", options_rows,
         ["test_id", "question_num", "option_num", "option_text", "result_keys", "score"])
write_csv("results.csv", results_rows,
         ["test_id", "result_key", "title", "subtitle", "description", "score_min", "score_max"])
print("Done.")
