import { GoogleGenerativeAIEmbeddings } from "@langchain/google-genai";

export interface EmbeddingVector {
  id: string;
  vector: number[];
  metadata: {
    documentId: string;
    filename: string;
    chunkIndex: number;
    content: string;
  };
}

export class EmbeddingService {
  private embeddings: GoogleGenerativeAIEmbeddings;

  constructor(apiKey?: string) {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: apiKey || process.env.GOOGLE_API_KEY,
      modelName: "embedding-001",
    });
  }

  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    try {
      return await this.embeddings.embedDocuments(texts);
    } catch (error) {
      throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      return await this.embeddings.embedQuery(text);
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
} 