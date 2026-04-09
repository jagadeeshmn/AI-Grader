const CHUNK_SIZE = 2500;
const OVERLAP = 200;

// Splits text into ~CHUNK_SIZE character chunks, breaking on sentence or
// paragraph boundaries. Adjacent chunks share OVERLAP chars of context so
// a concept that straddles a boundary isn't lost.
export function chunkText(text: string): string[] {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length <= CHUNK_SIZE) return [normalized];

  // Split into sentences. A sentence ends at . ! ? followed by whitespace,
  // or at a blank line (paragraph break).
  const sentences = normalized.split(/(?<=[.!?])\s+|\n{2,}/);

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;

    if (candidate.length <= CHUNK_SIZE) {
      current = candidate;
      continue;
    }

    // current is full — commit it
    if (current) {
      chunks.push(current.trim());
      // seed next chunk with the overlap tail of the committed chunk
      const tail = current.slice(-OVERLAP);
      current = tail ? `${tail} ${sentence}` : sentence;
    } else {
      // single sentence exceeds CHUNK_SIZE — hard-split it
      for (let i = 0; i < sentence.length; i += CHUNK_SIZE - OVERLAP) {
        chunks.push(sentence.slice(i, i + CHUNK_SIZE).trim());
      }
      current = "";
    }
  }

  if (current.trim()) chunks.push(current.trim());

  return chunks.filter((c) => c.length > 0);
}
