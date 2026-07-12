# Critique Agent

Source: `src/lib/agents/critique.ts`

## Purpose

Audits the Grading Agent's draft — the evaluator half of an
evaluator-optimizer loop. It either accepts the draft or sends it back for
revision with actionable notes. It does **not** re-grade; the orchestrator
decides whether to loop back to the Grading Agent based on the verdict.

## GradingState I/O

| Reads | Writes |
| --- | --- |
| `assignmentTitle`, `submissionText`, `rubric`, `draftGrade`, `contextBundles` (to resolve cited chunk IDs) | `critique: { verdict: "accept" \| "revise", notes: string }` |

Note: the schema also returns `perCriterionIssues: { criterion, issue }[]`,
but the agent **drops it** — only `verdict` and `notes` are written to state,
so per-criterion issues reach the Grading Agent only insofar as the model
repeats them in `notes` (the prompt does ask for notes as "concrete
instructions the grader can act on").

## Model and schema

- Model: `claude-haiku-4-5-20251001`, `maxTokens: 2048`, via
  `callStructured()`.
- Tool: **`critique_grade`** — "Record the review verdict, actionable notes,
  and per-criterion issues for a draft grade".
- Output schema (`critiqueOutputSchema`):
  `{ verdict: "accept" | "revise", notes: string, perCriterionIssues: { criterion, issue }[] }`.

## Prompt design (`buildCritiquePrompt`, pure function)

- System: "strict grading reviewer" that audits another grader's work and
  explicitly does not re-grade.
- User message: submission → rubric → draft grade as JSON → **cited
  reference chunks only** (the union of `evidenceChunkIds` across the draft,
  deduplicated, resolved against `contextBundles`). A cited ID not found
  among retrieved chunks is rendered as "(cited but not among the retrieved
  chunks — treat this citation as unsupported)" — a hallucinated-citation
  guard.
- Three explicit checks: (1) each score within 0..maxPoints and matching the
  criterion's maxPoints, (2) each rationale actually supported by its cited
  chunks, (3) internal consistency between scores and feedback text.
- Accept ⇒ brief notes; revise ⇒ list problems in `perCriterionIssues` and
  write `notes` as concrete instructions.

## Failure behavior

- Throws synchronously (`"Critique Agent called without a draft grade"`) if
  `state.draftGrade` is null — an orchestration-order invariant.
- Otherwise inherits `callStructured()`'s throw-no-retry contract.
- Verdict `revise` is not a failure: the orchestrator loops (up to
  `MAX_REVISIONS = 2` re-grades) and, if the cap is exhausted while still
  `revise`, accepts the latest draft with `needsReview: true` in diagnostics.

## Tracing

- Span name: **`critique-agent`** (type `agent`) — one span per invocation
  (up to 3 per run). Output is the `critique` patch, so the verdict is
  visible per span; the final verdict and `revisionCount` are also written to
  trace metadata by the orchestrator.
- Child `generation` observation named **`critique_grade`**.

## Code vs plan discrepancies

- **Model**: plan §2 suggests "Haiku (or Sonnet for stronger judgment)";
  code uses Haiku 4.5 like every other agent.
- **Plan Step 5.4** says the span records "verdict and revision count". The
  span's output patch contains the verdict; `revisionCount` appears in the
  span *input* summary and in trace metadata, not as a dedicated span
  attribute.
- **`perCriterionIssues` is requested from the model but discarded** before
  reaching state. The plan (Step 5.3) implies the notes are what feed back to
  the grader, so this is consistent in effect, but the schema field is
  effectively write-only.
- CLAUDE.md's "Active work" note says the critique agent still needs wiring
  with `withAgentSpan` — in the code it is already wrapped and wired into the
  orchestrator's revision loop (Step 5 appears done; CLAUDE.md is stale).
