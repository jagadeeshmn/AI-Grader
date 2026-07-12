# Retrieval Agent

Source: `src/lib/agents/retrieval.ts` (retrieval core:
`retrieveRankedChunks()` in `src/lib/rag/retrieval.ts`)

## Purpose

Builds per-criterion reference-material context bundles for the Grading and
Critique agents. Two strategies behind the `RETRIEVAL_MODE` flag (an A/B
experiment independent of `GRADING_MODE`):

- **`shared`** (default): one rubric-wide query, the same chunk list placed
  in every criterion's bundle. Replicates the single-pass control's retrieval
  behavior.
- **`per_criterion`**: one templated query per rubric criterion, each with
  its own top chunks.

## GradingState I/O

| Reads | Writes |
| --- | --- |
| `courseId`, `rubric` | `contextBundles: { criterionId, chunks: RankedChunk[] }[]` |

`criterionId` is the rubric criterion **name** (`RubricCriterion` has no id).
Each `RankedChunk` is `{ id, content, score }` — the id is the
`material_chunks` row id (stringified), which is what the Grading Agent cites
in `evidenceChunkIds`.

## Queries (no LLM)

Templated, pure functions:

- `buildCriterionQuery(c)` → `` `${c.criterion}: ${c.description}` ``
- `buildSharedQuery(rubric)` → all criterion queries joined with `\n`
  (byte-identical to the single-pass control's query construction)

## Retrieval parameters

| Constant | Value | Meaning |
| --- | --- | --- |
| `CANDIDATE_K` | 15 | pgvector cosine candidate pool (course-scoped, embedded chunks only) |
| `SHARED_TOP_K` | 5 | rerank-2 cut-off in shared mode (mirrors the control) |
| `PER_CRITERION_TOP_K` | 3 | rerank-2 cut-off per criterion in per_criterion mode |

Pipeline per query: Voyage `voyage-2` embedding → pgvector `<=>` cosine
top-15 → Voyage `rerank-2` with scores → top-K `RankedChunk`s. Per-criterion
queries run in parallel (`Promise.all`).

## Model / LLM usage

**None.** This agent makes no Claude calls — only Voyage embedding + rerank
API calls and a Postgres query.

## Failure behavior

No internal error handling: embedding, SQL, or rerank errors propagate and
fail the whole run (root trace marked ERROR). Empty candidate set is handled:
`retrieveRankedChunks` returns `[]`, so a criterion can legitimately get an
empty bundle (the grading prompt then shows "No reference material retrieved
for this criterion.").

## Tracing

- Span name: **`retrieval-agent`** (`withAgentSpan`, observation type
  `agent`).
- Input: compact state summary (submissionId, courseId, assignmentTitle,
  rubric criterion names, bundle count, revisionCount).
- Output: the `contextBundles` patch (full chunk contents + scores).
- No `generation` child observation (no LLM call).
- `retrievalMode` is recorded at the **trace** level (tag + metadata) by the
  orchestrator, not on this span.

## Code vs plan discrepancies

- **Plan Step 3.1 / §2 table**: plan describes LLM (Haiku) query generation
  per criterion. Code uses only templated queries — the plan itself offers
  this as the "start simpler" option with the LLM variant to be A/B'd later,
  but the §2 table lists "Haiku (query generation)" as the agent's model,
  which is not what runs.
- **`shared` mode is not in the plan.** Plan Step 3 only specifies
  per-criterion retrieval; the code adds a `shared` control mode and makes it
  the **default**, so out of the box the agentic pipeline does *not* do
  per-criterion retrieval.
- **Plan Step 3.3** says the span captures "queries and chunk IDs"; the span
  input is the generic state summary (no query text) and the output contains
  the chunks. Query strings are not explicitly recorded.
