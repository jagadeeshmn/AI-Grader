import { AsyncLocalStorage } from "node:async_hooks";

// Observational token-usage collector for the eval harness. LLM call sites
// call recordUsage(); it is a no-op unless the caller opted in by wrapping
// the run in withUsageCollection() — the production path is untouched.

export interface UsageEntry {
  label: string; // tool/call name, e.g. "grade_submission"
  inputTokens: number; // regular (non-cached) input tokens
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface UsageTotals {
  calls: UsageEntry[];
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  llmCalls: number;
}

const store = new AsyncLocalStorage<UsageTotals>();

export function recordUsage(entry: UsageEntry): void {
  const totals = store.getStore();
  if (!totals) return; // no active collection: no-op
  totals.calls.push(entry);
  totals.inputTokens += entry.inputTokens;
  totals.outputTokens += entry.outputTokens;
  totals.cacheReadTokens += entry.cacheReadTokens;
  totals.cacheWriteTokens += entry.cacheWriteTokens;
  totals.llmCalls += 1;
}

export async function withUsageCollection<T>(
  fn: () => Promise<T>,
): Promise<{ value: T; usage: UsageTotals }> {
  const usage: UsageTotals = {
    calls: [],
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    llmCalls: 0,
  };
  const value = await store.run(usage, fn);
  return { value, usage };
}
