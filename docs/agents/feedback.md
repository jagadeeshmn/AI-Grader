# Feedback Agent

Source: `src/lib/agents/feedback.ts`

## Purpose

Rewrites the internal grading rationale into student-facing markdown
feedback. Runs once, after the critique loop resolves and
`finalGrade` is set. Rationale for a separate agent: grading rationale
optimizes for accuracy, feedback optimizes for pedagogy — one prompt doing
both does each worse.

## GradingState I/O

| Reads | Writes |
| --- | --- |
| `assignmentTitle`, `finalGrade`, `studentFeedback` (the Grading Agent's internal overall summary, if any) | `studentFeedback` — **overwritten** with the student-facing markdown |

The `studentFeedback` field is double-duty by design: between the Grading and
Feedback agents it holds the grader's internal summary; after this agent it
holds what the student reads, and `toResult()` maps it to
`GradingResult.overallFeedback`.

## Model and schema

- Model: `claude-haiku-4-5-20251001`, `maxTokens: 2048`, via
  `callStructured()`. (A code comment notes 1024 was tried and truncated
  markdown mid-JSON with `stop_reason: max_tokens`, dropping the `feedback`
  field — hence 2048 like the other agents.)
- Tool: **`write_student_feedback`** — "Record the student-facing markdown
  feedback for a graded submission".
- Output schema (`feedbackOutputSchema`): `{ feedback: string }` (markdown:
  what was done well, what to improve, concrete next steps).

## Prompt design (`buildFeedbackPrompt`, pure function)

- System: "supportive teacher" persona with a hard leak guard: never mention
  rubric mechanics, reference chunks, chunk IDs, graders, reviewers, or any
  internals of how the grade was produced.
- User message: per-criterion sections
  `### <criterion> — <score>/<maxPoints>` + "Internal rationale: ..."
  (`evidenceChunkIds` deliberately omitted so scoring internals cannot leak),
  plus the grader's internal overall summary if present.
- Output instructions: markdown with three parts (done well / to improve /
  concrete next steps), encouraging and specific, no mechanical score
  restating, no internal jargon, no mention that feedback came from grading
  notes.

## Failure behavior

- Throws synchronously (`"Feedback Agent called without a final grade"`) if
  `state.finalGrade` is null — an orchestration-order invariant.
- Otherwise inherits `callStructured()`'s throw-no-retry contract. A failure
  here fails the whole run even though a valid grade exists —
  `toResult()` is only called after this agent succeeds.

## Tracing

- Span name: **`feedback-agent`** (type `agent`), once per run. Output is the
  `{ studentFeedback }` patch.
- Child `generation` observation named **`write_student_feedback`**.

## Code vs plan discrepancies

- None substantive: the implementation matches plan Step 6 (final grade +
  rationale in, student-facing markdown out, span `feedback-agent`). The
  plan does not specify that the same state field holds both the internal
  summary and the final feedback, nor the `maxTokens` bump — both are
  implementation details documented above.
