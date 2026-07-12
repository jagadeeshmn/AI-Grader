import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildCritiquePrompt, critiqueAgent } from "./critique";
import { callStructured } from "./llm";
import { critiqueOutputSchema, type GradingState } from "./state";

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
      { criterion: "Clarity", maxPoints: 5, description: "Writing is clear." },
    ],
    contextBundles: [
      {
        criterionId: "Accuracy",
        chunks: [
          { id: "c1", content: "Chlorophyll absorbs light.", score: 0.9 },
          {
            id: "c2",
            content: "CO2 is fixed in the Calvin cycle.",
            score: 0.8,
          },
        ],
      },
      { criterionId: "Clarity", chunks: [] },
    ],
    draftGrade: [
      {
        criterion: "Accuracy",
        score: 8,
        maxPoints: 10,
        feedback: "Covers the light reactions.",
        evidenceChunkIds: ["c1"],
      },
      {
        criterion: "Clarity",
        score: 4,
        maxPoints: 5,
        feedback: "Mostly clear.",
        evidenceChunkIds: [],
      },
    ],
    critique: null,
    revisionCount: 0,
    finalGrade: null,
    studentFeedback: null,
    ...overrides,
  };
}

describe("buildCritiquePrompt", () => {
  it("includes the rubric, submission, and draft grade", () => {
    const prompt = buildCritiquePrompt(makeState());

    expect(prompt).toContain('"Essay on Photosynthesis"');
    expect(prompt).toContain("Plants convert sunlight into energy.");
    expect(prompt).toContain("**Accuracy** (10 pts)");
    expect(prompt).toContain('"criterion": "Accuracy"');
    expect(prompt).toContain('"score": 8');
  });

  it("includes only the cited chunks, with content", () => {
    const prompt = buildCritiquePrompt(makeState());

    expect(prompt).toContain("[chunk c1] Chlorophyll absorbs light.");
    // c2 was retrieved but never cited.
    expect(prompt).not.toContain("Calvin cycle");
  });

  it("marks citations of unknown chunk IDs as unsupported", () => {
    const state = makeState();
    if (state.draftGrade) {
      state.draftGrade[0].evidenceChunkIds = ["ghost"];
    }
    const prompt = buildCritiquePrompt(state);

    expect(prompt).toContain(
      "[chunk ghost] (cited but not among the retrieved chunks",
    );
  });

  it("handles a draft with no citations", () => {
    const state = makeState();
    if (state.draftGrade) {
      for (const g of state.draftGrade) {
        g.evidenceChunkIds = [];
      }
    }
    const prompt = buildCritiquePrompt(state);

    expect(prompt).toContain("No chunks were cited.");
  });

  it("throws when there is no draft grade to review", () => {
    expect(() => buildCritiquePrompt(makeState({ draftGrade: null }))).toThrow(
      "Critique Agent called without a draft grade",
    );
  });
});

describe("critiqueAgent", () => {
  beforeEach(() => {
    mockCallStructured.mockReset();
  });

  const output = {
    verdict: "revise" as const,
    notes: "Accuracy score is not supported by chunk c1.",
    perCriterionIssues: [
      { criterion: "Accuracy", issue: "Citation does not back the claim." },
    ],
  };

  it("calls callStructured with the critique_grade tool and schema", async () => {
    mockCallStructured.mockResolvedValue(output);

    await critiqueAgent(makeState());

    expect(mockCallStructured).toHaveBeenCalledTimes(1);
    const params = mockCallStructured.mock.calls[0][0];
    expect(params.toolName).toBe("critique_grade");
    expect(params.schema).toBe(critiqueOutputSchema);
    expect(params.model).toBe("claude-haiku-4-5-20251001");
    expect(params.messages).toEqual([
      { role: "user", content: buildCritiquePrompt(makeState()) },
    ]);
  });

  it("writes critique with verdict and notes only", async () => {
    mockCallStructured.mockResolvedValue(output);

    const result = await critiqueAgent(makeState());

    expect(result).toEqual({
      critique: {
        verdict: "revise",
        notes: "Accuracy score is not supported by chunk c1.",
      },
    });
  });

  it("propagates callStructured errors unchanged", async () => {
    mockCallStructured.mockRejectedValue(new Error("api down"));
    await expect(critiqueAgent(makeState())).rejects.toThrow("api down");
  });
});
