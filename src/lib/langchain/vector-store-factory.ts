import { InMemoryVectorStore } from './vector-store';
import { HNSWVectorStore } from './hnsw-vector-store';

export type VectorStoreType = 'memory' | 'hnsw';

export interface VectorStoreConfig {
  type: VectorStoreType;
  storagePath?: string; // For file and sqlite storage
}

export class VectorStoreFactory {
  static create(config: VectorStoreConfig) {
    switch (config.type) {
      case 'memory':
        return new InMemoryVectorStore();
      
      case 'hnsw':
        return new HNSWVectorStore(config.storagePath);
      
      default:
        throw new Error(`Unknown vector store type: ${config.type}`);
    }
  }

  static getAvailableTypes(): VectorStoreType[] {
    return ['memory', 'hnsw'];
  }

  static getTypeDescription(type: VectorStoreType): string {
    switch (type) {
      case 'memory':
        return 'Fast in-memory storage (data lost on restart)';
      case 'hnsw':
        return 'HNSW algorithm for efficient similarity search (persistent)';
      default:
        return 'Unknown storage type';
    }
  }
} 