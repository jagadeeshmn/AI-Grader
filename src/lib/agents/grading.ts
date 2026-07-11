import type { AgentFn } from "./state";

// Grading Agent: scores the submission per criterion against its context
// bundle, citing evidence chunks. Writes `draftGrade`.
export const gradingAgent: AgentFn = async (_state) => {
  throw new Error("Grading Agent not implemented (Step 4)");
};
