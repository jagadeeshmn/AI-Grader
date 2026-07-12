import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { callStructured } from "./llm";
import { critiqueOutputSchema, gradeSubmissionOutputSchema } from "./state";
import { withUsageCollection } from "./usage";

// Mock the Anthropic SDK so no network calls happen. callStructured must
// route its request through client.messages.create.
const { mockCreate } = vi.hoisted(() => ({ mockCreate: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

function anthropicResponse(content: unknown[]) {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "claude-haiku-4-5-20251001",
    content,
    stop_reason: "tool_use",
    usage: { input_tokens: 10, output_tokens: 10 },
  };
}

function toolUseBlock(name: string, input: unknown) {
  return { type: "tool_use", id: "toolu_test", name, input };
}

const validCritique = {
  verdict: "accept",
  notes: "Scores are grounded in the cited chunks.",
  perCriterionIssues: [],
};

const critiqueParams = {
  model: "claude-haiku-4-5-20251001",
  system: "You are a strict grading reviewer.",
  messages: [{ role: "user" as const, content: "Review this grade." }],
  toolName: "critique_grade",
  toolDescription: "Record the critique verdict",
  schema: critiqueOutputSchema,
};

beforeEach(() => {
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(
    anthropicResponse([toolUseBlock("critique_grade", validCritique)]),
  );
});

describe("callStructured", () => {
  it("forces tool use on the given tool name", async () => {
    await callStructured(critiqueParams);

    expect(mockCreate).toHaveBeenCalledTimes(1);
    const req = mockCreate.mock.calls[0][0];
    expect(req.tool_choice).toEqual({ type: "tool", name: "critique_grade" });
    expect(req.tools).toHaveLength(1);
    expect(req.tools[0].name).toBe("critique_grade");
    expect(req.tools[0].description).toBe("Record the critique verdict");
  });

  it("passes model, system, and messages through to the API", async () => {
    await callStructured(critiqueParams);

    const req = mockCreate.mock.calls[0][0];
    expect(req.model).toBe("claude-haiku-4-5-20251001");
    expect(req.system).toBe("You are a strict grading reviewer.");
    expect(req.messages).toEqual([
      { role: "user", content: "Review this grade." },
    ]);
    expect(req.max_tokens).toBeGreaterThan(0);
  });

  it("respects an explicit maxTokens", async () => {
    await callStructured({ ...critiqueParams, maxTokens: 512 });

    expect(mockCreate.mock.calls[0][0].max_tokens).toBe(512);
  });

  it("derives the tool input_schema from the Zod schema", async () => {
    await callStructured(critiqueParams);

    const inputSchema = mockCreate.mock.calls[0][0].tools[0].input_schema;
    expect(inputSchema.type).toBe("object");
    expect(Object.keys(inputSchema.properties)).toEqual([
      "verdict",
      "notes",
      "perCriterionIssues",
    ]);
    expect(inputSchema.required).toEqual(
      expect.arrayContaining(["verdict", "notes", "perCriterionIssues"]),
    );
    expect(inputSchema.properties.verdict.enum).toEqual(["accept", "revise"]);
  });

  it("derives nested schemas (grade_submission with evidenceChunkIds)", async () => {
    const validGrade = {
      criterionScores: [
        {
          criterion: "Accuracy",
          score: 8,
          maxPoints: 10,
          feedback: "Mostly correct.",
          evidenceChunkIds: ["chunk-1", "chunk-3"],
        },
      ],
      overallFeedback: "Solid work.",
    };
    mockCreate.mockResolvedValue(
      anthropicResponse([toolUseBlock("grade_submission", validGrade)]),
    );

    const result = await callStructured({
      ...critiqueParams,
      toolName: "grade_submission",
      toolDescription: "Record scores and feedback",
      schema: gradeSubmissionOutputSchema,
    });

    const inputSchema = mockCreate.mock.calls[0][0].tools[0].input_schema;
    const itemSchema = inputSchema.properties.criterionScores.items;
    expect(Object.keys(itemSchema.properties)).toEqual([
      "criterion",
      "score",
      "maxPoints",
      "feedback",
      "evidenceChunkIds",
    ]);
    expect(itemSchema.properties.evidenceChunkIds).toMatchObject({
      type: "array",
      items: { type: "string" },
    });
    expect(result).toEqual(validGrade);
  });

  it("returns the tool_use input validated by schema.parse", async () => {
    const result = await callStructured(critiqueParams);

    expect(result).toEqual(validCritique);
    // Type-level check: result is z.infer of the schema.
    const verdict: "accept" | "revise" = result.verdict;
    expect(verdict).toBe("accept");
  });

  it("strips unknown keys via schema.parse (proves validation runs)", async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse([
        toolUseBlock("critique_grade", {
          ...validCritique,
          hallucinatedExtraField: "should be stripped",
        }),
      ]),
    );

    const result = await callStructured(critiqueParams);
    expect(result).not.toHaveProperty("hallucinatedExtraField");
  });

  it("finds the tool_use block even when preceded by other blocks", async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse([
        { type: "text", text: "Thinking..." },
        toolUseBlock("critique_grade", validCritique),
      ]),
    );

    await expect(callStructured(critiqueParams)).resolves.toEqual(
      validCritique,
    );
  });

  it("throws when the response contains no tool_use block", async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse([{ type: "text", text: "I refuse to use tools." }]),
    );

    await expect(callStructured(critiqueParams)).rejects.toThrow();
  });

  it("propagates API errors unchanged (throw, no retry)", async () => {
    const apiError = new Error("529 overloaded_error");
    mockCreate.mockRejectedValue(apiError);

    await expect(callStructured(critiqueParams)).rejects.toBe(apiError);
    expect(mockCreate).toHaveBeenCalledTimes(1); // no retry
  });

  it("throws a ZodError when the tool input fails validation", async () => {
    mockCreate.mockResolvedValue(
      anthropicResponse([
        toolUseBlock("critique_grade", {
          verdict: "maybe", // not in the enum
          notes: 42, // wrong type
          perCriterionIssues: [],
        }),
      ]),
    );

    await expect(callStructured(critiqueParams)).rejects.toThrow(z.ZodError);
  });

  it("records usage (incl. cache fields) inside withUsageCollection", async () => {
    mockCreate.mockResolvedValue({
      ...anthropicResponse([toolUseBlock("critique_grade", validCritique)]),
      usage: {
        input_tokens: 100,
        output_tokens: 40,
        cache_read_input_tokens: 250,
        cache_creation_input_tokens: 75,
      },
    });

    const { usage } = await withUsageCollection(() =>
      callStructured(critiqueParams),
    );

    expect(usage.llmCalls).toBe(1);
    expect(usage.calls[0]).toEqual({
      label: "critique_grade",
      inputTokens: 100,
      outputTokens: 40,
      cacheReadTokens: 250,
      cacheWriteTokens: 75,
    });
  });
});
