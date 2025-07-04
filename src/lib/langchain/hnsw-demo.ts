import { HNSWVectorStore } from './hnsw-vector-store';
import { EmbeddingVector } from './embeddings';

// Demo function to show HNSW vector store usage
export async function demonstrateHNSW() {
  console.log('🚀 HNSW Vector Store Demo');
  
  // Create HNSW vector store
  const vectorStore = new HNSWVectorStore('./demo-hnsw-storage');
  
  // Sample vectors (in practice, these would come from your embedding model)
  const sampleVectors: EmbeddingVector[] = [
    {
      id: '1',
      vector: [0.1, 0.2, 0.3, 0.4, 0.5],
      metadata: {
        content: 'This is a sample document about machine learning',
        documentId: 'doc1',
        filename: 'ml-intro.pdf',
        chunkIndex: 0
      }
    },
    {
      id: '2',
      vector: [0.2, 0.3, 0.4, 0.5, 0.6],
      metadata: {
        content: 'Deep learning is a subset of machine learning',
        documentId: 'doc1',
        filename: 'ml-intro.pdf',
        chunkIndex: 1
      }
    },
    {
      id: '3',
      vector: [0.9, 0.8, 0.7, 0.6, 0.5],
      metadata: {
        content: 'This document is about cooking recipes',
        documentId: 'doc2',
        filename: 'cooking.pdf',
        chunkIndex: 0
      }
    },
    {
      id: '4',
      vector: [0.8, 0.7, 0.6, 0.5, 0.4],
      metadata: {
        content: 'How to make pasta carbonara',
        documentId: 'doc2',
        filename: 'cooking.pdf',
        chunkIndex: 1
      }
    }
  ];

  // Add vectors to the store
  console.log('📥 Adding vectors to HNSW store...');
  await vectorStore.addVectors(sampleVectors);
  
  // Get HNSW statistics
  const stats = vectorStore.getHNSWStats();
  console.log('📊 HNSW Statistics:', stats);
  
  // Perform similarity search
  console.log('🔍 Performing similarity search...');
  const queryVector = [0.15, 0.25, 0.35, 0.45, 0.55]; // Similar to ML vectors
  const results = await vectorStore.search(queryVector, 3);
  
  console.log('🎯 Search Results:');
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.content} (similarity: ${result.similarity.toFixed(3)})`);
  });
  
  // Get all documents
  console.log('📚 All documents:');
  const documents = await vectorStore.getAllDocuments();
  documents.forEach(doc => {
    console.log(`- ${doc.filename} (ID: ${doc.documentId})`);
  });
  
  // Get document chunks
  console.log('📄 Document chunks for doc1:');
  const chunks = await vectorStore.getDocumentChunks('doc1');
  chunks.forEach(chunk => {
    console.log(`- Chunk ${chunk.metadata.chunkIndex}: ${chunk.content}`);
  });
  
  // Storage information
  console.log('💾 Storage Info:');
  console.log(`- Storage path: ${vectorStore.getStoragePath()}`);
  console.log(`- Storage size: ${vectorStore.getStorageSize()} bytes`);
  console.log(`- Vector count: ${await vectorStore.getVectorCount()}`);
  
  return vectorStore;
}

// Performance comparison function
export async function comparePerformance() {
  console.log('⚡ Performance Comparison');
  
  const vectorStore = new HNSWVectorStore('./perf-test-storage');
  
  // Generate test vectors
  const testVectors: EmbeddingVector[] = [];
  for (let i = 0; i < 1000; i++) {
    testVectors.push({
      id: `test-${i}`,
      vector: Array.from({ length: 384 }, () => Math.random()), // 384-dim vector
      metadata: {
        content: `Test document ${i} content`,
        documentId: `doc-${Math.floor(i / 10)}`,
        filename: `test-${Math.floor(i / 10)}.pdf`,
        chunkIndex: i % 10
      }
    });
  }
  
  // Measure insertion time
  console.log('⏱️ Measuring insertion performance...');
  const startTime = Date.now();
  await vectorStore.addVectors(testVectors);
  const insertionTime = Date.now() - startTime;
  console.log(`Insertion time: ${insertionTime}ms for ${testVectors.length} vectors`);
  
  // Measure search time
  console.log('⏱️ Measuring search performance...');
  const queryVector = Array.from({ length: 384 }, () => Math.random());
  const searchStartTime = Date.now();
  const searchResults = await vectorStore.search(queryVector, 10);
  const searchTime = Date.now() - searchStartTime;
  console.log(`Search time: ${searchTime}ms for top 10 results`);
  
  // Show final stats
  const stats = vectorStore.getHNSWStats();
  console.log('📊 Final HNSW Statistics:', stats);
  
  return {
    insertionTime,
    searchTime,
    vectorCount: testVectors.length,
    stats
  };
} 