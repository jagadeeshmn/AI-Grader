# AI Grader: Multi-Agent Implementation Plan

Goal: add an orchestrated multi-agent grading mode alongside the current single-pass call, as a measured experiment, staying in the Next.js/TypeScript stack and working directly with the Anthropic TypeScript SDK (`@anthropic-ai/sdk`). This supersedes the Vercel AI SDK migration originally planned as Phase 3 of the upgrade plan: same intent (typed structured outputs, agentic loop), but at the raw SDK level, consistent with the depth-over-frameworks portfolio strategy.

---

## 1. Should this even be multi-agent?

State the null hypothesis up front: **a single well-prompted grading call may match the multi-agent pipeline at a fraction of the cost.** For the product alone, that is the likely outcome, and Anthropic's guidance (and your own principle) says complexity must be cost-justified by eval evidence, not adopted as a default.

So this is not "making AI Grader multi-agent." It is **adding a multi-agent mode as a measured experiment**. Single-pass stays behind the `GRADING_MODE` flag as the control, both modes run against the golden set, and the numbers decide what ships as the default. Either result is a win:

- Agreement improves enough to justify the token cost: you have data-backed justification for the architecture.
- It does not: "I built the multi-agent version, measured it, and kept single-pass in production because it matched at a quarter of the cost" is a stronger interview answer than any unmeasured multi-agent claim, because almost nobody measures the counterfactual.

Not all five agents carry equal risk of being unjustified complexity. Evidence citations, the critique pass, and the grading/feedback prompt split are cheap, well-motivated additions likely to help regardless. Per-criterion retrieval with LLM-generated queries is the most speculative piece, which is why it starts templated and gets A/B'd separately.

## 1b. Be precise about what "multi-agent" means here

Grading is a structured workflow with a known sequence, so the honest architecture is an **orchestrated pipeline of specialized agents with shared state**, not a free-form swarm. This is exactly the pattern Anthropic recommends in "Building Effective Agents": use workflows when the steps are known, reserve autonomy for steps that need judgment. Saying this in an interview is a strength, not a weakness. The judgment lives inside two agents (Critique decides whether to loop, Grading decides what context it still needs).

## 2. The five agents

| Agent                          | Responsibility                                                                                       | Model                                          | Inputs                       | Outputs                            |
| ------------------------------ | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------- | ---------------------------------- |
| **Retrieval Agent**            | Turns the rubric into one query per criterion, retrieves and reranks chunks, assembles context       | Haiku (query generation) + Voyage rerank-2     | rubric, courseId             | per-criterion context bundles      |
| **Grading Agent**              | Scores the submission per criterion against its context bundle                                       | Haiku 4.5, forced tool use, Zod-derived schema | submission, rubric, context  | per-criterion scores + rationale   |
| **Critique Agent**             | Reviews the grade: rubric adherence, evidence grounding, score consistency. Decides accept or revise | Haiku (or Sonnet for stronger judgment)        | grade + context + submission | verdict: accept, or revision notes |
| **Feedback Agent**             | Rewrites internal rationale into student-facing markdown feedback, encouraging tone, actionable      | Haiku                                          | final grade + rationale      | markdown feedback                  |
| **Evaluation Agent** (offline) | Not in the request path. The Ragas + agreement harness acting as the quality gate                    | Python harness                                 | golden set                   | metrics, CI pass/fail              |

Note the Retrieval Agent absorbs your roadmap item "per-criterion retrieval as a measured experiment." Making retrieval an agent is how that experiment ships.

## 3. Shared state

All agents read and write one typed state object. This is the core multi-agent engineering concept (it is what LangGraph's StateGraph formalizes, and you can name that in interviews).

```ts
// src/lib/agents/state.ts
export interface GradingState {
  submissionId: string;
  courseId: string;
  submissionText: string;
  rubric: RubricCriterion[];
  contextBundles: { criterionId: string; chunks: RankedChunk[] }[];
  draftGrade: PerCriterionGrade[] | null;
  critique: { verdict: "accept" | "revise"; notes: string } | null;
  revisionCount: number; // hard cap, e.g. 2
  finalGrade: PerCriterionGrade[] | null;
  studentFeedback: string | null;
  trace: LangfuseTraceClient; // one trace, one span per agent
}
```

## 4. Implementation steps

### Step 1: Extract the pure grading core (prerequisite, same as Phase 1)

Refactor `src/app/actions/grading.ts` so grading logic lives in a pure function, not inside the server action. The server action becomes a thin caller.

### Step 2: Create the agent modules

New folder `src/lib/agents/`:

```
src/lib/agents/
  state.ts          # GradingState + Zod schemas
  retrieval.ts      # Retrieval Agent
  grading.ts        # Grading Agent
  critique.ts       # Critique Agent
  feedback.ts       # Feedback Agent
  orchestrator.ts   # runs the pipeline + revision loop
```

Each agent is an async function `(state: GradingState) => Partial<GradingState>` that returns only the fields it updates. This keeps agents independently testable.

### Step 3: Retrieval Agent

1. For each rubric criterion, use a small forced-tool-use call to produce a focused search query (or start simpler: template the query from the criterion text, no LLM call, and A/B the LLM version later)
2. Run `retrieveChunks` per criterion (cosine, top 15, course-scoped), then `rerank-2` to top 3 per criterion
3. Return `contextBundles`. Wrap in a Langfuse span named `retrieval-agent` capturing queries and chunk IDs

### Step 4: Grading Agent

1. Keep forced tool use (`tool_choice: { type: 'tool', name: 'grade_submission' }`), but derive the tool's `input_schema` from a Zod schema via `zod-to-json-schema` instead of hand-writing JSON. Validate the returned `tool_use` input with `schema.parse()` so you get runtime validation plus inferred TypeScript types from one source of truth
2. Wrap this in a small shared helper, e.g. `callStructured<T>(model, system, messages, zodSchema)`, and reuse it across all four agents. That helper is your in-repo equivalent of `generateObject`, about 30 lines, and you can explain every one of them
3. Prompt receives per-criterion context bundles instead of one shared blob
4. Each score must cite which chunk(s) support it (add `evidenceChunkIds: string[]` to the schema). This gives the Critique Agent something concrete to verify
5. Write to `draftGrade`, span `grading-agent`

### Step 5: Critique Agent (the loop)

1. New LLM call with a different system prompt: "You are a strict grading reviewer." It checks three things: does each score follow the rubric point scale, is each rationale supported by the cited chunks, are scores internally consistent
2. Output schema: `{ verdict: 'accept' | 'revise', notes: string, perCriterionIssues: [...] }`
3. Orchestrator logic: if `revise` and `revisionCount < 2`, feed notes back to the Grading Agent and increment. If cap reached, accept the latest draft but flag `needs_review` on the grade row so instructors see low-confidence grades first
4. Span `critique-agent` with verdict and revision count

### Step 6: Feedback Agent

1. Takes the final grade and internal rationale, produces student-facing markdown: what was done well, what to improve, next steps
2. This separation matters: grading rationale optimizes for accuracy, feedback optimizes for pedagogy. One prompt doing both does each worse. That is your interview one-liner for why this is multiple agents rather than one big prompt
3. Span `feedback-agent`

### Step 7: Orchestrator

```ts
// src/lib/agents/orchestrator.ts (shape, not full code)
export async function gradeSubmissionAgentic(input): Promise<GradingResult> {
  let state = initState(input);
  state = merge(state, await retrievalAgent(state));
  do {
    state = merge(state, await gradingAgent(state));
    state = merge(state, await critiqueAgent(state));
    state.revisionCount++;
  } while (state.critique?.verdict === "revise" && state.revisionCount <= 2);
  state.finalGrade = state.draftGrade;
  state = merge(state, await feedbackAgent(state));
  await persistGrade(state); // grades table, source='ai', plus needs_review flag
  return toResult(state);
}
```

Keep the old single-pass path behind a flag (`GRADING_MODE=single|agentic`) so you can A/B.

### Step 8: Schema changes

- `grades.needs_review` boolean (set when the critique cap is hit)
- `grades.revision_count` int (free analytics: how often does critique catch problems)
- `ai_snapshot` from the existing plan still applies

### Step 9: Prompt caching (the cost lever)

The revision loop resends the submission, rubric, and context bundles on every Grading and Critique call. Structure prompts so the stable prefix (system prompt, rubric, context bundles, submission) comes first and mark it with `cache_control: { type: 'ephemeral' }` breakpoints; only the critique notes vary per iteration. This is the main reason to be at the raw SDK level: you control exactly where cache breakpoints land, and the pipeline's token overhead drops substantially. Report cache hit rates from the API's usage fields in Langfuse. Verify current cache pricing and minimum cacheable lengths in the Anthropic docs before quoting numbers.

### Step 10: Observability

One Langfuse trace per grading run, one span per agent, generation-level detail inside each span (prompt, tokens, cache reads vs writes, latency). You will now be able to answer "which agent is the cost and latency hotspot" with data. Without caching expect roughly 3 to 4x the tokens of single-pass; with caching it should be well under that. Measure and report both.

### Step 11: Prove it with the eval harness

Run the golden set through both modes. The claim you want to be able to make: "the agentic pipeline improved within-1-point agreement from X% to Y% at Zx the cost, and the critique loop triggered revisions on N% of submissions." If agreement does not improve, that is also a publishable finding, and honestly a stronger interview story than an unmeasured claim.

## 5. Suggested build order

1. Step 1 refactor and Step 2 skeleton (half a day)
2. `callStructured` helper + Grading Agent with evidence citations (this replaces the old Phase 3)
3. Critique Agent + revision loop with the cap and `needs_review`
4. Prompt caching breakpoints on the Grading/Critique prompts
5. Retrieval Agent per-criterion retrieval
6. Feedback Agent split
7. Langfuse spans throughout
8. A/B against the golden set, write up numbers in the README

## 6. Topics to learn for this specifically

- **Anthropic's "Building Effective Agents" post**: workflows vs agents, orchestrator-worker, evaluator-optimizer (your critique loop is literally the evaluator-optimizer pattern, use that name)
- **Anthropic SDK depth**: tool use and `tool_choice`, structured output patterns, prompt caching (`cache_control` breakpoints, cache read/write pricing, minimum cacheable prefix), usage fields, error handling and retries. Check the current docs; caching details evolve
- **Zod + zod-to-json-schema**: one schema as the source of truth for the tool `input_schema`, runtime validation, and inferred TS types
- **LangGraph concepts** (even though you are not using it here): StateGraph, nodes, conditional edges, checkpointers. Interviewers ask "why didn't you use LangGraph," and your answer is: the workflow is fixed and TypeScript-native, an in-repo orchestrator with typed shared state gave the same guarantees without a framework dependency. Knowing LangGraph well enough to say that credibly is the point
- **Why not Vercel AI SDK** (know the answer): single provider by design, fixed workflow, and direct control over cache breakpoints mattered more than provider abstraction. Know what `generateObject` does so the comparison is informed, not dismissive
- **Multi-agent failure modes**: error compounding across agents, cost multiplication, when a single well-prompted call beats a pipeline
- **Human-in-the-loop patterns**: confidence flagging, escalation thresholds

## 7. Elevance Health interview mapping

The engagement is claims fraud: evaluation, data optimization, pipelines. Here is how this project translates without overclaiming healthcare experience.

**Evaluation under ambiguity.** Grading and fraud scoring are the same problem shape: an automated system produces judgments, humans override some of them, and overrides become labeled ground truth. Your `grades.source` override loop is a miniature investigator feedback loop. Say exactly that: "In AI Grader, instructor overrides are my labeled data, the same way investigator dispositions are the labels in fraud."

**Precision vs recall framing.** The critique loop plus `needs_review` flag is a triage pattern: auto-accept high-confidence outputs, route low-confidence ones to humans. Fraud systems live on this pattern (auto-pay vs flag for investigation). You built the same escalation logic at small scale.

**Pipelines.** Chunk, embed, index, retrieve, rerank, score, persist, trace is a multi-stage data pipeline with quality gates in CI. Speak about it in pipeline language: stages, idempotency, backfills (re-embedding on model change), monitoring.

**Observability.** Per-stage tracing with Langfuse maps to "how do you know which stage of the pipeline degraded," which is a production data engineering question, not just an LLM question.

**Honesty lines (rehearse these).** "I have not built a supervised fraud model in production. What I have built is an automated scoring system with a human override loop, per-stage observability, and a CI-gated evaluation harness, and I think those transfer directly." If they push on class-imbalance metrics (precision at k, PR-AUC), that is separate study from your Elevance prep guide, not something AI Grader demonstrates.

**One caution.** Do not present the multi-agent pipeline as built until it is. "Designed and currently implementing, grading and critique agents are done, retrieval split is next" is credible. "It is done" when the repo shows otherwise is not.
