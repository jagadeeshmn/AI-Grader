import { callStructured } from "./llm";
import {
  type AgentFn,
  type GradingState,
  gradeSubmissionOutputSchema,
} from "./state";
import { withAgentSpan } from "./tracing";

// Same model as the single-pass control arm.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are a strict but fair grader. You grade student submissions one rubric criterion at a time, grounding every judgement in the reference material provided for that criterion.`;

// Pure prompt builder (plan Step 4, point 3): each criterion gets its own
// context bundle instead of one shared blob, and every score must cite the
// chunk IDs that support it (point 4).
export function buildGradingPrompt(state: GradingState): string {
  const bundlesByCriterion = new Map(
    state.contextBundles.map((b) => [b.criterionId, b.chunks]),
  );

  const criterionSections = state.rubric
    .map((c, i) => {
      const chunks = bundlesByCriterion.get(c.criterion) ?? [];
      const referenceMaterial =
        chunks.length > 0
          ? chunks.map((ch) => `[chunk ${ch.id}] ${ch.content}`).join("\n\n")
          : "No reference material retrieved for this criterion.";
      return `### Criterion ${i + 1}: ${c.criterion} (${c.maxPoints} pts)
${c.description}

Reference material for this criterion:
${referenceMaterial}`;
    })
    .join("\n\n");

  // Revision pass (Step 5 loop): the Critique Agent sent the draft back.
  const revisionSection =
    state.critique?.notes && state.draftGrade
      ? `

## Reviewer feedback on your previous draft
Your previous draft grade was:
${JSON.stringify(state.draftGrade, null, 2)}

A grading reviewer raised these issues — address them in your revised grade:
${state.critique.notes}`
      : "";

  return `You are grading a student submission for the assignment: "${state.assignmentTitle}".

## Assignment
${state.assignmentContent}

## Student Submission
${state.submissionText}

## Rubric
${criterionSections}
${revisionSection}
Grade each rubric criterion strictly and fairly, using only that criterion's reference material to check factual claims. Award partial credit where deserved. Provide specific, actionable feedback for each criterion, then write a concise overall summary. For each score, cite the supporting chunk IDs in evidenceChunkIds, using only the chunk IDs shown above; use an empty array if no reference material supports the score.`;
}

// Grading Agent (plan Step 4): forced tool use via callStructured, writes
// draftGrade. studentFeedback holds the overall summary until the Feedback
// Agent (Step 6) overwrites it with student-facing feedback.
export const gradingAgent: AgentFn = withAgentSpan(
  "grading-agent",
  async (state) => {
    const output = await callStructured({
      model: MODEL,
      system: SYSTEM,
      messages: [{ role: "user", content: buildGradingPrompt(state) }],
      toolName: "grade_submission",
      toolDescription:
        "Record scores, feedback, and supporting evidence chunk IDs for each rubric criterion",
      schema: gradeSubmissionOutputSchema,
      maxTokens: 2048,
    });

    return {
      draftGrade: output.criterionScores,
      studentFeedback: output.overallFeedback,
    };
  },
);
