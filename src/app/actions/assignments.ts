"use server";

import { redirect } from "next/navigation";
import { stackServerApp } from "@/stack/server";
import { and, eq } from "drizzle-orm";
import { authorizeUserToEditArticle } from "@/db/authz";
import db from "@/db/index";
import { assignments, courses, usersSync, type RubricCriterion } from "@/db/schema";
import { ensureUserExists } from "@/db/sync-user";


export type CreateAssignmentInput = {
  title: string;
  content: string;
  authorId: string;
  courseId: number;
  imageUrl?: string;
};

export type UpdateAssignmentInput = {
  title?: string;
  content?: string;
  imageUrl?: string;
};

export async function createAssignment(data: CreateAssignmentInput) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("❌ Unauthorized");
  }
  console.log("✨ createArticle called:", data);
  await ensureUserExists(user);
  const response = await db.insert(assignments).values({
    title: data.title,
    content: data.content,
    slug: "" + Date.now(),
    published: true,
    courseId: data.courseId,
    authorId: user.id,
  });

  return { success: true, message: "Assignment create logged" };
}

export async function updateAssignment(id: string, data: UpdateAssignmentInput) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("❌ Unauthorized");
  }
  await ensureUserExists(user);
  if (!(await authorizeUserToEditArticle(user.id, +id))) {
    throw new Error("❌ Forbidden");
  }
  // TODO: Replace with actual database update
  console.log("📝 updateAssignment called:", { id, ...data });

  const response = await db
    .update(assignments)
    .set({
      title: data.title,
      content: data.content,
    })
    .where(eq(assignments.id, +id));

  return { success: true, message: `Assignment ${id} update logged` };
}

export async function deleteAssignment(id: string) {
  const user = await stackServerApp.getUser();
  if (!user) {
    throw new Error("❌ Unauthorized");
  }
  if (!(await authorizeUserToEditArticle(user.id, +id))) {
    throw new Error("❌ Forbidden");
  }
  console.log("🗑️ deleteAssignment called:", id);

  const response = await db.delete(assignments).where(eq(assignments.id, +id));

  return { success: true, message: `Assignment ${id} delete logged (stub)` };
}

export async function updateAssignmentRubric(
  assignmentId: number,
  rubric: RubricCriterion[]
): Promise<void> {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("❌ Unauthorized");

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  if (!dbUser || (dbUser.role !== "instructor" && dbUser.role !== "admin")) {
    throw new Error("❌ Forbidden: instructors and admins only");
  }

  if (dbUser.role === "instructor") {
    const [assignment] = await db
      .select({ courseId: assignments.courseId, authorId: assignments.authorId })
      .from(assignments)
      .where(eq(assignments.id, assignmentId))
      .limit(1);

    if (!assignment) throw new Error("Assignment not found");

    if (assignment.authorId !== user.id) {
      // Not the author — verify the instructor is assigned to the course
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(and(eq(courses.id, assignment.courseId), eq(courses.instructorId, user.id)))
        .limit(1);
      if (!course) throw new Error("❌ Forbidden");
    }
  }

  await db
    .update(assignments)
    .set({ rubric, updatedAt: new Date().toISOString() })
    .where(eq(assignments.id, assignmentId));
}

// Form-friendly server action: accepts FormData from a client form and calls deleteAssignment
export async function deleteAssignmentForm(formData: FormData): Promise<void> {
  const id = formData.get("id");
  if (!id) {
    throw new Error("Missing Assignment id");
  }

  await deleteAssignment(String(id));
  // After deleting, redirect the user back to the homepage.
  redirect("/");
}
