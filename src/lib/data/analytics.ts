import db from "@/db/index";
import {
  assignments,
  courseStudents,
  courses,
  grades,
  submissions,
  usersSync,
} from "@/db/schema";
import { and, avg, count, eq, isNull, sql } from "drizzle-orm";

// ── List all courses with enrollment + assignment counts ──────────────────────
export async function listCourses() {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorName: usersSync.name,
      enrollmentCount: count(courseStudents.studentId),
    })
    .from(courses)
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id))
    .leftJoin(courseStudents, eq(courses.id, courseStudents.courseId))
    .groupBy(courses.id, usersSync.name)
    .orderBy(courses.name);
}

// ── High-level summary for one course ────────────────────────────────────────
export async function getCourseSummary(courseId: number) {
  const [course] = await db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorName: usersSync.name,
    })
    .from(courses)
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id))
    .where(eq(courses.id, courseId))
    .limit(1);

  if (!course) return null;

  const [{ enrollment }] = await db
    .select({ enrollment: count(courseStudents.studentId) })
    .from(courseStudents)
    .where(eq(courseStudents.courseId, courseId));

  const [{ assignmentCount }] = await db
    .select({ assignmentCount: count(assignments.id) })
    .from(assignments)
    .where(eq(assignments.courseId, courseId));

  const [{ totalSubmissions }] = await db
    .select({ totalSubmissions: count(submissions.id) })
    .from(submissions)
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(assignments.courseId, courseId));

  const [{ gradedCount }] = await db
    .select({ gradedCount: count(grades.id) })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(assignments.courseId, courseId));

  const avgGradeRow = await db
    .select({
      avgPct: avg(
        sql<number>`(${grades.totalScore}::float / ${grades.maxScore}::float) * 100`,
      ),
    })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .where(eq(assignments.courseId, courseId));

  const maxPossibleSubmissions = Number(enrollment) * Number(assignmentCount);

  return {
    ...course,
    enrollment: Number(enrollment),
    assignmentCount: Number(assignmentCount),
    totalSubmissions: Number(totalSubmissions),
    submissionRate:
      maxPossibleSubmissions > 0
        ? Math.round((Number(totalSubmissions) / maxPossibleSubmissions) * 100)
        : 0,
    gradedCount: Number(gradedCount),
    avgGradePct:
      avgGradeRow[0]?.avgPct != null
        ? Math.round(Number(avgGradeRow[0].avgPct))
        : null,
  };
}

// ── Per-assignment submission + grade stats for a course ──────────────────────
export async function getSubmissionStats(courseId: number) {
  const courseAssignments = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      deadline: assignments.deadline,
    })
    .from(assignments)
    .where(eq(assignments.courseId, courseId))
    .orderBy(assignments.createdAt);

  const [{ enrolled }] = await db
    .select({ enrolled: count(courseStudents.studentId) })
    .from(courseStudents)
    .where(eq(courseStudents.courseId, courseId));

  const enrolledCount = Number(enrolled);

  const stats = await Promise.all(
    courseAssignments.map(async (assignment) => {
      const [{ submitted }] = await db
        .select({ submitted: count(submissions.id) })
        .from(submissions)
        .where(eq(submissions.assignmentId, assignment.id));

      const avgRow = await db
        .select({
          avgPct: avg(
            sql<number>`(${grades.totalScore}::float / ${grades.maxScore}::float) * 100`,
          ),
        })
        .from(grades)
        .innerJoin(submissions, eq(grades.submissionId, submissions.id))
        .where(eq(submissions.assignmentId, assignment.id));

      const submittedCount = Number(submitted);
      return {
        assignmentId: assignment.id,
        title: assignment.title,
        deadline: assignment.deadline,
        enrolled: enrolledCount,
        submitted: submittedCount,
        notSubmitted: enrolledCount - submittedCount,
        submissionRate:
          enrolledCount > 0
            ? Math.round((submittedCount / enrolledCount) * 100)
            : 0,
        avgGradePct:
          avgRow[0]?.avgPct != null
            ? Math.round(Number(avgRow[0].avgPct))
            : null,
      };
    }),
  );

  return stats;
}

// ── Grade distribution for one assignment ─────────────────────────────────────
export async function getGradeDistribution(assignmentId: number) {
  const [assignment] = await db
    .select({ title: assignments.title })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) return null;

  const allGrades = await db
    .select({
      totalScore: grades.totalScore,
      maxScore: grades.maxScore,
      source: grades.source,
    })
    .from(grades)
    .innerJoin(submissions, eq(grades.submissionId, submissions.id))
    .where(eq(submissions.assignmentId, assignmentId));

  if (allGrades.length === 0) {
    return {
      title: assignment.title,
      count: 0,
      avg: null,
      min: null,
      max: null,
      bands: null,
    };
  }

  const pcts = allGrades.map((g) =>
    Math.round((g.totalScore / g.maxScore) * 100),
  );
  const avg = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
  const min = Math.min(...pcts);
  const max = Math.max(...pcts);

  const bands = {
    "90-100%": pcts.filter((p) => p >= 90).length,
    "70-89%": pcts.filter((p) => p >= 70 && p < 90).length,
    "50-69%": pcts.filter((p) => p >= 50 && p < 70).length,
    "0-49%": pcts.filter((p) => p < 50).length,
  };

  const aiGraded = allGrades.filter((g) => g.source === "ai").length;
  const instructorOverridden = allGrades.filter(
    (g) => g.source === "instructor",
  ).length;

  return {
    title: assignment.title,
    count: allGrades.length,
    avg,
    min,
    max,
    bands,
    aiGraded,
    instructorOverridden,
  };
}

// ── Students who have not submitted a given assignment ─────────────────────────
export async function getStudentsWithoutSubmissions(assignmentId: number) {
  const [assignment] = await db
    .select({ title: assignments.title, courseId: assignments.courseId })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (!assignment) return null;

  // All enrolled students in the course
  const enrolled = await db
    .select({ id: usersSync.id, name: usersSync.name, email: usersSync.email })
    .from(courseStudents)
    .innerJoin(usersSync, eq(courseStudents.studentId, usersSync.id))
    .where(eq(courseStudents.courseId, assignment.courseId));

  // Students who have submitted
  const submitted = await db
    .select({ studentId: submissions.studentId })
    .from(submissions)
    .where(eq(submissions.assignmentId, assignmentId));

  const submittedIds = new Set(submitted.map((s) => s.studentId));
  const missing = enrolled.filter((s) => !submittedIds.has(s.id));

  return {
    assignmentTitle: assignment.title,
    totalEnrolled: enrolled.length,
    totalMissing: missing.length,
    students: missing,
  };
}

// ── Submissions that exist but have no grade yet ──────────────────────────────
export async function getUngradedSubmissions(courseId?: number) {
  const query = db
    .select({
      submissionId: submissions.id,
      studentName: usersSync.name,
      studentEmail: usersSync.email,
      assignmentTitle: assignments.title,
      courseId: assignments.courseId,
      submittedAt: submissions.submittedAt,
    })
    .from(submissions)
    .innerJoin(usersSync, eq(submissions.studentId, usersSync.id))
    .innerJoin(assignments, eq(submissions.assignmentId, assignments.id))
    .leftJoin(grades, eq(grades.submissionId, submissions.id))
    .where(
      courseId
        ? and(isNull(grades.id), eq(assignments.courseId, courseId))
        : isNull(grades.id),
    )
    .orderBy(submissions.submittedAt);

  return query;
}
