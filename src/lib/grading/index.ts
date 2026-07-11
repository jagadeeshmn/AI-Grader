import {
  type GradeSubmissionInput,
  type GradingResult,
  gradeSubmission,
} from "./single";

export type { GradeSubmissionInput, GradingResult } from "./single";

export type GradingMode = "single" | "agentic";

export function getGradingMode(): GradingMode {
  return process.env.GRADING_MODE === "agentic" ? "agentic" : "single";
}

// Dispatches to the grading pipeline selected by GRADING_MODE.
// "single" (default) is the A/B control — never modify its behavior.
export async function runGrading(
  input: GradeSubmissionInput,
): Promise<GradingResult> {
  if (getGradingMode() === "agentic") {
    throw new Error(
      "GRADING_MODE=agentic is not implemented yet (see docs/plans/AI_Grader_Multi_Agent_Plan.md)",
    );
  }
  return gradeSubmission(input);
}
