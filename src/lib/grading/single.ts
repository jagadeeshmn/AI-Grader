import Anthropic from "@anthropic-ai/sdk";
import type { CriterionScore, RubricCriterion } from "@/db/schema";
import { recordUsage } from "@/lib/agents/usage";
import { retrieveChunks } from "@/lib/rag/retrieval";

const client = new Anthropic();

export interface GradeSubmissionInput {
  courseId: number;
  assignmentTitle: string;
  assignmentContent: string;
  rubric: RubricCriterion[];
  submissionText: string;
}

// Run diagnostics set only by the agentic pipeline; the single-pass control
// never populates it (type-only addition — control behavior unchanged).
export interface GradingDiagnostics {
  revisionCount: number;
  critiqueVerdict: "accept" | "revise" | "none";
  needsReview: boolean;
}

export interface GradingResult {
  criterionScores: CriterionScore[];
  overallFeedback: string;
  totalScore: number;
  maxScore: number;
  diagnostics?: GradingDiagnostics;
}

// Single-pass grading: one RAG retrieval over the whole rubric, one forced
// tool-use call. This is the control arm of the GRADING_MODE A/B experiment —
// do not change its prompt, model, or tool schema.
export async function gradeSubmission(
  input: GradeSubmissionInput,
): Promise<GradingResult> {
  const { courseId, assignmentTitle, assignmentContent, rubric } = input;

  const rubricText = rubric
    .map(
      (c, i) =>
        `${i + 1}. **${c.criterion}** (${c.maxPoints} pts)\n   ${c.description}`,
    )
    .join("\n\n");

  // RAG: retrieve relevant reference material chunks using rubric as query
  const rubricQuery = rubric
    .map((c) => `${c.criterion}: ${c.description}`)
    .join("\n");

  const chunks = await retrieveChunks(courseId, rubricQuery, 5);

  const referenceMaterialSection =
    chunks.length > 0
      ? `## Reference Material\nThe following excerpts from the course reference material are relevant to the grading criteria. Use them to assess the accuracy and completeness of the student's work.\n\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}\n\n`
      : "";

  const prompt = `You are grading a student submission for the assignment: "${assignmentTitle}".

${referenceMaterialSection}## Assignment
${assignmentContent}

## Rubric
${rubricText}

## Student Submission
${input.submissionText}

Grade each rubric criterion strictly and fairly.${chunks.length > 0 ? " Ground your assessment in the reference material provided — check factual claims against it." : ""} Award partial credit where deserved. Provide specific, actionable feedback for each criterion, then write a concise overall summary.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [
      {
        name: "grade_submission",
        description: "Record scores and feedback for each rubric criterion",
        input_schema: {
          type: "object" as const,
          properties: {
            criterionScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  score: { type: "number" },
                  maxPoints: { type: "number" },
                  feedback: { type: "string" },
                },
                required: ["criterion", "score", "maxPoints", "feedback"],
              },
            },
            overallFeedback: { type: "string" },
          },
          required: ["criterionScores", "overallFeedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "grade_submission" },
    messages: [{ role: "user", content: prompt }],
  });

  // Observational only (eval harness): reads the already-returned usage
  // field; no-op outside withUsageCollection(). Prompt, model, params, and
  // return value are untouched — the A/B control's behavior is unchanged.
  recordUsage({
    label: "grade_submission_single",
    inputTokens: response.usage?.input_tokens ?? 0,
    outputTokens: response.usage?.output_tokens ?? 0,
    cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("AI did not return a structured grade");
  }

  const result = toolBlock.input as {
    criterionScores: CriterionScore[];
    overallFeedback: string;
  };

  const totalScore = result.criterionScores.reduce(
    (sum, c) => sum + c.score,
    0,
  );
  const maxScore = rubric.reduce((sum, c) => sum + c.maxPoints, 0);

  return {
    criterionScores: result.criterionScores,
    overallFeedback: result.overallFeedback,
    totalScore,
    maxScore,
  };
}
