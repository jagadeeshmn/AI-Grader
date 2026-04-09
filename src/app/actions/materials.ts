"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { stackServerApp } from "@/stack/server";
import db from "@/db/index";
import { courseMaterials, materialChunks, usersSync } from "@/db/schema";
import { chunkText } from "@/lib/rag/chunker";
import { embedBatch } from "@/lib/rag/embeddings";

async function requireInstructorOrAdmin(): Promise<string> {
  const user = await stackServerApp.getUser();
  if (!user) throw new Error("Unauthorized");

  const [dbUser] = await db
    .select({ role: usersSync.role })
    .from(usersSync)
    .where(eq(usersSync.id, user.id))
    .limit(1);

  if (dbUser?.role !== "instructor" && dbUser?.role !== "admin") {
    throw new Error("Forbidden: instructors and admins only");
  }

  return user.id;
}

export async function addCourseMaterialAction(formData: FormData): Promise<void> {
  const userId = await requireInstructorOrAdmin();

  const courseId = Number(formData.get("courseId"));
  const title = String(formData.get("title")).trim();
  const content = String(formData.get("content")).trim();

  if (!title) throw new Error("Title is required");
  if (!content) throw new Error("Content is required");

  // 1. Insert the material record
  const [material] = await db
    .insert(courseMaterials)
    .values({ courseId, title, content, uploadedBy: userId })
    .returning({ id: courseMaterials.id });

  // 2. Chunk the content
  const chunks = chunkText(content);

  // 3. Embed all chunks
  const embeddings = await embedBatch(chunks);

  // 4. Insert all chunks with embeddings
  await db.insert(materialChunks).values(
    chunks.map((text, i) => ({
      materialId: material.id,
      chunkIndex: i,
      content: text,
      embedding: embeddings[i],
    }))
  );

  revalidatePath(`/courses/${courseId}`);
}

export async function deleteCourseMaterialAction(formData: FormData): Promise<void> {
  await requireInstructorOrAdmin();

  const materialId = Number(formData.get("materialId"));
  const courseId = Number(formData.get("courseId"));

  // Cascade delete removes associated chunks automatically
  await db.delete(courseMaterials).where(eq(courseMaterials.id, materialId));

  revalidatePath(`/courses/${courseId}`);
}
