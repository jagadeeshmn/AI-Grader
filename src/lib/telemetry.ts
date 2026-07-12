import { LangfuseSpanProcessor } from "@langfuse/otel";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";

// Langfuse OTel wiring (plan Step 10). Lazy singleton: registerTelemetry()
// is called once from src/instrumentation.ts; everything is a no-op when
// the Langfuse env keys are absent (tests, single-pass control, CI).

let processor: LangfuseSpanProcessor | null = null;

export function isLangfuseConfigured(): boolean {
  return Boolean(
    process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_SECRET_KEY,
  );
}

export function registerTelemetry(): void {
  if (processor || !isLangfuseConfigured()) return;

  processor = new LangfuseSpanProcessor();
  // register() also installs the AsyncLocalStorage context manager that
  // startActiveObservation nesting depends on.
  new NodeTracerProvider({ spanProcessors: [processor] }).register();
}

// Flush buffered spans; required in serverless/server-action contexts where
// the process may be frozen right after the response is sent.
export async function flushTelemetry(): Promise<void> {
  try {
    await processor?.forceFlush();
  } catch (err) {
    console.error("Langfuse flush failed", err);
  }
}
