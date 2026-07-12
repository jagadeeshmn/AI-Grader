import { describe, expect, it, vi } from "vitest";
import type { AgentFn, GradingState } from "./state";
import { withAgentSpan } from "./tracing";

// No tracer provider is registered in tests, so spans are non-recording —
// withAgentSpan must still be a transparent wrapper around the agent.

function makeState(): GradingState {
  return {
    submissionId: "sub-1",
    courseId: 7,
    assignmentTitle: "Essay",
    assignmentContent: "Write an essay.",
    submissionText: "My essay.",
    rubric: [
      { criterion: "Accuracy", maxPoints: 10, description: "Correct facts." },
    ],
    contextBundles: [],
    draftGrade: null,
    critique: null,
    revisionCount: 0,
    finalGrade: null,
    studentFeedback: null,
  };
}

describe("withAgentSpan", () => {
  it("passes the state through and returns the agent's patch", async () => {
    const patch = { studentFeedback: "Nice work." };
    const agent: AgentFn = vi.fn(async () => patch);
    const state = makeState();

    await expect(withAgentSpan("feedback-agent", agent)(state)).resolves.toBe(
      patch,
    );
    expect(agent).toHaveBeenCalledExactlyOnceWith(state);
  });

  it("propagates agent errors unchanged", async () => {
    const boom = new Error("agent failed");
    const agent: AgentFn = async () => {
      throw boom;
    };

    await expect(
      withAgentSpan("grading-agent", agent)(makeState()),
    ).rejects.toBe(boom);
  });
});
