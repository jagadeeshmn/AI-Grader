"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import { courseStudents, courses, usersSync } from "@/db/schema";

async function requireAdmin() {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("❌ Unauthorized");
  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);
  if (dbUser?.role !== "admin") throw new Error("❌ Forbidden: admin only");
}

export async function enrollStudentForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const courseId = Number(formData.get("courseId"));
  const studentId = String(formData.get("studentId"));
  await db
    .insert(courseStudents)
    .values({ courseId, studentId })
    .onConflictDoNothing();
  redirect(`/courses/${courseId}`);
}

export async function unenrollStudentForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const courseId = Number(formData.get("courseId"));
  const studentId = String(formData.get("studentId"));
  await db.delete(courseStudents).where(
    and(
      eq(courseStudents.courseId, courseId),
      eq(courseStudents.studentId, studentId)
    )
  );
  redirect(`/courses/${courseId}`);
}

export async function updateCourseInstructorForm(formData: FormData): Promise<void> {
  await requireAdmin();
  const courseId = Number(formData.get("courseId"));
  const instructorId = String(formData.get("instructorId"));
  await db
    .update(courses)
    .set({ instructorId })
    .where(eq(courses.id, courseId));
  redirect(`/courses/${courseId}`);
}
