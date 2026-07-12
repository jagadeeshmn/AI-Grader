import type { RubricCriterion } from "@/db/schema";
import { retrieveRankedChunks } from "@/lib/rag/retrieval";
import type { AgentFn } from "./state";
import { withAgentSpan } from "./tracing";

// Retrieval strategy A/B flag, independent of GRADING_MODE.
// "shared" replicates the single-query behavior of the single-pass control.
export type RetrievalMode = "shared" | "per_criterion";

export function getRetrievalMode(): RetrievalMode {
  return process.env.RETRIEVAL_MODE === "per_criterion"
    ? "per_criterion"
    : "shared";
}

// Templated queries (plan Step 3, point 1) — no LLM query generation yet;
// that variant gets A/B'd later.
export function buildCriterionQuery(c: RubricCriterion): string {
  return `${c.criterion}: ${c.description}`;
}

export function buildSharedQuery(rubric: RubricCriterion[]): string {
  return rubric.map(buildCriterionQuery).join("\n");
}

// Cosine candidate pool and rerank cut-offs. Shared mode mirrors the
// single-pass control (top 5); per-criterion mode uses top 3 per criterion.
const CANDIDATE_K = 15;
const SHARED_TOP_K = 5;
const PER_CRITERION_TOP_K = 3;

// Retrieval Agent (plan Step 3): builds per-criterion context bundles.
// - shared: one rubric-wide query, the same chunks in every bundle.
// - per_criterion: one templated query per criterion, top 3 chunks each.
export const retrievalAgent: AgentFn = withAgentSpan(
  "retrieval-agent",
  async (state) => {
    if (getRetrievalMode() === "per_criterion") {
      const contextBundles = await Promise.all(
        state.rubric.map(async (c) => ({
          criterionId: c.criterion,
          chunks: await retrieveRankedChunks(
            state.courseId,
            buildCriterionQuery(c),
            CANDIDATE_K,
            PER_CRITERION_TOP_K,
          ),
        })),
      );
      return { contextBundles };
    }

    const chunks = await retrieveRankedChunks(
      state.courseId,
      buildSharedQuery(state.rubric),
      CANDIDATE_K,
      SHARED_TOP_K,
    );

    return {
      contextBundles: state.rubric.map((c) => ({
        criterionId: c.criterion,
        chunks,
      })),
    };
  },
);
