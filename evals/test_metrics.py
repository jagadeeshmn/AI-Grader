from metrics import (
    aggregate,
    consistency_std,
    norm,
    per_criterion_agreement,
    total_error_pct,
    within_k,
)


def test_norm_casefolds_and_strips():
    assert norm("  Layer Descriptions ") == "layer descriptions"


def test_norm_strips_prompt_header_decoration():
    assert norm("Criterion 1: Layer Descriptions (25 pts)") == "layer descriptions"
    assert norm("criterion 12: NAT Explanation (20 pt)") == "nat explanation"
    # Plain names with no decoration are untouched.
    assert norm("Design Justification — Game") == "design justification — game"


def test_total_error_pct():
    assert total_error_pct(80, 90, 100) == 10.0
    assert total_error_pct(90, 80, 100) == 10.0
    assert total_error_pct(45, 50, 50) == 10.0


def test_within_k():
    assert within_k(89, 90)
    assert within_k(90, 90)
    assert not within_k(88, 90)
    assert within_k(85, 90, k=5)


def crit(name: str, score: float) -> dict:
    return {"criterion": name, "score": score, "maxPoints": 10, "feedback": ""}


def test_per_criterion_agreement_exact_and_within1():
    ai = [crit("Accuracy", 8), crit("Clarity", 4)]
    gt = [crit("Accuracy", 8), crit("Clarity", 5)]
    r = per_criterion_agreement(ai, gt)
    assert r["matched"] == 2
    assert r["unmatched"] == 0
    assert r["within1"] == 1.0
    assert r["exact"] == 0.5


def test_per_criterion_agreement_name_normalization():
    ai = [crit("  accuracy ", 8)]
    gt = [crit("Accuracy", 8)]
    r = per_criterion_agreement(ai, gt)
    assert r["matched"] == 1
    assert r["exact"] == 1.0


def test_per_criterion_agreement_unmatched_counts_as_miss():
    ai = [crit("Accuracy", 8), crit("Made Up Criterion", 5)]
    gt = [crit("Accuracy", 8), crit("Clarity", 5)]
    r = per_criterion_agreement(ai, gt)
    # 1 matched + 2 unmatched (AI extra + GT missing) = denominator 3
    assert r["matched"] == 1
    assert r["unmatched"] == 2
    assert r["within1"] == 1 / 3
    assert r["exact"] == 1 / 3


def test_consistency_std_constant_is_zero():
    assert consistency_std([80, 80, 80]) == 0.0


def test_consistency_std_single_run_is_zero():
    assert consistency_std([80]) == 0.0


def test_consistency_std_spread():
    assert consistency_std([79, 80, 81]) > 0


def make_record(mode: str, sub_id: int, total: float, revisions: int = 0) -> dict:
    return {
        "submissionId": sub_id,
        "mode": mode,
        "totalScore": total,
        "criterionScores": [crit("Accuracy", total)],
        "groundTruth": {
            "totalScore": 80,
            "maxScore": 100,
            "criterionScores": [crit("Accuracy", 80)],
        },
        "usage": {
            "inputTokens": 1000,
            "outputTokens": 200,
            "cacheReadTokens": 0,
            "cacheWriteTokens": 0,
            "llmCalls": 1 if mode == "single" else 3,
        },
        "latencyMs": 5000.0,
        "revisionCount": revisions,
        "needsReview": False,
    }


def test_aggregate_per_mode():
    records = [
        make_record("single", 1, 80),
        make_record("single", 1, 82),
        make_record("agentic", 1, 80, revisions=1),
        make_record("agentic", 1, 80, revisions=0),
    ]
    result = aggregate(records)

    assert result["single"]["runs"] == 2
    assert result["single"]["frac_within_1pt"] == 0.5
    assert result["single"]["mean_total_error_pct"] == 1.0
    assert result["single"]["mean_total_score_std"] == 1.0
    assert result["single"]["revision_trigger_rate"] == 0.0

    assert result["agentic"]["mean_llm_calls"] == 3
    assert result["agentic"]["revision_trigger_rate"] == 0.5
    assert result["agentic"]["mean_revision_count"] == 0.5
    assert result["agentic"]["per_criterion_exact"] == 1.0
