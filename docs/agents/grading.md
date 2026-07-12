# Grading Agent

Source: `src/lib/agents/grading.ts`

## Purpose

Scores the submission per rubric criterion against that criterion's context
bundle, producing a draft grade with evidence citations. Also serves as the
**revision** step: when the Critique Agent has rejected a draft, the same
agent re-grades with the reviewer's notes embedded in the prompt.

## GradingState I/O

| Reads | Writes |
| --- | --- |
| `assignmentTitle`, `assignmentContent`, `submissionText`, `rubric`, `contextBundles`, `critique` (revision pass), `draftGrade` (revision pass) | `draftGrade: PerCriterionGrade[]`, `studentFeedback` (the model's *internal* overall summary — later overwritten by the Feedback Agent) |

## Model and schema

- Model: `claude-haiku-4-5-20251001` (same as the single-pass control),
  `maxTokens: 2048`, via `callStructured()` (forced tool use).
- Tool: **`grade_submission`** — "Record scores, feedback, and supporting
  evidence chunk IDs for each rubric criterion".
- Output schema (`gradeSubmissionOutputSchema` in `state.ts`):
  `{ criterionScores: PerCriterionGrade[], overallFeedback: string }` where
  `PerCriterionGrade = { criterion, score, maxPoints, feedback,
  evidenceChunkIds: string[] }`. `evidenceChunkIds` is a superset of the DB's
  `CriterionScore` shape and exists so the Critique Agent has something
  concrete to verify; it is stripped by `toResult()` before persistence.

## Prompt design (`buildGradingPrompt`, pure function)

- System: "strict but fair grader", grades one criterion at a time, grounds
  every judgement in that criterion's reference material.
- User message sections: assignment content → student submission → rubric,
  where **each criterion gets its own section** with its own reference
  material rendered as `[chunk <id>] <content>` (or "No reference material
  retrieved for this criterion."). This replaces the control's single shared
  reference blob.
- Instructions: grade strictly/fairly, use only that criterion's material to
  check factual claims, partial credit, cite supporting chunk IDs in
  `evidenceChunkIds` using only the IDs shown (empty array if none).
- **Revision section** (only when `state.critique?.notes` and
  `state.draftGrade` are both set): appends the previous draft as JSON plus
  the reviewer's notes, instructing the model to address them. This is how
  the orchestrator's revision loop feeds critique back without any other
  plumbing.

## Failure behavior

Inherits `callStructured()`'s throw-no-retry contract: Anthropic API errors,
a missing `tool_use` block, and Zod validation failures all throw and abort
the run. Notably a `max_tokens` truncation mid-JSON surfaces as a ZodError
(raw output and `stop_reason` are still recorded on the generation before
validation).

## Tracing

- Span name: **`grading-agent`** (type `agent`), one span per invocation —
  so a run with revisions has 2–3 `grading-agent` spans; the state summary
  input includes `revisionCount`, distinguishing initial pass (0) from
  revisions (1, 2).
- Output: the `{ draftGrade, studentFeedback }` patch.
- Child `generation` observation named **`grade_submission`** with model,
  `max_tokens`, full prompt, raw tool output, token usage (incl. cache
  read/write), and `stop_reason`.

## Code vs plan discrepancies

- **Plan Step 9 (prompt caching) not implemented**: the plan's main cost
  lever is `cache_control` breakpoints so the revision loop reuses the stable
  prefix. The code has no `cache_control` anywhere; every revision resends
  the full prompt uncached. Also, the prompt is not ordered stable-prefix
  first as Step 9 prescribes (the revision section is appended at the end,
  which *is* cache-friendly, but no breakpoints exist to exploit it).
- **Plan Step 4.1 names `zod-to-json-schema`**; code uses Zod v4's native
  `z.toJSONSchema()` in `callStructured()`. Same single-source-of-truth
  intent, no extra dependency.
- **Plan §1b** says the Grading Agent "decides what context it still needs";
  the implemented agent has no ability to request additional retrieval.
