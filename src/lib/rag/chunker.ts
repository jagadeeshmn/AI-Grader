import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 2500,
  chunkOverlap: 200,
});

export async function chunkText(text: string): Promise<string[]> {
  return splitter.splitText(text);
}
