"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import { assignments, submissions, usersSync } from "@/db/schema";

export async function submitAssignmentForm(formData: FormData): Promise<void> {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("❌ Unauthorized");

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  if (dbUser?.role !== "student")
    throw new Error("❌ Forbidden: students only");

  const assignmentId = Number(formData.get("assignmentId"));
  const content = String(formData.get("content")).trim();

  if (!content) throw new Error("Submission content cannot be empty");

  const [assignment] = await db
    .select({ deadline: assignments.deadline })
    .from(assignments)
    .where(eq(assignments.id, assignmentId))
    .limit(1);

  if (assignment?.deadline && new Date(assignment.deadline) < new Date()) {
    throw new Error("❌ Deadline has passed");
  }

  await db
    .insert(submissions)
    .values({ assignmentId, studentId: user.id, content })
    .onConflictDoUpdate({
      target: [submissions.assignmentId, submissions.studentId],
      set: { content, submittedAt: new Date().toISOString() },
    });

  redirect(`/assignment/${assignmentId}`);
}
