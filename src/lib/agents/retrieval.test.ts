import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { retrieveRankedChunks } from "@/lib/rag/retrieval";
import {
  buildCriterionQuery,
  buildSharedQuery,
  getRetrievalMode,
  retrievalAgent,
} from "./retrieval";
import type { GradingState, RankedChunk } from "./state";

vi.mock("@/lib/rag/retrieval", () => ({
  retrieveRankedChunks: vi.fn(),
}));

const mockRetrieve = vi.mocked(retrieveRankedChunks);

const rubric = [
  { criterion: "Accuracy", maxPoints: 10, description: "Facts are correct." },
  { criterion: "Clarity", maxPoints: 5, description: "Writing is clear." },
];

function makeState(overrides: Partial<GradingState> = {}): GradingState {
  return {
    submissionId: "",
    courseId: 7,
    assignmentTitle: "Essay on Photosynthesis",
    assignmentContent: "Explain how photosynthesis works.",
    submissionText: "Plants convert sunlight into energy.",
    rubric,
    contextBundles: [],
    draftGrade: null,
    critique: null,
    revisionCount: 0,
    finalGrade: null,
    studentFeedback: null,
    ...overrides,
  };
}

const sharedChunks: RankedChunk[] = [
  { id: "1", content: "Chlorophyll absorbs light.", score: 0.9 },
  { id: "2", content: "CO2 is fixed in the Calvin cycle.", score: 0.8 },
];

const originalMode = process.env.RETRIEVAL_MODE;

beforeEach(() => {
  mockRetrieve.mockReset();
  delete process.env.RETRIEVAL_MODE;
});

afterEach(() => {
  if (originalMode === undefined) {
    delete process.env.RETRIEVAL_MODE;
  } else {
    process.env.RETRIEVAL_MODE = originalMode;
  }
});

describe("getRetrievalMode", () => {
  it("defaults to shared when RETRIEVAL_MODE is unset", () => {
    expect(getRetrievalMode()).toBe("shared");
  });

  it("returns per_criterion when RETRIEVAL_MODE=per_criterion", () => {
    process.env.RETRIEVAL_MODE = "per_criterion";
    expect(getRetrievalMode()).toBe("per_criterion");
  });

  it("falls back to shared for unknown values", () => {
    process.env.RETRIEVAL_MODE = "bogus";
    expect(getRetrievalMode()).toBe("shared");
  });
});

describe("query templating", () => {
  it("builds a criterion query from name and description", () => {
    expect(buildCriterionQuery(rubric[0])).toBe("Accuracy: Facts are correct.");
  });

  it("joins criterion queries with newlines for the shared query", () => {
    expect(buildSharedQuery(rubric)).toBe(
      "Accuracy: Facts are correct.\nClarity: Writing is clear.",
    );
  });
});

describe("retrievalAgent (shared mode)", () => {
  it("makes one rubric-wide retrieval call (top 15 → top 5)", async () => {
    mockRetrieve.mockResolvedValue(sharedChunks);

    await retrievalAgent(makeState());

    expect(mockRetrieve).toHaveBeenCalledTimes(1);
    expect(mockRetrieve).toHaveBeenCalledWith(
      7,
      "Accuracy: Facts are correct.\nClarity: Writing is clear.",
      15,
      5,
    );
  });

  it("writes the same chunks into one bundle per criterion", async () => {
    mockRetrieve.mockResolvedValue(sharedChunks);

    const result = await retrievalAgent(makeState());

    expect(result.contextBundles).toEqual([
      { criterionId: "Accuracy", chunks: sharedChunks },
      { criterionId: "Clarity", chunks: sharedChunks },
    ]);
  });
});

describe("retrievalAgent (per_criterion mode)", () => {
  beforeEach(() => {
    process.env.RETRIEVAL_MODE = "per_criterion";
  });

  it("makes one retrieval call per criterion (top 15 → top 3)", async () => {
    mockRetrieve.mockResolvedValue([]);

    await retrievalAgent(makeState());

    expect(mockRetrieve).toHaveBeenCalledTimes(2);
    expect(mockRetrieve).toHaveBeenCalledWith(
      7,
      "Accuracy: Facts are correct.",
      15,
      3,
    );
    expect(mockRetrieve).toHaveBeenCalledWith(
      7,
      "Clarity: Writing is clear.",
      15,
      3,
    );
  });

  it("routes each criterion's chunks into its own bundle", async () => {
    const accuracyChunks: RankedChunk[] = [
      { id: "1", content: "Chlorophyll absorbs light.", score: 0.9 },
    ];
    const clarityChunks: RankedChunk[] = [
      { id: "3", content: "Topic sentences aid clarity.", score: 0.7 },
    ];
    mockRetrieve.mockImplementation(async (_courseId, query) =>
      query.startsWith("Accuracy") ? accuracyChunks : clarityChunks,
    );

    const result = await retrievalAgent(makeState());

    expect(result.contextBundles).toEqual([
      { criterionId: "Accuracy", chunks: accuracyChunks },
      { criterionId: "Clarity", chunks: clarityChunks },
    ]);
  });

  it("propagates retrieval errors unchanged", async () => {
    mockRetrieve.mockRejectedValue(new Error("voyage down"));
    await expect(retrievalAgent(makeState())).rejects.toThrow("voyage down");
  });
});
