import { startActiveObservation } from "@langfuse/tracing";
import type { AgentFn, GradingState } from "./state";

// Compact span input: enough to identify the run without duplicating the
// full submission/assignment text on every agent span.
function summarizeState(state: GradingState) {
  return {
    submissionId: state.submissionId,
    courseId: state.courseId,
    assignmentTitle: state.assignmentTitle,
    rubricCriteria: state.rubric.map((c) => c.criterion),
    contextBundles: state.contextBundles.length,
    revisionCount: state.revisionCount,
  };
}

// Wraps an agent in a Langfuse "agent" observation (plan Step 10): one span
// per agent run, recording a compact state summary as input and the state
// patch as output. A no-op when no tracer provider is registered.
export function withAgentSpan(name: string, fn: AgentFn): AgentFn {
  return (state) =>
    startActiveObservation(
      name,
      async (span) => {
        span.update({ input: summarizeState(state) });
        try {
          const patch = await fn(state);
          span.update({ output: patch });
          return patch;
        } catch (err) {
          span.update({ level: "ERROR", statusMessage: String(err) });
          throw err;
        }
      },
      { asType: "agent" },
    );
}
