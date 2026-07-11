import type { GradeSubmissionInput, GradingResult } from "@/lib/grading";

// Orchestrator: runs retrieval → (grading → critique) loop → feedback over
// the shared GradingState, then maps the final state to a GradingResult.
export async function gradeSubmissionAgentic(
  _input: GradeSubmissionInput,
): Promise<GradingResult> {
  throw new Error("Agentic grading orchestrator not implemented (Step 7)");
}
