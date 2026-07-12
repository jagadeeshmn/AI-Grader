import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeedbackPrompt, feedbackAgent } from "./feedback";
import { callStructured } from "./llm";
import { feedbackOutputSchema, type GradingState } from "./state";

vi.mock("./llm", () => ({
  callStructured: vi.fn(),
}));

const mockCallStructured = vi.mocked(callStructured);

function makeState(overrides: Partial<GradingState> = {}): GradingState {
  return {
    submissionId: "",
    courseId: 1,
    assignmentTitle: "Essay on Photosynthesis",
    assignmentContent: "Explain how photosynthesis works.",
    submissionText: "Plants convert sunlight into energy.",
    rubric: [
      {
        criterion: "Accuracy",
        maxPoints: 10,
        description: "Facts are correct.",
      },
    ],
    contextBundles: [],
    draftGrade: null,
    critique: null,
    revisionCount: 0,
    finalGrade: [
      {
        criterion: "Accuracy",
        score: 8,
        maxPoints: 10,
        feedback: "Light reactions correct; Calvin cycle missing.",
        evidenceChunkIds: ["c1", "c2"],
      },
    ],
    studentFeedback: "Solid grasp overall, gaps in the dark reactions.",
    ...overrides,
  };
}

describe("buildFeedbackPrompt", () => {
  it("includes the assignment title, per-criterion grades, and rationale", () => {
    const prompt = buildFeedbackPrompt(makeState());

    expect(prompt).toContain('"Essay on Photosynthesis"');
    expect(prompt).toContain("### Accuracy — 8/10");
    expect(prompt).toContain("Light reactions correct; Calvin cycle missing.");
  });

  it("includes the grader's overall summary when present", () => {
    const prompt = buildFeedbackPrompt(makeState());
    expect(prompt).toContain(
      "Solid grasp overall, gaps in the dark reactions.",
    );
  });

  it("omits the overall summary section when studentFeedback is null", () => {
    const prompt = buildFeedbackPrompt(makeState({ studentFeedback: null }));
    expect(prompt).not.toContain("Grader's overall summary");
  });

  it("never leaks evidence chunk IDs into the prompt", () => {
    const prompt = buildFeedbackPrompt(makeState());
    expect(prompt).not.toContain("c1");
    expect(prompt).not.toContain("c2");
    expect(prompt).not.toContain("evidenceChunkIds");
  });

  it("throws without a final grade", () => {
    expect(() => buildFeedbackPrompt(makeState({ finalGrade: null }))).toThrow(
      "Feedback Agent called without a final grade",
    );
  });
});

describe("feedbackAgent", () => {
  beforeEach(() => {
    mockCallStructured.mockReset();
  });

  it("calls callStructured with the write_student_feedback tool and schema", async () => {
    mockCallStructured.mockResolvedValue({ feedback: "Great start!" });

    await feedbackAgent(makeState());

    expect(mockCallStructured).toHaveBeenCalledTimes(1);
    const params = mockCallStructured.mock.calls[0][0];
    expect(params.toolName).toBe("write_student_feedback");
    expect(params.schema).toBe(feedbackOutputSchema);
    expect(params.model).toBe("claude-haiku-4-5-20251001");
    expect(params.messages).toEqual([
      { role: "user", content: buildFeedbackPrompt(makeState()) },
    ]);
  });

  it("overwrites studentFeedback with the student-facing markdown", async () => {
    mockCallStructured.mockResolvedValue({
      feedback: "## What went well\nYou nailed the light reactions.",
    });

    const result = await feedbackAgent(makeState());

    expect(result).toEqual({
      studentFeedback: "## What went well\nYou nailed the light reactions.",
    });
  });

  it("propagates callStructured errors unchanged", async () => {
    mockCallStructured.mockRejectedValue(new Error("api down"));
    await expect(feedbackAgent(makeState())).rejects.toThrow("api down");
  });
});
