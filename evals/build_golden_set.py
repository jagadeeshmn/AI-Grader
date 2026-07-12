"""Builds evals/golden_set.json from instructor-graded submissions.

Ground truth = rows in `grades` with source='instructor' belonging to the
eval-student-* seed accounts (see src/db/seed-golden.ts).

Usage: DATABASE_URL=postgres://... python build_golden_set.py
"""

import json
import os
import sys
from pathlib import Path

import psycopg

QUERY = """
SELECT
  s.id                AS submission_id,
  s.student_id        AS student_id,
  a.title             AS assignment_title,
  g.total_score       AS total_score,
  g.max_score         AS max_score,
  g.criterion_scores  AS criterion_scores
FROM grades g
JOIN submissions s ON s.id = g.submission_id
JOIN assignments a ON a.id = s.assignment_id
WHERE g.source = 'instructor'
  AND s.student_id LIKE 'eval-student-%'
ORDER BY a.title, s.student_id
"""


def main() -> None:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        sys.exit("DATABASE_URL is required")

    with psycopg.connect(dsn) as conn, conn.cursor() as cur:
        cur.execute(QUERY)
        rows = cur.fetchall()

    items = [
        {
            "submissionId": submission_id,
            "studentId": student_id,
            "assignmentTitle": assignment_title,
            "groundTruth": {
                "totalScore": total_score,
                "maxScore": max_score,
                "criterionScores": criterion_scores,
            },
        }
        for (
            submission_id,
            student_id,
            assignment_title,
            total_score,
            max_score,
            criterion_scores,
        ) in rows
    ]

    out = Path(__file__).parent / "golden_set.json"
    out.write_text(json.dumps(items, indent=2))
    print(f"Wrote {len(items)} golden items to {out}")


if __name__ == "__main__":
    main()
