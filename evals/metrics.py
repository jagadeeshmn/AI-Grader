"""Pure metric functions for the grading eval (Enhancement Guide Phase 1).

Agreement = AI grade vs instructor ground truth.
Consistency = spread of total score across repeated runs of the same item.
No thresholds or gating here — reporting only.
"""

import re
from statistics import mean, median, pstdev


def norm(name: str) -> str:
    """Normalizes a criterion name for matching.

    The agentic grader sometimes echoes the prompt's section header, e.g.
    "Criterion 1: Layer Descriptions (25 pts)" — strip that decoration so
    it matches the rubric's "Layer Descriptions".
    """
    name = re.sub(r"^\s*criterion\s*\d+\s*:\s*", "", name, flags=re.IGNORECASE)
    name = re.sub(r"\s*\(\s*\d+(\.\d+)?\s*pts?\s*\)\s*$", "", name, flags=re.IGNORECASE)
    return name.strip().casefold()


def total_error_pct(ai_total: float, gt_total: float, max_score: float) -> float:
    """Absolute total-score error as a percentage of the max score."""
    return abs(ai_total - gt_total) / max_score * 100.0


def within_k(ai_total: float, gt_total: float, k: float = 1.0) -> bool:
    return abs(ai_total - gt_total) <= k


def per_criterion_agreement(ai_scores: list[dict], gt_scores: list[dict]) -> dict:
    """Match criteria by normalized name; unmatched criteria count as misses.

    Each score dict has at least {"criterion": str, "score": number}.
    """
    gt_by_name = {norm(c["criterion"]): c for c in gt_scores}
    ai_names = {norm(c["criterion"]) for c in ai_scores}

    matched = 0
    within1 = 0
    exact = 0
    for c in ai_scores:
        gt = gt_by_name.get(norm(c["criterion"]))
        if gt is None:
            continue
        matched += 1
        diff = abs(c["score"] - gt["score"])
        if diff <= 1:
            within1 += 1
        if diff == 0:
            exact += 1

    unmatched = (len(ai_scores) - matched) + sum(
        1 for name in gt_by_name if name not in ai_names
    )
    denominator = matched + unmatched
    return {
        "within1": within1 / denominator if denominator else 0.0,
        "exact": exact / denominator if denominator else 0.0,
        "matched": matched,
        "unmatched": unmatched,
    }


def consistency_std(totals: list[float]) -> float:
    """Population std-dev of total scores across repeated runs of one item."""
    if len(totals) < 2:
        return 0.0
    return pstdev(totals)


def aggregate(records: list[dict]) -> dict:
    """Aggregates per-run eval records into per-mode summary stats.

    Each record: {submissionId, mode, totalScore, groundTruth: {totalScore,
    maxScore, criterionScores}, criterionScores, usage: {inputTokens,
    outputTokens, cacheReadTokens, cacheWriteTokens, llmCalls}, latencyMs,
    revisionCount, needsReview}
    """
    modes: dict[str, dict] = {}
    for mode in sorted({r["mode"] for r in records}):
        runs = [r for r in records if r["mode"] == mode]

        errors = [
            total_error_pct(
                r["totalScore"],
                r["groundTruth"]["totalScore"],
                r["groundTruth"]["maxScore"],
            )
            for r in runs
        ]
        within1_runs = [
            within_k(r["totalScore"], r["groundTruth"]["totalScore"]) for r in runs
        ]
        crit = [
            per_criterion_agreement(
                r["criterionScores"], r["groundTruth"]["criterionScores"]
            )
            for r in runs
        ]

        # Consistency: std-dev of totals per item, then averaged over items.
        by_item: dict = {}
        for r in runs:
            by_item.setdefault(r["submissionId"], []).append(r["totalScore"])
        stds = [consistency_std(totals) for totals in by_item.values()]

        modes[mode] = {
            "runs": len(runs),
            "items": len(by_item),
            "mean_total_error_pct": mean(errors),
            "median_total_error_pct": median(errors),
            "frac_within_1pt": mean(within1_runs),
            "per_criterion_within1": mean(c["within1"] for c in crit),
            "per_criterion_exact": mean(c["exact"] for c in crit),
            "per_criterion_unmatched": sum(c["unmatched"] for c in crit),
            "mean_total_score_std": mean(stds) if stds else 0.0,
            "mean_input_tokens": mean(r["usage"]["inputTokens"] for r in runs),
            "mean_output_tokens": mean(r["usage"]["outputTokens"] for r in runs),
            "mean_cache_read_tokens": mean(
                r["usage"]["cacheReadTokens"] for r in runs
            ),
            "mean_cache_write_tokens": mean(
                r["usage"]["cacheWriteTokens"] for r in runs
            ),
            "mean_llm_calls": mean(r["usage"]["llmCalls"] for r in runs),
            "mean_latency_ms": mean(r["latencyMs"] for r in runs),
            "p50_latency_ms": median(r["latencyMs"] for r in runs),
            "revision_trigger_rate": mean(
                1.0 if r.get("revisionCount", 0) >= 1 else 0.0 for r in runs
            ),
            "mean_revision_count": mean(r.get("revisionCount", 0) for r in runs),
            "needs_review_rate": mean(
                1.0 if r.get("needsReview") else 0.0 for r in runs
            ),
        }
    return modes
