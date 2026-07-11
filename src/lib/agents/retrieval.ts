import type { AgentFn } from "./state";

// Retrieval Agent: turns the rubric into one query per criterion, retrieves
// and reranks chunks, and writes `contextBundles`.
export const retrievalAgent: AgentFn = async (_state) => {
  throw new Error("Retrieval Agent not implemented (Step 3)");
};
