import { afterEach, describe, expect, it } from "vitest";
import { flushTelemetry, isLangfuseConfigured } from "./telemetry";

afterEach(() => {
  delete process.env.LANGFUSE_PUBLIC_KEY;
  delete process.env.LANGFUSE_SECRET_KEY;
});

describe("isLangfuseConfigured", () => {
  it("is false without env vars", () => {
    expect(isLangfuseConfigured()).toBe(false);
  });

  it("requires both keys", () => {
    process.env.LANGFUSE_PUBLIC_KEY = "pk";
    expect(isLangfuseConfigured()).toBe(false);
    process.env.LANGFUSE_SECRET_KEY = "sk";
    expect(isLangfuseConfigured()).toBe(true);
  });
});

describe("flushTelemetry", () => {
  it("resolves as a no-op when telemetry was never registered", async () => {
    await expect(flushTelemetry()).resolves.toBeUndefined();
  });
});
