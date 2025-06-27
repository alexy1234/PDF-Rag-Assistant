import { EmbeddingVector } from "./embeddings";

export interface SearchResult {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    filename: string;
    chunkIndex: number;
  };
  similarity: number;
}

export class InMemoryVectorStore {
  private vectors: EmbeddingVector[] = [];

  async addVectors(vectors: EmbeddingVector[]): Promise<void> {
    this.vectors.push(...vectors);
  }

  async search(queryVector: number[], topK: number = 5): Promise<SearchResult[]> {
    const similarities = this.vectors.map(vector => ({
      ...vector,
      similarity: this.cosineSimilarity(queryVector, vector.vector)
    }));

    return similarities
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, topK)
      .map(({ id, metadata, similarity }) => ({
        id,
        content: metadata.content,
        metadata: {
          documentId: metadata.documentId,
          filename: metadata.filename,
          chunkIndex: metadata.chunkIndex,
        },
        similarity,
      }));
  }

  async getDocumentChunks(documentId: string): Promise<SearchResult[]> {
    return this.vectors
      .filter(vector => vector.metadata.documentId === documentId)
      .map(vector => ({
        id: vector.id,
        content: vector.metadata.content,
        metadata: {
          documentId: vector.metadata.documentId,
          filename: vector.metadata.filename,
          chunkIndex: vector.metadata.chunkIndex,
        },
        similarity: 1.0,
      }));
  }

  async deleteDocument(documentId: string): Promise<void> {
    this.vectors = this.vectors.filter(vector => vector.metadata.documentId !== documentId);
  }

  async getAllDocuments(): Promise<{ documentId: string; filename: string }[]> {
    const uniqueDocs = new Map<string, { documentId: string; filename: string }>();
    
    this.vectors.forEach(vector => {
      if (!uniqueDocs.has(vector.metadata.documentId)) {
        uniqueDocs.set(vector.metadata.documentId, {
          documentId: vector.metadata.documentId,
          filename: vector.metadata.filename,
        });
      }
    });

    return Array.from(uniqueDocs.values());
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error("Vectors must have the same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }
} 