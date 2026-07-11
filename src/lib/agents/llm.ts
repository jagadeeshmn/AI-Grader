import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

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

  const response = await client.messages.create({
    model,
    system,
    messages,
    max_tokens: maxTokens,
    tools: [
      {
        name: toolName,
        description: toolDescription,
        input_schema: z.toJSONSchema(schema) as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: toolName },
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error(`Model returned no tool_use block for ${toolName}`);
  }

  return schema.parse(toolBlock.input);
}
