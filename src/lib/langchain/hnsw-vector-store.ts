import { EmbeddingVector } from "./embeddings";
import fs from 'fs';
import path from 'path';

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

interface HNSWNode {
  id: string;
  vector: number[];
  metadata: any;
  connections: Map<number, Set<string>>; // layer -> set of neighbor IDs
  maxLayer: number;
}

export class HNSWVectorStore {
  private nodes: Map<string, HNSWNode> = new Map();
  private entryPoint: string | null = null;
  private maxLayer: number = 0;
  private storagePath: string;
  private vectorsFile: string;
  
  // HNSW parameters
  private readonly M: number = 16; // Max number of connections per layer
  private readonly efConstruction: number = 200; // Search depth during construction
  private readonly efSearch: number = 50; // Search depth during search
  private readonly mL: number = 16; // Max layer

  constructor(storagePath: string = './hnsw-storage') {
    this.storagePath = storagePath;
    this.vectorsFile = path.join(storagePath, 'hnsw-vectors.json');
    this.ensureStorageDirectory();
    this.loadVectors();
  }

  private ensureStorageDirectory(): void {
    try {
      if (!fs.existsSync(this.storagePath)) {
        console.log(`📁 Creating storage directory: ${this.storagePath}`);
        fs.mkdirSync(this.storagePath, { recursive: true });
        console.log(`✅ Storage directory created successfully`);
      }
    } catch (error) {
      console.error(`❌ Failed to create storage directory ${this.storagePath}:`, error);
      throw new Error(`Cannot create storage directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private loadVectors(): void {
    try {
      if (fs.existsSync(this.vectorsFile)) {
        const data = fs.readFileSync(this.vectorsFile, 'utf-8');
        const saved = JSON.parse(data);
        
        // Convert the saved nodes object back to a Map
        this.nodes = new Map(Object.entries(saved.nodes || {}));
        this.entryPoint = saved.entryPoint || null;
        this.maxLayer = saved.maxLayer || 0;
        
        // Reconstruct the Map objects for connections
        for (const [id, node] of this.nodes) {
          const connections = new Map();
          if (node.connections && typeof node.connections === 'object') {
            for (const [layer, neighbors] of Object.entries(node.connections)) {
              if (Array.isArray(neighbors)) {
                connections.set(parseInt(layer), new Set(neighbors));
              }
            }
          }
          node.connections = connections;
        }
      }
    } catch (error) {
      console.warn('Failed to load HNSW vectors from file:', error);
      // Reset to empty state if loading fails
      this.nodes = new Map();
      this.entryPoint = null;
      this.maxLayer = 0;
    }
  }

  private saveVectors(): void {
    try {
      // Ensure storage directory exists before writing
      this.ensureStorageDirectory();
      
      // Convert Map objects to plain objects for JSON serialization
      const nodesArray = Array.from(this.nodes.entries()).map(([id, node]) => [
        id,
        {
          ...node,
          connections: Object.fromEntries(
            Array.from(node.connections.entries()).map(([layer, neighbors]) => [
              layer,
              Array.from(neighbors)
            ])
          )
        }
      ]);

      const data = {
        nodes: Object.fromEntries(nodesArray),
        entryPoint: this.entryPoint,
        maxLayer: this.maxLayer
      };

      console.log(`💾 Saving ${this.nodes.size} vectors to ${this.vectorsFile}`);
      fs.writeFileSync(this.vectorsFile, JSON.stringify(data, null, 2));
      console.log(`✅ Successfully saved vectors to ${this.vectorsFile}`);
    } catch (error) {
      console.error('Failed to save HNSW vectors to file:', error);
      throw error; // Re-throw to allow caller to handle
    }
  }

  async addVectors(vectors: EmbeddingVector[]): Promise<void> {
    for (const vector of vectors) {
      await this.addVector(vector);
    }
    this.saveVectors();
  }

  private async addVector(vector: EmbeddingVector): Promise<void> {
    const nodeId = vector.id;
    const layer = this.getRandomLayer();
    
    const node: HNSWNode = {
      id: nodeId,
      vector: vector.vector,
      metadata: vector.metadata,
      connections: new Map(),
      maxLayer: layer
    };

    // Initialize connections for each layer
    for (let l = 0; l <= layer; l++) {
      node.connections.set(l, new Set());
    }

    this.nodes.set(nodeId, node);

    if (this.entryPoint === null) {
      this.entryPoint = nodeId;
      this.maxLayer = layer;
    } else {
      await this.insertNode(nodeId, layer);
    }
  }

  private getRandomLayer(): number {
    let layer = 0;
    while (Math.random() < 0.5 && layer < this.mL) {
      layer++;
    }
    return layer;
  }

  private async insertNode(nodeId: string, layer: number): Promise<void> {
    const node = this.nodes.get(nodeId)!;
    const currentEntryPoint = this.entryPoint!;
    
    let currentMaxLayer = this.maxLayer;
    let currentEntry = currentEntryPoint;
    
    // Find the entry point for the current layer
    if (currentMaxLayer > layer) {
      const searchResults = await this.searchLayer(currentEntry, node.vector, layer + 1, 1);
      currentEntry = searchResults[0]?.id || currentEntry;
    }

    // Insert at each layer
    for (let currentLayer = Math.min(currentMaxLayer, layer); currentLayer >= 0; currentLayer--) {
      const neighbors = await this.searchLayer(currentEntry, node.vector, currentLayer, this.efConstruction);
      const candidates = this.selectNeighbors(neighbors, this.M);
      
      // Add bidirectional connections
      for (const candidate of candidates) {
        this.addConnection(nodeId, candidate.id, currentLayer);
        this.addConnection(candidate.id, nodeId, currentLayer);
      }
      
      currentEntry = candidates[0]?.id || currentEntry;
    }

    // Update entry point if necessary
    if (layer > currentMaxLayer) {
      this.entryPoint = nodeId;
      this.maxLayer = layer;
    }
  }

  private async searchLayer(entryPoint: string, queryVector: number[], layer: number, ef: number): Promise<{ id: string; distance: number }[]> {
    const visited = new Set<string>();
    const candidates = new Set<string>();
    const results: { id: string; distance: number }[] = [];
    
    const entryNode = this.nodes.get(entryPoint)!;
    const entryDistance = this.cosineDistance(queryVector, entryNode.vector);
    
    candidates.add(entryPoint);
    results.push({ id: entryPoint, distance: entryDistance });
    
    while (candidates.size > 0) {
      // Find the closest candidate
      let closestCandidate = '';
      let closestDistance = Infinity;
      
      for (const candidateId of candidates) {
        const candidate = this.nodes.get(candidateId)!;
        const distance = this.cosineDistance(queryVector, candidate.vector);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestCandidate = candidateId;
        }
      }
      
      if (closestCandidate === '') break;
      
      candidates.delete(closestCandidate);
      visited.add(closestCandidate);
      
      // Check if we can improve results
      if (results.length < ef || closestDistance < results[results.length - 1].distance) {
        // Add neighbors to candidates
        const closestNode = this.nodes.get(closestCandidate)!;
        const neighbors = closestNode.connections.get(layer);
        
        if (neighbors) {
          for (const neighborId of neighbors) {
            if (!visited.has(neighborId)) {
              candidates.add(neighborId);
              const neighbor = this.nodes.get(neighborId)!;
              const distance = this.cosineDistance(queryVector, neighbor.vector);
              
              // Insert into results if it's better than current worst
              if (results.length < ef || distance < results[results.length - 1].distance) {
                let insertIndex = results.findIndex(r => r.distance > distance);
                if (insertIndex === -1) insertIndex = results.length;
                results.splice(insertIndex, 0, { id: neighborId, distance });
                
                // Keep only top ef results
                if (results.length > ef) {
                  results.splice(ef);
                }
              }
            }
          }
        }
      }
    }
    
    return results;
  }

  private selectNeighbors(candidates: { id: string; distance: number }[], M: number): { id: string; distance: number }[] {
    return candidates.slice(0, M);
  }

  private addConnection(fromId: string, toId: string, layer: number): void {
    const fromNode = this.nodes.get(fromId)!;
    const connections = fromNode.connections.get(layer)!;
    connections.add(toId);
    
    // Limit connections per layer
    if (connections.size > this.M) {
      // Simple strategy: keep the first M connections
      const limitedConnections = new Set(Array.from(connections).slice(0, this.M));
      fromNode.connections.set(layer, limitedConnections);
    }
  }

  async search(queryVector: number[], topK: number = 5): Promise<SearchResult[]> {
    if (this.entryPoint === null || this.nodes.size === 0) {
      return [];
    }

    const results = await this.searchLayer(this.entryPoint, queryVector, this.maxLayer, this.efSearch);
    
    return results
      .slice(0, topK)
      .map(result => {
        const node = this.nodes.get(result.id)!;
        return {
          id: result.id,
          content: node.metadata.content,
          metadata: {
            documentId: node.metadata.documentId,
            filename: node.metadata.filename,
            chunkIndex: node.metadata.chunkIndex,
          },
          similarity: 1 - result.distance, // Convert distance to similarity
        };
      });
  }

  async getDocumentChunks(documentId: string): Promise<SearchResult[]> {
    console.log(`🔍 Getting chunks for document: ${documentId}`);
    console.log(`📊 Total nodes in store: ${this.nodes.size}`);
    
    const results: SearchResult[] = [];
    
    for (const [id, node] of this.nodes) {
      if (node.metadata.documentId === documentId) {
        results.push({
          id,
          content: node.metadata.content,
          metadata: {
            documentId: node.metadata.documentId,
            filename: node.metadata.filename,
            chunkIndex: node.metadata.chunkIndex,
          },
          similarity: 1.0,
        });
      }
    }
    
    console.log(`📄 Found ${results.length} chunks for document ${documentId}`);
    if (results.length > 0) {
      const chunkIndices = results.map(r => r.metadata.chunkIndex).sort((a, b) => a - b);
      console.log(`📋 Chunk indices: ${chunkIndices.join(', ')}`);
    }
    
    return results.sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex);
  }

  async deleteDocument(documentId: string): Promise<void> {
    const nodesToDelete: string[] = [];
    
    for (const [id, node] of this.nodes) {
      if (node.metadata.documentId === documentId) {
        nodesToDelete.push(id);
      }
    }
    
    for (const id of nodesToDelete) {
      this.nodes.delete(id);
    }
    
    // Rebuild connections (simplified approach)
    this.rebuildConnections();
    this.saveVectors();
  }

  private rebuildConnections(): void {
    // Simplified rebuild - in practice, you'd want a more sophisticated approach
    const nodes = Array.from(this.nodes.values());
    if (nodes.length === 0) {
      this.entryPoint = null;
      this.maxLayer = 0;
      return;
    }
    
    // Reset connections
    for (const node of nodes) {
      node.connections.clear();
      for (let l = 0; l <= node.maxLayer; l++) {
        node.connections.set(l, new Set());
      }
    }
    
    // Rebuild entry point
    this.entryPoint = nodes[0].id;
    this.maxLayer = Math.max(...nodes.map(n => n.maxLayer));
  }

  async getAllDocuments(): Promise<{ documentId: string; filename: string }[]> {
    const uniqueDocs = new Map<string, { documentId: string; filename: string }>();
    
    for (const [id, node] of this.nodes) {
      if (!uniqueDocs.has(node.metadata.documentId)) {
        uniqueDocs.set(node.metadata.documentId, {
          documentId: node.metadata.documentId,
          filename: node.metadata.filename,
        });
      }
    }

    return Array.from(uniqueDocs.values());
  }

  async getVectorCount(): Promise<number> {
    return this.nodes.size;
  }

  async isEmpty(): Promise<boolean> {
    return this.nodes.size === 0;
  }

  async shouldCleanupStorage(): Promise<boolean> {
    // Check if we should clean up storage files
    const isEmpty = await this.isEmpty();
    const hasStorageFile = fs.existsSync(this.vectorsFile);
    
    // Clean up if empty but storage file exists
    return isEmpty && hasStorageFile;
  }

  async clearAll(): Promise<void> {
    this.nodes.clear();
    this.entryPoint = null;
    this.maxLayer = 0;
    this.saveVectors();
  }

  async deleteStorageFiles(): Promise<void> {
    try {
      // Delete the vectors file
      if (fs.existsSync(this.vectorsFile)) {
        fs.unlinkSync(this.vectorsFile);
        console.log(`🗑️ Deleted vector storage file: ${this.vectorsFile}`);
      }
      
      // Try to delete the storage directory if it's empty
      try {
        const files = fs.readdirSync(this.storagePath);
        if (files.length === 0) {
          fs.rmdirSync(this.storagePath);
          console.log(`🗑️ Deleted empty storage directory: ${this.storagePath}`);
        }
      } catch (error) {
        // Directory not empty or other error - that's okay
        console.log(`📁 Storage directory not empty, keeping: ${this.storagePath}`);
      }
    } catch (error) {
      console.warn('Failed to delete storage files:', error);
    }
  }

  async clearAllAndDeleteStorage(): Promise<void> {
    await this.clearAll();
    await this.deleteStorageFiles();
  }

  getStorageSize(): number {
    try {
      const stats = fs.statSync(this.vectorsFile);
      return stats.size;
    } catch {
      return 0;
    }
  }

  getStoragePath(): string {
    return this.storagePath;
  }

  // Get HNSW statistics for monitoring
  getHNSWStats(): {
    nodeCount: number;
    maxLayer: number;
    entryPoint: string | null;
    averageConnectionsPerLayer: number;
  } {
    let totalConnections = 0;
    let totalLayers = 0;
    
    for (const node of this.nodes.values()) {
      for (const connections of node.connections.values()) {
        totalConnections += connections.size;
        totalLayers++;
      }
    }
    
    return {
      nodeCount: this.nodes.size,
      maxLayer: this.maxLayer,
      entryPoint: this.entryPoint,
      averageConnectionsPerLayer: totalLayers > 0 ? totalConnections / totalLayers : 0,
    };
  }

  private cosineDistance(vecA: number[], vecB: number[]): number {
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

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return 1 - similarity; // Convert to distance
  }
} 