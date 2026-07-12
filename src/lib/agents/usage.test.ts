import { describe, expect, it } from "vitest";
import { recordUsage, type UsageEntry, withUsageCollection } from "./usage";

function entry(overrides: Partial<UsageEntry> = {}): UsageEntry {
  return {
    label: "grade_submission",
    inputTokens: 100,
    outputTokens: 50,
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
    ...overrides,
  };
}

describe("recordUsage", () => {
  it("is a no-op outside withUsageCollection", () => {
    expect(() => recordUsage(entry())).not.toThrow();
  });
});

describe("withUsageCollection", () => {
  it("returns the wrapped function's value", async () => {
    const { value } = await withUsageCollection(async () => 42);
    expect(value).toBe(42);
  });

  it("accumulates totals across multiple calls", async () => {
    const { usage } = await withUsageCollection(async () => {
      recordUsage(entry());
      recordUsage(
        entry({
          label: "critique_grade",
          inputTokens: 200,
          outputTokens: 30,
          cacheReadTokens: 0,
          cacheWriteTokens: 0,
        }),
      );
    });

    expect(usage.llmCalls).toBe(2);
    expect(usage.inputTokens).toBe(300);
    expect(usage.outputTokens).toBe(80);
    expect(usage.cacheReadTokens).toBe(10);
    expect(usage.cacheWriteTokens).toBe(5);
    expect(usage.calls.map((c) => c.label)).toEqual([
      "grade_submission",
      "critique_grade",
    ]);
  });

  it("isolates concurrent collections", async () => {
    const [a, b] = await Promise.all([
      withUsageCollection(async () => {
        await new Promise((r) => setTimeout(r, 5));
        recordUsage(entry({ inputTokens: 1 }));
      }),
      withUsageCollection(async () => {
        recordUsage(entry({ inputTokens: 2 }));
        recordUsage(entry({ inputTokens: 3 }));
      }),
    ]);

    expect(a.usage.llmCalls).toBe(1);
    expect(a.usage.inputTokens).toBe(1);
    expect(b.usage.llmCalls).toBe(2);
    expect(b.usage.inputTokens).toBe(5);
  });
});
