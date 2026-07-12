// Next.js instrumentation hook: registers the Langfuse tracer provider at
// server startup (plan Step 10). No-op unless LANGFUSE_* keys are set.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { registerTelemetry } = await import("@/lib/telemetry");
  registerTelemetry();
}
