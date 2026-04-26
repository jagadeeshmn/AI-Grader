"use server";

import { revalidatePath } from "next/cache";
import Anthropic from "@anthropic-ai/sdk";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import {
  assignments,
  grades,
  submissions,
  usersSync,
  type CriterionScore,
} from "@/db/schema";
import { retrieveChunks } from "@/lib/rag/retrieval";

const client = new Anthropic();

export async function gradeSubmissionAction(formData: FormData): Promise<void> {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("❌ Unauthorized");

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  if (dbUser?.role !== "instructor" && dbUser?.role !== "admin") {
    throw new Error("❌ Forbidden: instructors and admins only");
  }

  const submissionId = Number(formData.get("submissionId"));

  const [submission] = await db
    .select({
      content: submissions.content,
      assignmentId: submissions.assignmentId,
    })
    .from(submissions)
    .where(eq(submissions.id, submissionId))
    .limit(1);

  if (!submission) throw new Error("Submission not found");

  const [assignment] = await db
    .select({
      title: assignments.title,
      content: assignments.content,
      rubric: assignments.rubric,
      courseId: assignments.courseId,
    })
    .from(assignments)
    .where(eq(assignments.id, submission.assignmentId))
    .limit(1);

  if (!assignment) throw new Error("Assignment not found");
  if (!assignment.rubric || assignment.rubric.length === 0) {
    throw new Error(
      "This assignment has no rubric. Add a rubric before grading.",
    );
  }

  const rubricText = assignment.rubric
    .map(
      (c, i) =>
        `${i + 1}. **${c.criterion}** (${c.maxPoints} pts)\n   ${c.description}`,
    )
    .join("\n\n");

  // RAG: retrieve relevant reference material chunks using rubric as query
  const rubricQuery = assignment.rubric
    .map((c) => `${c.criterion}: ${c.description}`)
    .join("\n");

  const chunks = await retrieveChunks(assignment.courseId, rubricQuery, 5);

  const referenceMaterialSection =
    chunks.length > 0
      ? `## Reference Material\nThe following excerpts from the course reference material are relevant to the grading criteria. Use them to assess the accuracy and completeness of the student's work.\n\n${chunks.map((c, i) => `[${i + 1}] ${c}`).join("\n\n")}\n\n`
      : "";

  const prompt = `You are grading a student submission for the assignment: "${assignment.title}".

${referenceMaterialSection}## Assignment
${assignment.content}

## Rubric
${rubricText}

## Student Submission
${submission.content}

Grade each rubric criterion strictly and fairly.${chunks.length > 0 ? " Ground your assessment in the reference material provided — check factual claims against it." : ""} Award partial credit where deserved. Provide specific, actionable feedback for each criterion, then write a concise overall summary.`;

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    tools: [
      {
        name: "grade_submission",
        description: "Record scores and feedback for each rubric criterion",
        input_schema: {
          type: "object" as const,
          properties: {
            criterionScores: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  criterion: { type: "string" },
                  score: { type: "number" },
                  maxPoints: { type: "number" },
                  feedback: { type: "string" },
                },
                required: ["criterion", "score", "maxPoints", "feedback"],
              },
            },
            overallFeedback: { type: "string" },
          },
          required: ["criterionScores", "overallFeedback"],
        },
      },
    ],
    tool_choice: { type: "tool", name: "grade_submission" },
    messages: [{ role: "user", content: prompt }],
  });

  const toolBlock = response.content.find((b) => b.type === "tool_use");
  if (!toolBlock || toolBlock.type !== "tool_use") {
    throw new Error("AI did not return a structured grade");
  }

  const result = toolBlock.input as {
    criterionScores: CriterionScore[];
    overallFeedback: string;
  };

  const totalScore = result.criterionScores.reduce(
    (sum, c) => sum + c.score,
    0,
  );
  const maxScore = assignment.rubric.reduce((sum, c) => sum + c.maxPoints, 0);

  await db
    .insert(grades)
    .values({
      submissionId,
      criterionScores: result.criterionScores,
      overallFeedback: result.overallFeedback,
      totalScore,
      maxScore,
      source: "ai",
    })
    .onConflictDoUpdate({
      target: grades.submissionId,
      set: {
        criterionScores: result.criterionScores,
        overallFeedback: result.overallFeedback,
        totalScore,
        maxScore,
        source: "ai",
        gradedAt: new Date().toISOString(),
      },
    });

  revalidatePath(`/assignment/${submission.assignmentId}`);
}

export async function overrideGradeAction(
  submissionId: number,
  criterionScores: CriterionScore[],
  overallFeedback: string,
): Promise<void> {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("❌ Unauthorized");

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  if (dbUser?.role !== "instructor" && dbUser?.role !== "admin") {
    throw new Error("❌ Forbidden: instructors and admins only");
  }

  const totalScore = criterionScores.reduce((sum, c) => sum + c.score, 0);

  // Fetch maxScore from the existing grade (assignment rubric is the source of truth)
  const [existing] = await db
    .select({ maxScore: grades.maxScore })
    .from(grades)
    .where(eq(grades.submissionId, submissionId))
    .limit(1);

  if (!existing) throw new Error("No grade exists yet — run AI grading first");

  await db
    .update(grades)
    .set({
      criterionScores,
      overallFeedback,
      totalScore,
      source: "instructor",
      gradedAt: new Date().toISOString(),
    })
    .where(eq(grades.submissionId, submissionId));
}
