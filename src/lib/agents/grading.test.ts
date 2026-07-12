import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildGradingPrompt, gradingAgent } from "./grading";
import { callStructured } from "./llm";
import { type GradingState, gradeSubmissionOutputSchema } from "./state";

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
      {
        criterion: "Clarity",
        maxPoints: 5,
        description: "Writing is clear.",
      },
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
    draftGrade: null,
    critique: null,
    revisionCount: 0,
    finalGrade: null,
    studentFeedback: null,
    ...overrides,
  };
}

describe("buildGradingPrompt", () => {
  it("renders one section per criterion with its own chunks", () => {
    const prompt = buildGradingPrompt(makeState());

    expect(prompt).toContain("### Criterion 1: Accuracy (10 pts)");
    expect(prompt).toContain("### Criterion 2: Clarity (5 pts)");
    expect(prompt).toContain("[chunk c1] Chlorophyll absorbs light.");
    expect(prompt).toContain("[chunk c2] CO2 is fixed in the Calvin cycle.");
    // Accuracy's chunks belong to Accuracy's section, not Clarity's.
    const accuracyIdx = prompt.indexOf("### Criterion 1: Accuracy");
    const clarityIdx = prompt.indexOf("### Criterion 2: Clarity");
    expect(prompt.indexOf("[chunk c1]")).toBeGreaterThan(accuracyIdx);
    expect(prompt.indexOf("[chunk c1]")).toBeLessThan(clarityIdx);
  });

  it("falls back when a criterion has no chunks", () => {
    const prompt = buildGradingPrompt(makeState());
    expect(prompt).toContain(
      "No reference material retrieved for this criterion.",
    );
  });

  it("falls back when a criterion has no bundle at all", () => {
    const prompt = buildGradingPrompt(makeState({ contextBundles: [] }));
    const occurrences = prompt.split(
      "No reference material retrieved for this criterion.",
    ).length;
    expect(occurrences - 1).toBe(2);
  });

  it("includes assignment, submission, and citation instructions", () => {
    const prompt = buildGradingPrompt(makeState());
    expect(prompt).toContain('"Essay on Photosynthesis"');
    expect(prompt).toContain("Explain how photosynthesis works.");
    expect(prompt).toContain("Plants convert sunlight into energy.");
    expect(prompt).toContain("evidenceChunkIds");
  });

  it("omits the revision section when there is no critique", () => {
    const prompt = buildGradingPrompt(makeState());
    expect(prompt).not.toContain("Reviewer feedback on your previous draft");
  });

  it("includes the revision section when critique notes and a draft exist", () => {
    const draftGrade = [
      {
        criterion: "Accuracy",
        score: 9,
        maxPoints: 10,
        feedback: "Mostly correct.",
        evidenceChunkIds: ["c1"],
      },
    ];
    const prompt = buildGradingPrompt(
      makeState({
        draftGrade,
        critique: { verdict: "revise", notes: "Score not supported by c1." },
      }),
    );
    expect(prompt).toContain("Reviewer feedback on your previous draft");
    expect(prompt).toContain("Score not supported by c1.");
    expect(prompt).toContain('"criterion": "Accuracy"');
  });
});

describe("gradingAgent", () => {
  beforeEach(() => {
    mockCallStructured.mockReset();
  });

  const output = {
    criterionScores: [
      {
        criterion: "Accuracy",
        score: 8,
        maxPoints: 10,
        feedback: "Good grasp of the light reactions.",
        evidenceChunkIds: ["c1"],
      },
    ],
    overallFeedback: "Solid work overall.",
  };

  it("calls callStructured with the grade_submission tool and schema", async () => {
    mockCallStructured.mockResolvedValue(output);

    await gradingAgent(makeState());

    expect(mockCallStructured).toHaveBeenCalledTimes(1);
    const params = mockCallStructured.mock.calls[0][0];
    expect(params.toolName).toBe("grade_submission");
    expect(params.schema).toBe(gradeSubmissionOutputSchema);
    expect(params.model).toBe("claude-haiku-4-5-20251001");
    expect(params.messages).toEqual([
      { role: "user", content: buildGradingPrompt(makeState()) },
    ]);
  });

  it("writes draftGrade and studentFeedback from the tool output", async () => {
    mockCallStructured.mockResolvedValue(output);

    const result = await gradingAgent(makeState());

    expect(result).toEqual({
      draftGrade: output.criterionScores,
      studentFeedback: output.overallFeedback,
    });
  });

  it("propagates callStructured errors unchanged", async () => {
    mockCallStructured.mockRejectedValue(new Error("api down"));
    await expect(gradingAgent(makeState())).rejects.toThrow("api down");
  });
});
