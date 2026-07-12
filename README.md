# AI Grader

A role-based course management and grading platform where Claude grades student submissions against the instructor's own reference material — with a measured A/B experiment between a single-pass grader and a multi-agent pipeline, a golden-set evaluation harness, Langfuse tracing, and an MCP analytics server.

---

## What it does

AI Grader manages the full lifecycle of academic courses across three roles:

- **Admin** — create courses, assign instructors, enroll students, and query live analytics from Claude Desktop via the built-in MCP server.
- **Instructor** — author assignments in a split-pane markdown editor, define structured rubrics (criterion, description, max points), upload course reference material, set deadlines, and trigger AI grading.
- **Student** — view enrolled courses, submit markdown work before the deadline, and see total score, per-criterion breakdown, and AI-generated feedback.

Grading is not a blind LLM call. Reference material is chunked, embedded, and stored in pgvector; at grading time the platform retrieves the most relevant chunks and injects them into the prompt, so **Claude Haiku 4.5** (`claude-haiku-4-5`) grades against the instructor's source of truth and returns structured per-criterion scores via forced tool use. Results are written to the `grades` table.

---

## Architecture

### RAG pipeline

When an instructor uploads reference material, it is split with LangChain's `RecursiveCharacterTextSplitter` (~2,500 chars, 200 overlap), embedded with Voyage `voyage-2` (1024 dims), and stored in a pgvector table with an HNSW index — no external vector DB, embeddings live alongside the app data in Neon. At grading time, one combined query built from all rubric criteria retrieves the top 15 course-scoped candidates by cosine similarity, Voyage `rerank-2` cuts them to the top 5, and those chunks go into the grading prompt alongside the rubric, assignment, and submission. Claude Haiku 4.5 returns structured per-criterion scores via forced tool use, written to the `grades` table. Grading falls back gracefully when a course has no reference material.

### Two grading modes

`runGrading()` (`src/lib/grading/index.ts`) dispatches on the `GRADING_MODE` env flag:

| Mode | What it is |
| --- | --- |
| `single` (**default**) | One retrieval pass + one Claude call (`src/lib/grading/single.ts`). The frozen control arm of the A/B experiment — never modified. |
| `agentic` | Multi-agent pipeline (`src/lib/agents/orchestrator.ts`): Retrieval → Grading → Critique (revision loop, max 2 re-grades) → Feedback. |

`single` is the default: the agentic pipeline slightly improves mean error and exact-match agreement, but is less consistent, ~3× slower, and ~6.6× more expensive in input tokens (see the numbers below).

### Multi-agent pipeline

Each agent is an async function `(state: GradingState) => Partial<GradingState>`; the orchestrator merges the patches.

1. **Retrieval Agent** — builds context bundles; independent A/B flag `RETRIEVAL_MODE=shared|per_criterion` (one rubric-wide query vs one per criterion).
2. **Grading Agent** — drafts per-criterion scores with cited evidence chunk IDs.
3. **Critique Agent** — verdict `accept`/`revise`; on `revise` the orchestrator re-runs Grading with the critique notes, up to twice. If still unresolved, the grade is flagged `needs_review`.
4. **Feedback Agent** — rewrites the grading summary into student-facing markdown.

All structured LLM calls go through `callStructured()` (`src/lib/agents/llm.ts`): forced tool use, Zod-derived `input_schema`, `schema.parse()` on the result. Full per-agent docs: [docs/agents/overview.md](docs/agents/overview.md).

### Observability

One Langfuse trace per run, one span per agent, one generation per LLM call (prompt, token usage, stop reason). No-op unless `LANGFUSE_PUBLIC_KEY`/`LANGFUSE_SECRET_KEY` are set.

---

## Evaluation

The eval harness lives in `evals/` and runs against a dev server through a secret-guarded API route (`/api/eval/grade`) that can force either mode per call.

- **Golden set from instructor grades.** `evals/build_golden_set.py` exports every instructor-graded submission (`grades.source = 'instructor'`) for the seeded eval accounts as labeled ground truth — 15 items across 3 networking assignments. Instructor overrides of AI grades become free labeled examples.
- **Agreement metrics** — total-score error as % of max, runs within 1 point of the instructor, per-criterion within-1-point and exact-match rates.
- **Consistency metric** — std-dev of the total score across 3 repeated runs of the same item, averaged over items.
- **CI gating** — TODO: the harness is reporting-only today (no thresholds, not wired into CI).

### A/B results (2026-07-12, 15 items × 3 runs per mode)

| Metric | single | agentic |
| --- | --- | --- |
| Runs | 45 | 32¹ |
| Mean total-score error (% of max) | 10.6% | **8.9%** |
| Median total-score error (% of max) | **5.0%** | 7.5% |
| Runs within 1 pt of instructor | **11.1%** | 9.4% |
| Per-criterion within 1 pt | **53.8%** | 53.3% |
| Per-criterion exact match | 30.6% | **32.0%** |
| Consistency: mean std-dev of total | **1.64** | 2.02 |
| Mean input tokens / run | **4,231** | 28,007 |
| Mean output tokens / run | **1,342** | 4,036 |
| Mean LLM calls / run | **1.0** | 3.8 |
| Mean latency | **13.5 s** | 44.1 s |
| Revision-trigger rate | — | 21.9% |
| Needs-review rate | — | 15.6% |

¹ 13 agentic runs failed (request errors/timeouts) and are excluded.

Read: the agentic pipeline buys a modest mean-error and exact-match improvement at ~6.6× the input tokens, ~3.3× the latency, and worse run-to-run consistency — hence `single` remains the default while the revision loop and retrieval strategy are iterated on.

### Prompt caching

TODO — planned but not yet implemented. There are no `cache_control` breakpoints in the codebase, and the eval run recorded 0 cache-read and 0 cache-write tokens in both modes, so no cache hit rate or cost comparison can be reported yet. The revision loop currently resends the full prompt each iteration; token usage (including cache reads/writes) is already recorded per call, so the before/after comparison is ready to run once caching lands.

---

## MCP analytics server

A built-in Model Context Protocol server (`npm run mcp`, stdio transport) exposes the database as typed tools any MCP client — e.g. Claude Desktop — can call:

| Tool | Description |
| --- | --- |
| `list_courses` | List all courses with enrollment + instructor |
| `get_course_summary` | Enrollment, assignment count, submission rate, avg grade |
| `get_submission_stats` | Per-assignment submission and grade stats |
| `get_grade_distribution` | Grade bands, avg/min/max for an assignment |
| `get_students_without_submissions` | Students who missed an assignment |
| `get_ungraded_submissions` | Submissions pending grading |

Example admin questions: *"Which courses have the lowest submission rates?"*, *"Show the grade distribution for the Networks midterm."*

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Framework | Next.js 16 (App Router, RSC, Server Actions, Turbopack) |
| Language | TypeScript 5 |
| Auth | Stack Auth (`@stackframe/stack`) |
| Database | Neon serverless Postgres + Drizzle ORM / Drizzle Kit |
| Vector store | pgvector (HNSW, `vector_cosine_ops`), colocated in Neon |
| Embeddings | Voyage AI `voyage-2` (1024 dims) |
| Re-ranking | Voyage AI `rerank-2` cross-encoder |
| Text splitting | LangChain `RecursiveCharacterTextSplitter` |
| LLM | Claude Haiku 4.5 via `@anthropic-ai/sdk`, forced tool use, Zod-validated |
| Tracing | Langfuse (`@langfuse/tracing` + OTel) |
| MCP | `@modelcontextprotocol/sdk` (stdio) |
| UI | Tailwind CSS 4, shadcn/ui, `@uiw/react-md-editor`, `react-markdown` |
| Lint / format / tests | Biome, Vitest |

---

## Setup

```bash
git clone <repo-url> && cd aigrader
npm install
```

Create `.env` with:

```bash
DATABASE_URL=            # Neon Postgres connection string
ANTHROPIC_API_KEY=       # Claude
VOYAGE_API_KEY=          # embeddings + re-ranking

# Stack Auth
NEXT_PUBLIC_STACK_PROJECT_ID=
NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY=
STACK_SECRET_SERVER_KEY=

# Optional
GRADING_MODE=single      # single (default) | agentic
RETRIEVAL_MODE=shared    # shared (default) | per_criterion
EVAL_SECRET=             # enables the /api/eval/grade route
LANGFUSE_PUBLIC_KEY=     # enables tracing (with secret key)
LANGFUSE_SECRET_KEY=
LANGFUSE_BASE_URL=       # only for self-hosted Langfuse
```

Then:

```bash
npm run db:migrate       # apply Drizzle migrations
npm run db:seed          # seed base data (see also db:seed:networks,
                         #   db:seed:materials, db:seed:golden)
npm run dev              # http://localhost:3000
npm test                 # vitest
npm run lint             # biome
```

### Running the eval

```bash
cd evals
python -m venv .venv && .venv/bin/pip install -r requirements.txt
# with the dev server running and EVAL_SECRET set in both environments:
EVAL_SECRET=... .venv/bin/python run_eval.py --runs 3
```

Results are written to `evals/results/<timestamp>.json` and a single-vs-agentic comparison table is printed.

### MCP server (Claude Desktop)

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "aigrader-analytics": {
      "command": "npm",
      "args": ["run", "mcp"],
      "cwd": "/absolute/path/to/aigrader"
    }
  }
}
```
