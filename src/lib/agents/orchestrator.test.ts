import { beforeEach, describe, expect, it, vi } from "vitest";
import type { GradeSubmissionInput } from "@/lib/grading";
import { critiqueAgent } from "./critique";
import { feedbackAgent } from "./feedback";
import { gradingAgent } from "./grading";
import {
  gradeSubmissionAgentic,
  initState,
  MAX_REVISIONS,
  toResult,
} from "./orchestrator";
import { retrievalAgent } from "./retrieval";
import type { GradingState, PerCriterionGrade } from "./state";

vi.mock("./retrieval", () => ({
  retrievalAgent: vi.fn(),
  getRetrievalMode: () => "shared",
}));
vi.mock("./grading", () => ({ gradingAgent: vi.fn() }));
vi.mock("./critique", () => ({ critiqueAgent: vi.fn() }));
vi.mock("./feedback", () => ({ feedbackAgent: vi.fn() }));

const mockRetrieval = vi.mocked(retrievalAgent);
const mockGrading = vi.mocked(gradingAgent);
const mockCritique = vi.mocked(critiqueAgent);
const mockFeedback = vi.mocked(feedbackAgent);

const input: GradeSubmissionInput = {
  courseId: 7,
  assignmentTitle: "Essay",
  assignmentContent: "Write an essay.",
  rubric: [
    { criterion: "Accuracy", maxPoints: 10, description: "Correct facts." },
    { criterion: "Clarity", maxPoints: 5, description: "Clear writing." },
  ],
  submissionText: "My essay.",
};

describe("initState", () => {
  it("maps the input and initializes pipeline fields", () => {
    const state = initState(input);

    expect(state).toEqual({
      submissionId: "",
      courseId: 7,
      assignmentTitle: "Essay",
      assignmentContent: "Write an essay.",
      submissionText: "My essay.",
      rubric: input.rubric,
      contextBundles: [],
      draftGrade: null,
      critique: null,
      revisionCount: 0,
      finalGrade: null,
      studentFeedback: null,
    });
  });

  it("threads submissionId into the state when provided", () => {
    expect(initState({ ...input, submissionId: "42" }).submissionId).toBe("42");
  });
});

describe("toResult", () => {
  function finishedState(): GradingState {
    return {
      ...initState(input),
      finalGrade: [
        {
          criterion: "Accuracy",
          score: 8,
          maxPoints: 10,
          feedback: "Good.",
          evidenceChunkIds: ["c1", "c2"],
        },
        {
          criterion: "Clarity",
          score: 4,
          maxPoints: 5,
          feedback: "Clear.",
          evidenceChunkIds: [],
        },
      ],
      studentFeedback: "Nice work.",
    };
  }

  it("strips evidenceChunkIds down to CriterionScore shape", () => {
    const result = toResult(finishedState());

    expect(result.criterionScores).toEqual([
      { criterion: "Accuracy", score: 8, maxPoints: 10, feedback: "Good." },
      { criterion: "Clarity", score: 4, maxPoints: 5, feedback: "Clear." },
    ]);
    expect(result.overallFeedback).toBe("Nice work.");
  });

  it("computes totalScore from scores and maxScore from the rubric", () => {
    const result = toResult(finishedState());
    expect(result.totalScore).toBe(12);
    expect(result.maxScore).toBe(15);
  });

  it("throws if the pipeline finished without a final grade", () => {
    expect(() => toResult(initState(input))).toThrow(
      "Grading pipeline finished without a final grade",
    );
  });

  it("carries revision diagnostics into the result", () => {
    const result = toResult(
      {
        ...finishedState(),
        revisionCount: 1,
        critique: { verdict: "accept", notes: "ok" },
      },
      { needsReview: false },
    );
    expect(result.diagnostics).toEqual({
      revisionCount: 1,
      critiqueVerdict: "accept",
      needsReview: false,
    });
  });
});

describe("gradeSubmissionAgentic critique loop", () => {
  function draft(score: number): PerCriterionGrade[] {
    return [
      {
        criterion: "Accuracy",
        score,
        maxPoints: 10,
        feedback: "F",
        evidenceChunkIds: [],
      },
      {
        criterion: "Clarity",
        score: 4,
        maxPoints: 5,
        feedback: "F",
        evidenceChunkIds: [],
      },
    ];
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockRetrieval.mockResolvedValue({ contextBundles: [] });
    mockFeedback.mockResolvedValue({ studentFeedback: "Student feedback." });
  });

  it("accepts on the first pass: one grading call, revisionCount 0", async () => {
    mockGrading.mockResolvedValue({
      draftGrade: draft(8),
      studentFeedback: "s",
    });
    mockCritique.mockResolvedValue({
      critique: { verdict: "accept", notes: "" },
    });

    const result = await gradeSubmissionAgentic(input);

    expect(mockGrading).toHaveBeenCalledTimes(1);
    expect(mockCritique).toHaveBeenCalledTimes(1);
    expect(result.diagnostics).toEqual({
      revisionCount: 0,
      critiqueVerdict: "accept",
      needsReview: false,
    });
  });

  it("revises once then accepts: two grading calls, revisionCount 1", async () => {
    mockGrading
      .mockResolvedValueOnce({ draftGrade: draft(9), studentFeedback: "s" })
      .mockResolvedValueOnce({ draftGrade: draft(7), studentFeedback: "s" });
    mockCritique
      .mockResolvedValueOnce({
        critique: { verdict: "revise", notes: "too generous" },
      })
      .mockResolvedValueOnce({ critique: { verdict: "accept", notes: "" } });

    const result = await gradeSubmissionAgentic(input);

    expect(mockGrading).toHaveBeenCalledTimes(2);
    expect(mockCritique).toHaveBeenCalledTimes(2);
    // The second grading call sees the critique notes in its state.
    expect(mockGrading.mock.calls[1][0].critique?.notes).toBe("too generous");
    expect(result.totalScore).toBe(11); // final = latest draft (7 + 4)
    expect(result.diagnostics).toEqual({
      revisionCount: 1,
      critiqueVerdict: "accept",
      needsReview: false,
    });
  });

  it("stops at the revision cap and flags needsReview", async () => {
    mockGrading.mockResolvedValue({
      draftGrade: draft(6),
      studentFeedback: "s",
    });
    mockCritique.mockResolvedValue({
      critique: { verdict: "revise", notes: "still wrong" },
    });

    const result = await gradeSubmissionAgentic(input);

    expect(mockGrading).toHaveBeenCalledTimes(1 + MAX_REVISIONS);
    expect(mockCritique).toHaveBeenCalledTimes(1 + MAX_REVISIONS);
    expect(result.diagnostics).toEqual({
      revisionCount: MAX_REVISIONS,
      critiqueVerdict: "revise",
      needsReview: true,
    });
  });
});
