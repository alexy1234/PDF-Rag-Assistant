import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { RobustPDFLoader, PDFDocument } from "./robust-pdf-loader";
import { TextSplitter, TextChunk } from "./text-splitter";
import { EmbeddingService, EmbeddingVector } from "./embeddings";
import { VectorStoreFactory, VectorStoreType } from "./vector-store-factory";
import { SearchResult } from "./vector-store";

export interface RAGResponse {
  answer: string;
  sources: {
    documentId: string;
    filename: string;
    content: string;
    similarity: number;
  }[];
  metadata?: {
    totalChunks: number;
    chunksUsed: number;
    documentsUsed: string[];
    searchStrategy: string;
    contextLength: number;
    maxContextLength: number;
  };
}

export class PDFRagChain {
  private pdfLoader: RobustPDFLoader;
  private textSplitter: TextSplitter;
  private embeddingService: EmbeddingService;
  private vectorStore: any; // Using any for now since we have different vector store types
  private llm: ChatGoogleGenerativeAI;

  constructor(apiKey?: string, vectorStoreType: VectorStoreType = 'hnsw', storagePath?: string) {
    this.pdfLoader = new RobustPDFLoader();
    
    // Configure text splitter with environment variables or defaults
    const chunkSize = parseInt(process.env.CHUNK_SIZE || '2000');
    const chunkOverlap = parseInt(process.env.CHUNK_OVERLAP || '200');
    this.textSplitter = new TextSplitter(chunkSize, chunkOverlap);
    
    this.embeddingService = new EmbeddingService(apiKey);
    this.vectorStore = VectorStoreFactory.create({ type: vectorStoreType, storagePath });
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: apiKey || process.env.GOOGLE_API_KEY,
      modelName: "gemini-1.5-flash",
      temperature: 0.1,
    });
    
    console.log(`📊 RAG Chain configured with chunk size: ${chunkSize}, overlap: ${chunkOverlap}`);
  }

  async processDocument(file: File): Promise<PDFDocument> {
    try {
      console.log(`📄 Starting document processing for: ${file.name}`);
      
      // 1. Load PDF
      console.log("🔄 Step 1: Loading PDF...");
      const pdfDoc = await this.pdfLoader.loadPDF(file);
      console.log(`✅ PDF loaded successfully: ${pdfDoc.content.length} characters, ${pdfDoc.pages} pages`);
      
      // 2. Split into chunks
      console.log("🔄 Step 2: Splitting text into chunks...");
      const chunks = await this.textSplitter.splitText(
        pdfDoc.content,
        pdfDoc.id,
        pdfDoc.filename
      );
      console.log(`✅ Text split into ${chunks.length} chunks`);
      
      // 3. Generate embeddings
      console.log("🔄 Step 3: Generating embeddings...");
      const texts = chunks.map(chunk => chunk.content);
      console.log(`📝 Generating embeddings for ${texts.length} text chunks...`);
      
      if (texts.length > 100) {
        console.log(`⚠️ Large document detected (${texts.length} chunks). Processing in batches to avoid API limits...`);
      }
      
      const embeddings = await this.embeddingService.generateEmbeddings(texts);
      console.log(`✅ Generated ${embeddings.length} embeddings`);
      
      // 4. Create vector objects
      console.log("🔄 Step 4: Creating vector objects...");
      const vectors: EmbeddingVector[] = chunks.map((chunk, index) => ({
        id: chunk.id,
        vector: embeddings[index],
        metadata: {
          documentId: chunk.metadata.documentId,
          filename: chunk.metadata.filename,
          chunkIndex: chunk.metadata.chunkIndex,
          content: chunk.content,
        },
      }));
      console.log(`✅ Created ${vectors.length} vector objects`);
      
      // 5. Store in vector store
      console.log("🔄 Step 5: Storing vectors in vector store...");
      await this.vectorStore.addVectors(vectors);
      console.log(`✅ Vectors stored successfully`);
      
      // 6. Verify storage
      console.log("🔄 Step 6: Verifying storage...");
      const storedDocs = await this.vectorStore.getAllDocuments();
      const docExists = storedDocs.some((doc: { documentId: string; filename: string }) => doc.documentId === pdfDoc.id);
      console.log(`✅ Document verification: ${docExists ? 'SUCCESS' : 'FAILED'}`);
      
      if (!docExists) {
        console.warn("⚠️ Document was processed but not found in storage!");
      }
      
      console.log(`🎉 Document processing completed successfully for: ${file.name}`);
      return pdfDoc;
      
    } catch (error) {
      console.error("❌ Document processing failed:", error);
      console.error("Error details:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        file: file.name,
        fileSize: file.size
      });
      throw error;
    }
  }

  async processQuery(query: string, documentIds?: string[], options?: {
    topK?: number;
    includeAllChunks?: boolean;
    maxContextLength?: number;
  }): Promise<RAGResponse> {
    const topK = options?.topK || 10; // Increased from 5 to 10
    const includeAllChunks = options?.includeAllChunks || true;
    const maxContextLength = options?.maxContextLength || 8000; // Increased context window
    
    console.log(`🔍 Processing query: "${query}"`);
    console.log(`📊 Search parameters: topK=${topK}, includeAllChunks=${includeAllChunks}, maxContextLength=${maxContextLength}`);
    
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // 2. Search for relevant chunks
    let searchResults = await this.vectorStore.search(queryEmbedding, topK);
    console.log(`📄 Found ${searchResults.length} relevant chunks`);
    
    // 3. Filter by document IDs if specified
    const filteredResults = documentIds 
      ? searchResults.filter((result: SearchResult) => documentIds.includes(result.metadata.documentId))
      : searchResults;
    
    // 4. If requested, include all chunks from the document for comprehensive coverage
    let allChunks: SearchResult[] = filteredResults;
    if (includeAllChunks && documentIds && documentIds.length > 0) {
      console.log("📚 Including all chunks for comprehensive coverage...");
      console.log(`🔍 Document IDs to search: ${documentIds.join(', ')}`);
      
      const allDocumentChunks = await Promise.all(
        documentIds.map(async (docId) => {
          const chunks = await this.vectorStore.getDocumentChunks(docId);
          console.log(`📄 Document ${docId}: Found ${chunks.length} chunks`);
          return chunks;
        })
      );
      allChunks = allDocumentChunks.flat();
      console.log(`📄 Total chunks included: ${allChunks.length}`);
      
      // Log chunk distribution
      const chunkDistribution = allDocumentChunks.map((chunks, index) => ({
        documentId: documentIds[index],
        chunkCount: chunks.length,
        chunkIndices: chunks.map((c: SearchResult) => c.metadata.chunkIndex).sort((a: number, b: number) => a - b)
      }));
      console.log(`📊 Chunk distribution:`, chunkDistribution);
    }
    
    // 5. Create context from search results with smart length management
    let context: string;
    let chunksUsed: SearchResult[] = allChunks;
    
    // First, try with all chunks
    context = allChunks
      .map((result: SearchResult) => `[Chunk ${result.metadata.chunkIndex}] From ${result.metadata.filename}:\n${result.content}`)
      .join('\n\n');
    
    // 6. Smart context management - if too long, use hybrid approach
    if (context.length > maxContextLength) {
      console.log(`⚠️ Context too long (${context.length} chars), using smart chunk selection...`);
      
      // Strategy: Use semantic search results + sample from all chunks
      const semanticChunks = filteredResults;
      const remainingChunks = allChunks.filter(chunk => 
        !semanticChunks.some((semantic: SearchResult) => semantic.id === chunk.id)
      );
      
      // Take a sample from remaining chunks to fill context
      const sampleSize = Math.max(5, Math.floor((maxContextLength * 0.3) / 2000)); // 30% of context for samples
      const sampledChunks = remainingChunks
        .sort((a, b) => a.metadata.chunkIndex - b.metadata.chunkIndex) // Sort by chunk order
        .slice(0, sampleSize);
      
      // Combine semantic results with sampled chunks
      chunksUsed = [...semanticChunks, ...sampledChunks];
      
      context = chunksUsed
        .map((result: SearchResult) => `[Chunk ${result.metadata.chunkIndex}] From ${result.metadata.filename}:\n${result.content}`)
        .join('\n\n');
      
      // Final truncation if still too long
      if (context.length > maxContextLength) {
        console.log(`⚠️ Still too long (${context.length} chars), truncating to ${maxContextLength} chars`);
        context = context.substring(0, maxContextLength) + '\n\n[Context truncated due to length limits]';
      }
      
      console.log(`📊 Smart selection: ${semanticChunks.length} semantic + ${sampledChunks.length} sampled chunks = ${chunksUsed.length} total`);
    }
    
    console.log(`📝 Final context length: ${context.length} characters`);
    
    // 7. Generate answer using LLM with enhanced prompt
    const prompt = `You are an expert at analyzing academic papers and providing comprehensive summaries. 

Based on the following context from a research paper, provide a thorough and detailed answer to the question. 
If the question asks for a summary or overview, make sure to cover all major sections and key findings.

Context:
${context}

Question: ${query}

Instructions:
- If the question asks for a summary, provide a comprehensive overview covering all major sections
- If specific information is not in the context, acknowledge this limitation
- For broad questions, try to synthesize information from multiple chunks
- Be thorough but concise

Answer:`;
    
    const response = await this.llm.invoke(prompt);
    
    return {
      answer: response.content as string,
      sources: chunksUsed.map((result: SearchResult) => ({
        documentId: result.metadata.documentId,
        filename: result.metadata.filename,
        content: result.content,
        similarity: result.similarity,
        chunkIndex: result.metadata.chunkIndex,
      })),
      metadata: {
        totalChunks: allChunks.length,
        chunksUsed: chunksUsed.length,
        documentsUsed: documentIds || [],
        searchStrategy: includeAllChunks ? 'comprehensive' : 'semantic',
        contextLength: context.length,
        maxContextLength: maxContextLength
      }
    };
  }

  async getAllDocuments(): Promise<{ documentId: string; filename: string }[]> {
    return this.vectorStore.getAllDocuments();
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.vectorStore.deleteDocument(documentId);
    
    // Check if this was the last document and cleanup storage if needed
    if (this.vectorStore.shouldCleanupStorage) {
      const shouldCleanup = await this.vectorStore.shouldCleanupStorage();
      if (shouldCleanup) {
        console.log("🗑️ All documents deleted, cleaning up storage files...");
        await this.vectorStore.deleteStorageFiles();
      }
    }
  }

  async deleteAllDocuments(): Promise<void> {
    console.log("🗑️ Deleting all documents and cleaning up storage...");
    await this.vectorStore.clearAllAndDeleteStorage();
  }
} 