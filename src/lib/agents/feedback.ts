import { callStructured } from "./llm";
import { type AgentFn, feedbackOutputSchema, type GradingState } from "./state";
import { withAgentSpan } from "./tracing";

// Same model as the other agents.
const MODEL = "claude-haiku-4-5-20251001";

const SYSTEM = `You are a supportive teacher writing feedback for a student. You turn internal grading notes into encouraging, actionable feedback the student reads directly. Never mention rubric mechanics, reference chunks, chunk IDs, graders, reviewers, or any other internals of how the grade was produced.`;

// Pure prompt builder (plan Step 6): gives the agent the final grade and the
// grader's internal rationale, stripped of evidence chunk IDs so scoring
// internals cannot leak into the student-facing text.
export function buildFeedbackPrompt(state: GradingState): string {
  if (!state.finalGrade) {
    throw new Error("Feedback Agent called without a final grade");
  }

  const gradeSection = state.finalGrade
    .map(
      (g) =>
        `### ${g.criterion} — ${g.score}/${g.maxPoints}\nInternal rationale: ${g.feedback}`,
    )
    .join("\n\n");

  const overallSection = state.studentFeedback
    ? `\n## Grader's overall summary (internal)\n${state.studentFeedback}\n`
    : "";

  return `A student submitted work for the assignment: "${state.assignmentTitle}".

## Final grade (internal rationale per criterion)
${gradeSection}
${overallSection}
Write the feedback the student will read, as markdown with three parts:
1. What was done well
2. What to improve
3. Concrete next steps

Be encouraging and specific — refer to what the student actually wrote, not to the grading process. Do not restate the scores mechanically, do not use internal jargon (criteria, rubric points, chunks, rationale), and do not mention that this feedback was generated from grading notes.`;
}

// Feedback Agent (plan Step 6): rewrites the internal rationale into
// student-facing markdown, overwriting studentFeedback (which until now held
// the Grading Agent's internal overall summary). Grading rationale optimizes
// for accuracy; this optimizes for pedagogy — hence a separate agent.
export const feedbackAgent: AgentFn = withAgentSpan(
  "feedback-agent",
  async (state) => {
    const output = await callStructured({
      model: MODEL,
      system: SYSTEM,
      messages: [{ role: "user", content: buildFeedbackPrompt(state) }],
      toolName: "write_student_feedback",
      toolDescription:
        "Record the student-facing markdown feedback for a graded submission",
      schema: feedbackOutputSchema,
      // 2048 like the other agents: 1024 truncated markdown feedback
      // mid-JSON (stop_reason max_tokens), dropping the `feedback` field.
      maxTokens: 2048,
    });

    return { studentFeedback: output.feedback };
  },
);
