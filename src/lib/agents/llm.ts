import Anthropic from "@anthropic-ai/sdk";
import { startActiveObservation } from "@langfuse/tracing";
import { z } from "zod";
import { recordUsage } from "./usage";

const client = new Anthropic();

export interface CallStructuredParams<S extends z.ZodType> {
  model: string;
  system?: string;
  messages: Anthropic.MessageParam[];
  toolName: string;
  toolDescription: string;
  schema: S;
  maxTokens?: number;
}

// Shared structured-output helper (plan Step 4): forces tool use on
// `toolName`, derives the tool's input_schema from `schema` via
// z.toJSONSchema(), and validates the returned tool_use input with
// schema.parse() — one Zod schema as the single source of truth for the
// API schema, runtime validation, and the return type.
// Failure contract (encoded in llm.test.ts): throw, no retry — API errors
// and ZodErrors propagate unchanged.
export async function callStructured<S extends z.ZodType>(
  params: CallStructuredParams<S>,
): Promise<z.infer<S>> {
  const {
    model,
    system,
    messages,
    toolName,
    toolDescription,
    schema,
    maxTokens = 2048,
  } = params;

  // Langfuse generation (plan Step 10): prompt, model, token usage incl.
  // cache reads/writes; latency comes from the span duration. A no-op when
  // no tracer provider is registered (tests, unconfigured envs).
  return startActiveObservation(
    toolName,
    async (generation) => {
      generation.update({
        model,
        modelParameters: { max_tokens: maxTokens },
        input: { system, messages },
      });

      try {
        const response = await client.messages.create({
          model,
          system,
          messages,
          max_tokens: maxTokens,
          tools: [
            {
              name: toolName,
              description: toolDescription,
              input_schema: z.toJSONSchema(
                schema,
              ) as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: "tool", name: toolName },
        });

        const toolBlock = response.content.find((b) => b.type === "tool_use");
        if (!toolBlock || toolBlock.type !== "tool_use") {
          throw new Error(`Model returned no tool_use block for ${toolName}`);
        }

        // Record raw output, usage, and stop_reason before validation so a
        // ZodError still leaves full diagnostics (e.g. a max_tokens
        // truncation) on the generation.
        generation.update({
          output: toolBlock.input,
          usageDetails: {
            input: response.usage?.input_tokens ?? 0,
            output: response.usage?.output_tokens ?? 0,
            cache_read_input_tokens:
              response.usage?.cache_read_input_tokens ?? 0,
            cache_creation_input_tokens:
              response.usage?.cache_creation_input_tokens ?? 0,
          },
          metadata: { stop_reason: response.stop_reason },
        });

        // Eval-only usage collection; no-op outside withUsageCollection().
        recordUsage({
          label: toolName,
          inputTokens: response.usage?.input_tokens ?? 0,
          outputTokens: response.usage?.output_tokens ?? 0,
          cacheReadTokens: response.usage?.cache_read_input_tokens ?? 0,
          cacheWriteTokens: response.usage?.cache_creation_input_tokens ?? 0,
        });

        return schema.parse(toolBlock.input);
      } catch (err) {
        generation.update({ level: "ERROR", statusMessage: String(err) });
        throw err; // rethrow unchanged: throw-no-retry contract
      }
    },
    { asType: "generation" },
  );
}
