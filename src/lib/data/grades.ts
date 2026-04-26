import db from "@/db/index";
import { grades, submissions } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";

export async function getGradeForSubmission(submissionId: number) {
  const [grade] = await db
    .select()
    .from(grades)
    .where(eq(grades.submissionId, submissionId))
    .limit(1);
  return grade ?? null;
}

export async function getGradesForSubmissions(submissionIds: number[]) {
  if (submissionIds.length === 0) return [];
  return db
    .select()
    .from(grades)
    .where(inArray(grades.submissionId, submissionIds));
}

export async function getGradeForStudent(
  assignmentId: number,
  studentId: string,
) {
  const [result] = await db
    .select({
      id: grades.id,
      submissionId: grades.submissionId,
      criterionScores: grades.criterionScores,
      overallFeedback: grades.overallFeedback,
      totalScore: grades.totalScore,
      maxScore: grades.maxScore,
      source: grades.source,
      gradedAt: grades.gradedAt,
    })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.id))
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId),
      ),
    )
    .limit(1);
  return result ?? null;
}
