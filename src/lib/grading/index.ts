import { gradeSubmissionAgentic } from "@/lib/agents/orchestrator";
import {
  type GradeSubmissionInput,
  type GradingResult,
  gradeSubmission,
} from "./single";

export type {
  GradeSubmissionInput,
  GradingDiagnostics,
  GradingResult,
} from "./single";

export type GradingMode = "single" | "agentic";

export function getGradingMode(): GradingMode {
  return process.env.GRADING_MODE === "agentic" ? "agentic" : "single";
}

// Run-scoped identifiers for tracing (plan Step 10). Optional and ignored by
// the single-pass control, whose GradeSubmissionInput stays untouched.
export type RunGradingInput = GradeSubmissionInput & {
  submissionId?: string;
};

// Dispatches to the grading pipeline selected by GRADING_MODE, or by the
// optional per-call override (used by the eval route to run both modes
// without restarting). "single" (default) is the A/B control — never
// modify its behavior.
export async function runGrading(
  input: RunGradingInput,
  mode: GradingMode = getGradingMode(),
): Promise<GradingResult> {
  if (mode === "agentic") {
    return gradeSubmissionAgentic(input);
  }
  return gradeSubmission(input);
}
