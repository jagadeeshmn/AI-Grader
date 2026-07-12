import { z } from "zod";
import type { RubricCriterion } from "@/db/schema";

// A retrieved reference-material chunk after reranking.
export interface RankedChunk {
  id: string;
  content: string;
  score: number;
}

// ─── Zod schemas: single source of truth for tool input_schema (via
// z.toJSONSchema), runtime validation (schema.parse), and TS types (z.infer).

// A per-criterion grade that cites the chunks supporting it, so the
// Critique Agent has something concrete to verify. Superset of the DB's
// CriterionScore shape plus evidenceChunkIds.
export const perCriterionGradeSchema = z.object({
  criterion: z.string(),
  score: z.number(),
  maxPoints: z.number(),
  feedback: z.string(),
  evidenceChunkIds: z
    .array(z.string())
    .describe("IDs of the reference chunks that support this score"),
});
export type PerCriterionGrade = z.infer<typeof perCriterionGradeSchema>;

// Output of the Grading Agent's grade_submission tool.
export const gradeSubmissionOutputSchema = z.object({
  criterionScores: z.array(perCriterionGradeSchema),
  overallFeedback: z.string(),
});
export type GradeSubmissionOutput = z.infer<typeof gradeSubmissionOutputSchema>;

// Output of the Critique Agent: accept the draft grade or request a revision.
export const critiqueOutputSchema = z.object({
  verdict: z.enum(["accept", "revise"]),
  notes: z.string(),
  perCriterionIssues: z.array(
    z.object({
      criterion: z.string(),
      issue: z.string(),
    }),
  ),
});
export type CritiqueOutput = z.infer<typeof critiqueOutputSchema>;

// Output of the Feedback Agent: student-facing markdown feedback.
export const feedbackOutputSchema = z.object({
  feedback: z
    .string()
    .describe(
      "Student-facing feedback in markdown: what was done well, what to improve, and concrete next steps",
    ),
});
export type FeedbackOutput = z.infer<typeof feedbackOutputSchema>;

// Shared state for the agentic grading pipeline. Every agent reads this and
// returns only the fields it updates (see AgentFn).
export interface GradingState {
  submissionId: string;
  courseId: number;
  assignmentTitle: string;
  assignmentContent: string;
  submissionText: string;
  rubric: RubricCriterion[];
  // criterionId is the rubric criterion name (RubricCriterion has no id).
  contextBundles: { criterionId: string; chunks: RankedChunk[] }[];
  draftGrade: PerCriterionGrade[] | null;
  critique: { verdict: "accept" | "revise"; notes: string } | null;
  revisionCount: number; // hard cap, e.g. 2
  finalGrade: PerCriterionGrade[] | null;
  studentFeedback: string | null;
}

export type AgentFn = (state: GradingState) => Promise<Partial<GradingState>>;
