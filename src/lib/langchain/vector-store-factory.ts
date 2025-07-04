import { InMemoryVectorStore } from './vector-store';
// import { HNSWVectorStore } from './hnsw-vector-store'; // keep for fallback
import { FaissStore } from '@langchain/community/vectorstores/faiss';
import type { EmbeddingsInterface } from '@langchain/core/embeddings';

export type VectorStoreType = 'memory' | 'hnsw' | 'faiss';

export interface VectorStoreConfig {
  type: VectorStoreType;
  storagePath?: string; // For file and sqlite storage
  embeddings?: EmbeddingsInterface; // Required for FAISS
}

// --- FAISS Adapter ---
class FaissStoreAdapter {
  private faiss: any;
  private docMeta: Map<string, { documentId: string; filename: string; chunkIndex: number; content: string }[]> = new Map();

  constructor(embeddings: EmbeddingsInterface) {
    this.faiss = new FaissStore(embeddings, {});
  }

  async addVectors(vectors: any[]): Promise<void> {
    // Convert to Document objects for FAISS
    const documents = vectors.map(v => ({
      pageContent: v.metadata.content,
      metadata: {
        documentId: v.metadata.documentId,
        filename: v.metadata.filename,
        chunkIndex: v.metadata.chunkIndex,
      }
    }));
    await this.faiss.addDocuments(documents);
    // Track metadata for getAllDocuments/getDocumentChunks
    for (const doc of documents) {
      const docId = doc.metadata.documentId;
      if (!this.docMeta.has(docId)) this.docMeta.set(docId, []);
      this.docMeta.get(docId)!.push({
        documentId: doc.metadata.documentId,
        filename: doc.metadata.filename,
        chunkIndex: doc.metadata.chunkIndex,
        content: doc.pageContent,
      });
    }
  }

  async search(queryVector: number[], topK: number = 5): Promise<any[]> {
    const results = await this.faiss.similaritySearchVectorWithScore(queryVector, topK);
    // results: [[Document, score], ...]
    return results.map(([doc, score]: [any, number]) => ({
      id: doc.metadata?.id || doc.metadata?.documentId || '',
      content: doc.pageContent,
      metadata: {
        documentId: doc.metadata.documentId,
        filename: doc.metadata.filename,
        chunkIndex: doc.metadata.chunkIndex,
      },
      similarity: score,
    }));
  }

  async getAllDocuments(): Promise<{ documentId: string; filename: string }[]> {
    // Return unique documentId/filename pairs
    const docs: { documentId: string; filename: string }[] = [];
    for (const [documentId, chunks] of this.docMeta.entries()) {
      if (chunks.length > 0) {
        docs.push({ documentId, filename: chunks[0].filename });
      }
    }
    return docs;
  }

  async getDocumentChunks(documentId: string): Promise<any[]> {
    const chunks = this.docMeta.get(documentId) || [];
    return chunks.map(chunk => ({
      id: `${documentId}-${chunk.chunkIndex}`,
      content: chunk.content,
      metadata: {
        documentId: chunk.documentId,
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
      },
      similarity: 1.0,
    }));
  }

  async deleteDocument(documentId: string): Promise<void> {
    // Remove from FAISS and local map
    const chunks = this.docMeta.get(documentId) || [];
    const ids = chunks.map((chunk, idx) => `${documentId}-${chunk.chunkIndex}`);
    // FAISS delete expects document IDs, but we only have metadata, so this is a placeholder
    // If you store IDs in metadata, you can use them here
    // await this.faiss.delete({ ids });
    this.docMeta.delete(documentId);
  }
}

export class VectorStoreFactory {
  static create(config: VectorStoreConfig) {
    switch (config.type) {
      case 'memory':
        return new InMemoryVectorStore();
      // case 'hnsw':
      //   return new HNSWVectorStore(config.storagePath);
      case 'faiss':
        if (!config.embeddings) {
          throw new Error('Embeddings instance is required for FAISS vector store');
        }
        return new FaissStoreAdapter(config.embeddings);
      default:
        throw new Error(`Unknown vector store type: ${config.type}`);
    }
  }

  static getAvailableTypes(): VectorStoreType[] {
    return ['memory', 'hnsw', 'faiss'];
  }

  static getTypeDescription(type: VectorStoreType): string {
    switch (type) {
      case 'memory':
        return 'Fast in-memory storage (data lost on restart)';
      case 'hnsw':
        return 'HNSW algorithm for efficient similarity search (persistent, fallback)';
      case 'faiss':
        return 'FAISS vector store (recommended, persistent)';
      default:
        return 'Unknown storage type';
    }
  }
} 