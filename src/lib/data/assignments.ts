import db from "@/db/index";
import { assignments, submissions, usersSync } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function getAssignments() {
  const response = await db
    .select({
      title: assignments.title,
      id: assignments.id,
      createdAt: assignments.createdAt,
      content: assignments.content,
      author: usersSync.name,
    })
    .from(assignments)
    .leftJoin(usersSync, eq(assignments.authorId, usersSync.id));
  return response;
}

export async function getAssignmentById(id: number) {
  const response = await db
    .select({
      title: assignments.title,
      id: assignments.id,
      createdAt: assignments.createdAt,
      content: assignments.content,
      author: usersSync.name,
      imageUrl: assignments.imageUrl,
      deadline: assignments.deadline,
      rubric: assignments.rubric,
      authorId: assignments.authorId,
      courseId: assignments.courseId,
    })
    .from(assignments)
    .where(eq(assignments.id, id))
    .leftJoin(usersSync, eq(assignments.authorId, usersSync.id));
  return response[0] ? response[0] : null;
}

export async function getAssignmentSubmissions(assignmentId: number) {
  return db
    .select({
      id: submissions.id,
      content: submissions.content,
      submittedAt: submissions.submittedAt,
      studentId: submissions.studentId,
      studentName: usersSync.name,
      studentEmail: usersSync.email,
    })
    .from(submissions)
    .innerJoin(usersSync, eq(submissions.studentId, usersSync.id))
    .where(eq(submissions.assignmentId, assignmentId))
    .orderBy(submissions.submittedAt);
}

export async function getSubmissionByStudent(
  assignmentId: number,
  studentId: string,
) {
  const [row] = await db
    .select({
      id: submissions.id,
      content: submissions.content,
      submittedAt: submissions.submittedAt,
    })
    .from(submissions)
    .where(
      and(
        eq(submissions.assignmentId, assignmentId),
        eq(submissions.studentId, studentId),
      ),
    )
    .limit(1);
  return row ?? null;
}
