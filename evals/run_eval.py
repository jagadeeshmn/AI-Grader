"""Runs the grading eval: each golden item x mode x N runs via the
/api/eval/grade route, then prints a single-vs-agentic comparison table.

Reporting only — no thresholds, no CI gating.

Usage:
  EVAL_SECRET=... python run_eval.py --runs 3
Env:
  EVAL_URL (default http://localhost:3000/api/eval/grade), EVAL_SECRET
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import requests

from metrics import aggregate


def call_eval(url: str, secret: str, submission_id: int, mode: str, timeout: int):
    resp = requests.post(
        url,
        json={"submissionId": submission_id, "mode": mode},
        headers={"x-eval-secret": secret},
        timeout=timeout,
    )
    resp.raise_for_status()
    return resp.json()


def run_once(url, secret, item, mode, run_idx, timeout):
    for attempt in (1, 2):  # retry once on 5xx/timeout
        try:
            data = call_eval(url, secret, item["submissionId"], mode, timeout)
            return {
                "submissionId": item["submissionId"],
                "assignmentTitle": item["assignmentTitle"],
                "studentId": item["studentId"],
                "mode": mode,
                "run": run_idx,
                "totalScore": data["result"]["totalScore"],
                "maxScore": data["result"]["maxScore"],
                "criterionScores": data["result"]["criterionScores"],
                "groundTruth": item["groundTruth"],
                "usage": data["usage"],
                "latencyMs": data["latencyMs"],
                "revisionCount": data.get("revisionCount", 0),
                "critiqueVerdict": data.get("critiqueVerdict", "none"),
                "needsReview": data.get("needsReview", False),
            }
        except (requests.HTTPError, requests.Timeout, requests.ConnectionError) as e:
            status = getattr(getattr(e, "response", None), "status_code", None)
            if attempt == 1 and (status is None or status >= 500):
                print(f"    retrying after error: {e}")
                time.sleep(2)
                continue
            print(f"    FAILED: {e}")
            return None
    return None


def fmt(value, kind):
    if kind == "pct":
        return f"{value * 100:.1f}%"
    if kind == "num1":
        return f"{value:.1f}"
    if kind == "num2":
        return f"{value:.2f}"
    if kind == "int":
        return f"{value:,.0f}"
    if kind == "s":
        return f"{value / 1000:.1f}s"
    return str(value)


TABLE_ROWS = [
    ("Runs (items x repeats)", "runs", "int", False),
    ("Mean total-score error (% of max)", "mean_total_error_pct", "num1", False),
    ("Median total-score error (% of max)", "median_total_error_pct", "num1", False),
    ("Runs within 1 pt of instructor", "frac_within_1pt", "pct", False),
    ("Per-criterion within 1 pt", "per_criterion_within1", "pct", False),
    ("Per-criterion exact match", "per_criterion_exact", "pct", False),
    ("Unmatched criteria (total)", "per_criterion_unmatched", "int", False),
    ("Consistency: mean std-dev of total", "mean_total_score_std", "num2", False),
    ("Mean input tokens / run", "mean_input_tokens", "int", False),
    ("Mean cache-read tokens / run", "mean_cache_read_tokens", "int", False),
    ("Mean cache-write tokens / run", "mean_cache_write_tokens", "int", False),
    ("Mean output tokens / run", "mean_output_tokens", "int", False),
    ("Mean LLM calls / run", "mean_llm_calls", "num1", False),
    ("Mean latency", "mean_latency_ms", "s", False),
    ("p50 latency", "p50_latency_ms", "s", False),
    ("Revision-trigger rate", "revision_trigger_rate", "pct", True),
    ("Mean revision count", "mean_revision_count", "num2", True),
    ("Needs-review rate", "needs_review_rate", "pct", True),
]


def print_table(summary: dict, modes: list[str]):
    header = "| Metric | " + " | ".join(modes) + " |"
    sep = "|---" * (len(modes) + 1) + "|"
    print("\n" + header)
    print(sep)
    for label, key, kind, agentic_only in TABLE_ROWS:
        cells = []
        for mode in modes:
            if agentic_only and mode == "single":
                cells.append("—")
            else:
                cells.append(fmt(summary[mode][key], kind))
        print(f"| {label} | " + " | ".join(cells) + " |")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--runs", type=int, default=3)
    parser.add_argument("--modes", nargs="+", default=["single", "agentic"])
    parser.add_argument("--golden", default=str(Path(__file__).parent / "golden_set.json"))
    parser.add_argument("--timeout", type=int, default=300)
    args = parser.parse_args()

    url = os.environ.get("EVAL_URL", "http://localhost:3000/api/eval/grade")
    secret = os.environ.get("EVAL_SECRET")
    if not secret:
        sys.exit("EVAL_SECRET is required")

    items = json.loads(Path(args.golden).read_text())
    print(f"Golden set: {len(items)} items; modes: {args.modes}; runs: {args.runs}")

    # Warmup (dev-server compile skews first latency); result discarded.
    print("Warmup request...")
    run_once(url, secret, items[0], args.modes[0], -1, args.timeout)

    records, failures = [], 0
    total = len(items) * len(args.modes) * args.runs
    done = 0
    for item in items:
        for mode in args.modes:
            for run_idx in range(args.runs):
                done += 1
                print(
                    f"[{done}/{total}] #{item['submissionId']} "
                    f"{item['assignmentTitle'][:30]!r} {item['studentId']} "
                    f"{mode} run {run_idx + 1}"
                )
                rec = run_once(url, secret, item, mode, run_idx, args.timeout)
                if rec is None:
                    failures += 1
                else:
                    records.append(rec)

    results_dir = Path(__file__).parent / "results"
    results_dir.mkdir(exist_ok=True)
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out = results_dir / f"{ts}.json"
    out.write_text(json.dumps(records, indent=2))
    print(f"\nSaved {len(records)} records ({failures} failures) to {out}")

    if records:
        print_table(aggregate(records), args.modes)


if __name__ == "__main__":
    main()
