import { callStructured } from "./llm";
import { type AgentFn, critiqueOutputSchema, type GradingState } from "./state";
import { withAgentSpan } from "./tracing";

// Same model as the other agents.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are a strict grading reviewer. You audit draft grades produced by another grader and either accept them or send them back for revision. You do not re-grade the submission yourself.`;

// Pure prompt builder (plan Step 5): gives the reviewer the rubric, the
// draft grade, and the cited chunks so it can verify three things — scores
// follow the rubric point scale, each rationale is supported by its cited
// chunks, and scores are internally consistent.
export function buildCritiquePrompt(state: GradingState): string {
  if (!state.draftGrade) {
    throw new Error("Critique Agent called without a draft grade");
  }

  const chunksById = new Map(
    state.contextBundles.flatMap((b) => b.chunks.map((ch) => [ch.id, ch])),
  );

  const citedChunkIds = [
    ...new Set(state.draftGrade.flatMap((g) => g.evidenceChunkIds)),
  ];
  const citedChunksSection =
    citedChunkIds.length > 0
      ? citedChunkIds
          .map((id) => {
            const chunk = chunksById.get(id);
            return chunk
              ? `[chunk ${id}] ${chunk.content}`
              : `[chunk ${id}] (cited but not among the retrieved chunks — treat this citation as unsupported)`;
          })
          .join("\n\n")
      : "No chunks were cited.";

  const rubricText = state.rubric
    .map(
      (c, i) =>
        `${i + 1}. **${c.criterion}** (${c.maxPoints} pts)\n   ${c.description}`,
    )
    .join("\n\n");

  return `Review this draft grade for the assignment: "${state.assignmentTitle}".

## Student Submission
${state.submissionText}

## Rubric
${rubricText}

## Draft Grade
${JSON.stringify(state.draftGrade, null, 2)}

## Cited Reference Chunks
${citedChunksSection}

Check three things:
1. Does each score respect the rubric point scale (0 to maxPoints, matching the criterion's maxPoints)?
2. Is each rationale supported by the chunks it cites? A citation of a chunk that does not back the claim counts as unsupported.
3. Are the scores internally consistent with each other and with the feedback text?

If everything holds, return verdict "accept" with brief notes. Otherwise return verdict "revise", list each problem in perCriterionIssues, and write notes as concrete instructions the grader can act on.`;
}

// Critique Agent (plan Step 5): writes `critique`. The orchestrator decides
// whether to loop back to the Grading Agent based on the verdict.
export const critiqueAgent: AgentFn = withAgentSpan(
  "critique-agent",
  async (state) => {
    const output = await callStructured({
      model: MODEL,
      system: SYSTEM,
      messages: [{ role: "user", content: buildCritiquePrompt(state) }],
      toolName: "critique_grade",
      toolDescription:
        "Record the review verdict, actionable notes, and per-criterion issues for a draft grade",
      schema: critiqueOutputSchema,
      maxTokens: 2048,
    });

    return {
      critique: { verdict: output.verdict, notes: output.notes },
    };
  },
);
