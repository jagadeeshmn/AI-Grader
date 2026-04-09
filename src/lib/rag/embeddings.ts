// Voyage AI embeddings — voyage-2 model outputs 1024-dimensional vectors.
// https://docs.voyageai.com/reference/embeddings-api
//
// VOYAGE_API_KEY must be set in .env.local

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-2";
const BATCH_SIZE = 128; // Voyage AI max per request

type VoyageResponse = {
  data: { embedding: number[] }[];
};

async function callVoyage(inputs: string[]): Promise<number[][]> {
  const res = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`,
    },
    body: JSON.stringify({ model: VOYAGE_MODEL, input: inputs }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Voyage AI error ${res.status}: ${text}`);
  }

  const json = (await res.json()) as VoyageResponse;
  return json.data.map((d) => d.embedding);
}

// Embed a single string — used at retrieval time for the query.
export async function embedText(text: string): Promise<number[]> {
  const [embedding] = await callVoyage([text]);
  return embedding;
}

// Embed many strings in batches — used during material ingestion.
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const embeddings = await callVoyage(batch);
    results.push(...embeddings);
  }

  return results;
}
