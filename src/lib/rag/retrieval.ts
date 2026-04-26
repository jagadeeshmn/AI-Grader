import { sql } from "@/db";
import { embedText } from "./embeddings";
import { rerank } from "./reranker";

// Returns the top-K most relevant chunk contents for a given course and query.
// Fetches candidateK (topK * 3) chunks via pgvector cosine similarity, then
// re-ranks with Voyage AI rerank-2 to improve precision before returning topK.
export async function retrieveChunks(
  courseId: number,
  query: string,
  topK = 5,
): Promise<string[]> {
  const queryEmbedding = await embedText(query);
  const candidateK = topK * 3;

  const rows = await sql`
    SELECT mc.content
    FROM   material_chunks mc
    JOIN   course_materials cm ON cm.id = mc.material_id
    WHERE  cm.course_id = ${courseId}
      AND  mc.embedding IS NOT NULL
    ORDER  BY mc.embedding <=> ${JSON.stringify(queryEmbedding)}::vector
    LIMIT  ${candidateK}
  `;

  const candidates = rows.map((r) => r.content as string);
  if (candidates.length === 0) return [];

  return rerank(query, candidates, topK);
}
