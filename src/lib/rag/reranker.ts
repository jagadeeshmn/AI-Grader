const RERANK_URL = "https://api.voyageai.com/v1/rerank";

interface RerankResult {
  index: number;
  relevance_score: number;
}

interface RerankResponse {
  data: RerankResult[];
}

// Like rerank, but returns the reranked document indices with their
// relevance scores instead of the bare contents. Used by the agentic
// retrieval path, which needs scores for RankedChunk.
export async function rerankWithScores(
  query: string,
  documents: string[],
  topK: number,
): Promise<{ index: number; score: number }[]> {
  if (documents.length === 0) return [];

  const response = await fetch(RERANK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "rerank-2",
      query,
      documents,
      top_k: topK,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Voyage rerank failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: RerankResponse = await response.json();
  return data.data.map(({ index, relevance_score }) => ({
    index,
    score: relevance_score,
  }));
}

export async function rerank(
  query: string,
  documents: string[],
  topK: number,
): Promise<string[]> {
  if (documents.length === 0) return [];

  const response = await fetch(RERANK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "rerank-2",
      query,
      documents,
      top_k: topK,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Voyage rerank failed: ${response.status} ${response.statusText}`,
    );
  }

  const data: RerankResponse = await response.json();
  return data.data.map((item) => documents[item.index]);
}
