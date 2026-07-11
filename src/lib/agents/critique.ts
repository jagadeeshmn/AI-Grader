import type { AgentFn } from "./state";

// Critique Agent: reviews the draft grade for rubric adherence, evidence
// grounding, and score consistency. Writes `critique` (accept | revise).
export const critiqueAgent: AgentFn = async (_state) => {
  throw new Error("Critique Agent not implemented (Step 5)");
};
