"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import db from "@/db/index";
import {
  assignments,
  type CriterionScore,
  grades,
  submissions,
  usersSync,
} from "@/db/schema";
import { runGrading } from "@/lib/grading";
import { stackServerApp } from "@/stack/server";

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

  const result = await runGrading({
    submissionId: String(submissionId),
    courseId: assignment.courseId,
    assignmentTitle: assignment.title,
    assignmentContent: assignment.content,
    rubric: assignment.rubric,
    submissionText: submission.content,
  });

  await db
    .insert(grades)
    .values({
      submissionId,
      criterionScores: result.criterionScores,
      overallFeedback: result.overallFeedback,
      totalScore: result.totalScore,
      maxScore: result.maxScore,
      source: "ai",
      revisionCount: result.diagnostics?.revisionCount ?? 0,
      needsReview: result.diagnostics?.needsReview ?? false,
    })
    .onConflictDoUpdate({
      target: grades.submissionId,
      set: {
        criterionScores: result.criterionScores,
        overallFeedback: result.overallFeedback,
        totalScore: result.totalScore,
        maxScore: result.maxScore,
        source: "ai",
        revisionCount: result.diagnostics?.revisionCount ?? 0,
        needsReview: result.diagnostics?.needsReview ?? false,
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
