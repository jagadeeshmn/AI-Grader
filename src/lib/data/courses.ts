import db from "@/db/index";
import {
  assignments,
  courses,
  courseStudents,
  courseMaterials,
  usersSync,
} from "@/db/schema";
import { and, eq } from "drizzle-orm";

export async function getCourses() {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorId: courses.instructorId,
      instructorName: usersSync.name,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id));
}

export async function getCourseById(id: number) {
  const rows = await db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorId: courses.instructorId,
      instructorName: usersSync.name,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id))
    .where(eq(courses.id, id));
  return rows[0] ?? null;
}

export async function getCourseStudents(courseId: number) {
  return db
    .select({
      id: usersSync.id,
      name: usersSync.name,
      email: usersSync.email,
    })
    .from(courseStudents)
    .innerJoin(usersSync, eq(courseStudents.studentId, usersSync.id))
    .where(eq(courseStudents.courseId, courseId));
}

export async function getAllStudents() {
  return db
    .select({
      id: usersSync.id,
      name: usersSync.name,
      email: usersSync.email,
    })
    .from(usersSync)
    .where(eq(usersSync.role, "student"));
}

export async function getCourseAssignments(courseId: number) {
  return db
    .select({
      id: assignments.id,
      title: assignments.title,
      slug: assignments.slug,
      published: assignments.published,
      deadline: assignments.deadline,
      rubric: assignments.rubric,
      createdAt: assignments.createdAt,
    })
    .from(assignments)
    .where(eq(assignments.courseId, courseId))
    .orderBy(assignments.createdAt);
}

export async function getEnrolledCourses(studentId: string) {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorId: courses.instructorId,
      instructorName: usersSync.name,
      createdAt: courses.createdAt,
    })
    .from(courseStudents)
    .innerJoin(courses, eq(courseStudents.courseId, courses.id))
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id))
    .where(eq(courseStudents.studentId, studentId));
}

export async function isStudentEnrolled(courseId: number, studentId: string) {
  const [row] = await db
    .select({ courseId: courseStudents.courseId })
    .from(courseStudents)
    .where(
      and(
        eq(courseStudents.courseId, courseId),
        eq(courseStudents.studentId, studentId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function getCoursesByInstructor(instructorId: string) {
  return db
    .select({
      id: courses.id,
      name: courses.name,
      batch: courses.batch,
      instructorId: courses.instructorId,
      instructorName: usersSync.name,
      createdAt: courses.createdAt,
    })
    .from(courses)
    .leftJoin(usersSync, eq(courses.instructorId, usersSync.id))
    .where(eq(courses.instructorId, instructorId));
}

export async function isInstructorAssigned(
  courseId: number,
  instructorId: string,
) {
  const [row] = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(eq(courses.id, courseId), eq(courses.instructorId, instructorId)),
    )
    .limit(1);
  return !!row;
}

export async function getAllInstructors() {
  return db
    .select({
      id: usersSync.id,
      name: usersSync.name,
      email: usersSync.email,
    })
    .from(usersSync)
    .where(eq(usersSync.role, "instructor"));
}

export async function getCourseMaterials(courseId: number) {
  return db
    .select({
      id: courseMaterials.id,
      title: courseMaterials.title,
      content: courseMaterials.content,
      createdAt: courseMaterials.createdAt,
    })
    .from(courseMaterials)
    .where(eq(courseMaterials.courseId, courseId))
    .orderBy(courseMaterials.createdAt);
}
