import type { AgentFn } from "./state";

// Feedback Agent: rewrites the internal grading rationale into student-facing
// markdown feedback. Writes `studentFeedback`.
export const feedbackAgent: AgentFn = async (_state) => {
  throw new Error("Feedback Agent not implemented (Step 6)");
};
