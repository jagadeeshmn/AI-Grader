import {
  LangfuseOtelSpanAttributes,
  propagateAttributes,
  startActiveObservation,
} from "@langfuse/tracing";
import type { GradingResult, RunGradingInput } from "@/lib/grading";
import { flushTelemetry } from "@/lib/telemetry";
import { critiqueAgent } from "./critique";
import { feedbackAgent } from "./feedback";
import { gradingAgent } from "./grading";
import { getRetrievalMode, retrievalAgent } from "./retrieval";
import type { GradingState } from "./state";

// Hard cap on critique-triggered re-grades (plan Step 5).
export const MAX_REVISIONS = 2;

// Maps the dispatcher input to a fresh pipeline state.
export function initState(input: RunGradingInput): GradingState {
  return {
    submissionId: input.submissionId ?? "",
    courseId: input.courseId,
    assignmentTitle: input.assignmentTitle,
    assignmentContent: input.assignmentContent,
    submissionText: input.submissionText,
    rubric: input.rubric,
    contextBundles: [],
    draftGrade: null,
    critique: null,
    revisionCount: 0,
    finalGrade: null,
    studentFeedback: null,
  };
}

// Maps the final state to the GradingResult the server action persists,
// stripping evidenceChunkIds down to the DB's CriterionScore shape.
export function toResult(
  state: GradingState,
  opts: { needsReview: boolean } = { needsReview: false },
): GradingResult {
  if (!state.finalGrade || state.studentFeedback === null) {
    throw new Error("Grading pipeline finished without a final grade");
  }

  const criterionScores = state.finalGrade.map(
    ({ criterion, score, maxPoints, feedback }) => ({
      criterion,
      score,
      maxPoints,
      feedback,
    }),
  );

  return {
    criterionScores,
    overallFeedback: state.studentFeedback,
    totalScore: criterionScores.reduce((sum, c) => sum + c.score, 0),
    maxScore: state.rubric.reduce((sum, c) => sum + c.maxPoints, 0),
    diagnostics: {
      revisionCount: state.revisionCount,
      critiqueVerdict: state.critique?.verdict ?? "none",
      needsReview: opts.needsReview,
    },
  };
}

// Orchestrator: retrieval → grading → feedback. The critique loop (plan
// Step 5) slots in between grading and the finalGrade resolution.
// The whole run is one Langfuse trace (plan Step 10), tagged with the
// submission and A/B mode identifiers; a no-op when Langfuse is not
// configured.
export async function gradeSubmissionAgentic(
  input: RunGradingInput,
): Promise<GradingResult> {
  const retrievalMode = getRetrievalMode();
  const submissionId = input.submissionId ?? "";

  return propagateAttributes(
    {
      traceName: "agentic-grading",
      tags: ["agentic", retrievalMode],
      metadata: {
        submissionId,
        gradingMode: "agentic", // this pipeline only runs in agentic mode
        retrievalMode,
      },
    },
    () =>
      startActiveObservation("agentic-grading", async (root) => {
        root.update({
          input: {
            submissionId,
            courseId: input.courseId,
            assignmentTitle: input.assignmentTitle,
          },
        });

        try {
          let state = initState(input);
          state = { ...state, ...(await retrievalAgent(state)) };
          state = { ...state, ...(await gradingAgent(state)) };
          state = { ...state, ...(await critiqueAgent(state)) };

          // Step 5: revise while the critique rejects the draft, up to
          // MAX_REVISIONS re-grades. The grading prompt includes the prior
          // draft and critique notes once state.critique is set.
          while (
            state.critique?.verdict === "revise" &&
            state.revisionCount < MAX_REVISIONS
          ) {
            state = { ...state, revisionCount: state.revisionCount + 1 };
            state = { ...state, ...(await gradingAgent(state)) };
            state = { ...state, ...(await critiqueAgent(state)) };
          }

          // Cap exhausted without an accept: flag for instructor review.
          const needsReview = state.critique?.verdict === "revise";
          state = { ...state, finalGrade: state.draftGrade };
          state = { ...state, ...(await feedbackAgent(state)) };
          const result = toResult(state, { needsReview });

          const verdict = state.critique?.verdict ?? "none";
          root.otelSpan.setAttribute(
            `${LangfuseOtelSpanAttributes.TRACE_METADATA}.critiqueVerdict`,
            verdict,
          );
          root.otelSpan.setAttribute(
            `${LangfuseOtelSpanAttributes.TRACE_METADATA}.revisionCount`,
            String(state.revisionCount),
          );
          root.update({
            output: {
              totalScore: result.totalScore,
              maxScore: result.maxScore,
              critiqueVerdict: verdict,
              revisionCount: state.revisionCount,
            },
          });

          return result;
        } catch (err) {
          root.update({ level: "ERROR", statusMessage: String(err) });
          throw err;
        } finally {
          // Server actions can be frozen right after the response is sent
          // (serverless): flush before returning so no spans are lost.
          await flushTelemetry();
        }
      }),
  );
}
