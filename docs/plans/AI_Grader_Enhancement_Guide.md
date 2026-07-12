# AI Grader: Consolidated Enhancement Guide

One place for everything discussed across sessions. Repo: `github.com/jagadeeshmn/AI-Grader`

---

## 1. What AI Grader is today (current state)

A role-based course platform (Admin, Instructor, Student) with a real RAG grading pipeline, not a blind LLM call.

**Platform**

- Next.js 16 App Router, React Server Components, Server Actions, TypeScript 5
- Stack Auth for authentication
- Neon serverless Postgres with Drizzle ORM
- Tailwind CSS 4 + shadcn/ui, Biome for lint/format

**The grading pipeline (the important part)**

1. Instructor uploads reference material. It is chunked with LangChain `RecursiveCharacterTextSplitter` at 2,500 chars with 200 overlap (`src/lib/rag/chunker.ts`)
2. Chunks embedded with Voyage `voyage-2` at 1024 dims (`src/lib/rag/embeddings.ts`), stored in `material_chunks` with an HNSW `vector_cosine_ops` index (`src/db/schema.ts`)
3. At grading time (`src/app/actions/grading.ts`), the rubric becomes a single query. `retrieveChunks` pulls 15 candidates by cosine distance scoped to the course, then Voyage `rerank-2` narrows to the top 5 (`src/lib/rag/retrieval.ts`, `reranker.ts`)
4. Chunks are injected into the prompt, sent to Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) with forced tool use (`grade_submission` tool), returning structured per-criterion scores and markdown feedback
5. Results written to `grades` with `source = 'ai'`. Instructors can override via `overrideGradeAction`, which sets `source = 'instructor'`

**MCP analytics server**
A stdio MCP server (`src/mcp/server.ts`) exposes 6 typed tools: `list_courses`, `get_course_summary`, `get_submission_stats`, `get_grade_distribution`, `get_students_without_submissions`, `get_ungraded_submissions`. Admins query the database in natural language from Claude Desktop.

---

## 2. The three-phase upgrade plan

These fill the gaps every serious AI system is expected to have and most portfolios lack: no evaluation, no production tracing, and a hand-rolled model call.

### Phase 1: Evaluation harness (Python `evals/` folder)

**Refactor first.** Extract grading into a pure `gradeSubmission` function, then add a guarded `/api/eval/grade` route (protected by `EVAL_SECRET`) so the Python harness can call it.

**The goldmine in your schema.** The `grades.source` column means every instructor override is a human-verified grade. That is the ground truth a grader evaluation needs, and it already exists in your data. No labeling project required.

**Harness components (already delivered as runnable code):**

- `build_golden_set.py`: pulls instructor-graded submissions as ground truth
- `metrics.py`: computes agreement (total-score error as percent of max, fraction within 1 point, per-criterion within-1 and exact-match rates) and consistency (std dev of total score across repeated runs)
- `run_eval.py`: orchestrates the run and gates CI
- `eval.yml`: GitHub Action that fails a pull request when any metric regresses
- Ragas for RAG faithfulness: whether feedback stays grounded in retrieved reference material

### Phase 2: Langfuse observability

Instrument `gradeSubmission` with the Langfuse TypeScript SDK. Two spans per grading call:

- Retrieval span: the query and the returned chunks
- Generation span: prompt, model, token usage, latency

Bonus: real traces seed the evaluation golden set from actual traffic.

### Phase 3: Anthropic SDK structured layer + multi-agent mode

(Revised July 11: originally planned as a Vercel AI SDK migration, superseded by the decision to work at the raw Anthropic SDK level. Full detail in `AI_Grader_Multi_Agent_Plan.md`.)

- Keep forced tool use, but derive the tool's `input_schema` from Zod schemas via `zod-to-json-schema`, validated with `schema.parse()`, wrapped in a shared `callStructured` helper
- Restructure grading as an orchestrated agent pipeline behind a `GRADING_MODE=single|agentic` flag: Retrieval, Grading, Critique (revision loop with hard cap), Feedback
- Use prompt caching (`cache_control` breakpoints) on the stable prefix so the revision loop does not repay for the rubric, submission, and context each iteration

---

## 3. Known fixes and roadmap items

**Schema fix: `ai_snapshot`.** Right now `overrideGradeAction` overwrites the grade row (one grade per submission, unique on `submission_id`), so the original AI grade is lost on override. Add an `ai_snapshot` column to preserve it, so every future override becomes a free labeled evaluation example. The harness works around it today by re-grading.

**README inaccuracies to fix (found by reading the code):**

1. README claims per-criterion retrieval, but the code does one combined query
2. README says results go to an "evaluations table" when it is actually `grades`
3. README never names the model

**Roadmap experiments:**

- Per-criterion retrieval as a measured experiment against the current single-query approach
- A/B the self-critique pass on agreement metrics before making it the default

---

## 4. Files already delivered (July 5 chat)

In the chat titled "Maximizing Fable 5 for AI projects":

- `AI_Grader_Upgrade_Plan.md` (the full grounded plan with real file paths and code)
- `evals/` folder: `build_golden_set.py`, `metrics.py`, `run_eval.py`, `eval.yml`, `requirements.txt`
- `README_rewritten.md` (hiring-manager framing, accurate to the code)

If you no longer have these files locally, re-download them from that chat or ask me to regenerate any of them.

---

## 5. Suggested order of work

1. Phase 1 refactor (`gradeSubmission` + eval route). Small, unblocks everything
2. Drop in the `evals/` harness, build the golden set, run it once to get baseline numbers
3. Wire `eval.yml` into GitHub Actions
4. Add the `ai_snapshot` schema change
5. Phase 2 Langfuse instrumentation
6. Phase 3 Anthropic SDK structured layer + multi-agent mode (see `AI_Grader_Multi_Agent_Plan.md`)
7. Fix the three README inaccuracies, then publish the rewritten README
8. Run the per-criterion retrieval and self-critique A/B experiments, write up results

Use Claude Code with the repo open for the refactor and harness integration. Use your mentor-mode preamble if you want to learn each piece by writing it yourself rather than having it generated.

---

## 6. Topics to learn (mapped to each phase)

**For Phase 1 (evaluation): highest priority**

- LLM evaluation fundamentals: golden sets, why human labels matter, offline vs online eval
- Ragas metrics: faithfulness, context precision, context recall, answer relevancy, and what each actually measures
- Custom metric design: agreement and consistency for a grader, and why generic metrics are not enough
- LLM-as-judge patterns and their pitfalls (position bias, self-preference)
- CI for AI systems: gating PRs on metric regression, handling nondeterminism in tests

**For Phase 2 (observability)**

- Langfuse concepts: traces, spans, generations, scores, datasets
- What to capture per LLM call: prompt, model, tokens, latency, retrieval context
- Building eval datasets from production traces

**For Phase 3 (model layer + agentic loop)**

- Anthropic SDK depth: tool use and `tool_choice`, prompt caching (`cache_control`, cache pricing, minimum cacheable prefix), usage fields, retries
- Zod + `zod-to-json-schema`: one schema as source of truth for tool `input_schema`, runtime validation, and inferred TS types
- Structured output strategies: forced tool use vs native structured output, tradeoffs (plus what Vercel's `generateObject` does, so the "why not" answer is informed)
- Reflection/self-critique agent patterns, and when they help vs add cost

**For the roadmap experiments**

- RAG retrieval strategies: single query vs multi-query (per-criterion), query decomposition
- Reranking: cross-encoders, how rerank-2 differs from embedding similarity
- Experiment design for AI features: what metric decides the winner, sample sizes

**Interview payoff framing.** Each phase maps directly to what AI-native companies (Saviynt, Google FDE) probe: Phase 1 answers "how do you know your AI feature works," Phase 2 answers "how do you debug it in production," Phase 3 answers "how do you structure agentic workflows." Be ready to state your baseline agreement numbers once you have them.
