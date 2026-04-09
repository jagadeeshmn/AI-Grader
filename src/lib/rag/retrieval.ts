import { sql } from "@/db";
import { embedText } from "./embeddings";

// Returns the top-K most relevant chunk contents for a given course and query.
// Uses pgvector cosine similarity (<=> operator) with the HNSW index.
// Returns an empty array if the course has no reference materials yet.
export async function retrieveChunks(
  courseId: number,
  query: string,
  topK = 5
): Promise<string[]> {
  const queryEmbedding = await embedText(query);

  // pgvector cosine distance: 0 = identical, 2 = opposite.
  // Join through course_materials to scope results to the given course.
  const rows = await sql`
    SELECT mc.content
    FROM   material_chunks mc
    JOIN   course_materials cm ON cm.id = mc.material_id
    WHERE  cm.course_id = ${courseId}
      AND  mc.embedding IS NOT NULL
    ORDER  BY mc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT  ${topK}
  `;

  return rows.map((r) => r.content as string);
}
