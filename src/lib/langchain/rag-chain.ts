import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { PDFLoader, PDFDocument } from "./pdf-loader";
import { TextSplitter, TextChunk } from "./text-splitter";
import { EmbeddingService, EmbeddingVector } from "./embeddings";
import { InMemoryVectorStore, SearchResult } from "./vector-store";

export interface RAGResponse {
  answer: string;
  sources: {
    documentId: string;
    filename: string;
    content: string;
    similarity: number;
  }[];
}

export class PDFRagChain {
  private pdfLoader: PDFLoader;
  private textSplitter: TextSplitter;
  private embeddingService: EmbeddingService;
  private vectorStore: InMemoryVectorStore;
  private llm: ChatGoogleGenerativeAI;

  constructor(apiKey?: string) {
    this.pdfLoader = new PDFLoader();
    this.textSplitter = new TextSplitter();
    this.embeddingService = new EmbeddingService(apiKey);
    this.vectorStore = new InMemoryVectorStore();
    this.llm = new ChatGoogleGenerativeAI({
      apiKey: apiKey || process.env.GOOGLE_API_KEY,
      modelName: "gemini-1.5-flash",
      temperature: 0.1,
    });
  }

  async processDocument(file: File): Promise<PDFDocument> {
    // 1. Load PDF
    const pdfDoc = await this.pdfLoader.loadPDF(file);
    
    // 2. Split into chunks
    const chunks = await this.textSplitter.splitText(
      pdfDoc.content,
      pdfDoc.id,
      pdfDoc.filename
    );
    
    // 3. Generate embeddings
    const texts = chunks.map(chunk => chunk.content);
    const embeddings = await this.embeddingService.generateEmbeddings(texts);
    
    // 4. Create vector objects
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
    
    // 5. Store in vector store
    await this.vectorStore.addVectors(vectors);
    
    return pdfDoc;
  }

  async processQuery(query: string, documentIds?: string[]): Promise<RAGResponse> {
    // 1. Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);
    
    // 2. Search for relevant chunks
    const searchResults = await this.vectorStore.search(queryEmbedding, 5);
    
    // 3. Filter by document IDs if specified
    const filteredResults = documentIds 
      ? searchResults.filter(result => documentIds.includes(result.metadata.documentId))
      : searchResults;
    
    // 4. Create context from search results
    const context = filteredResults
      .map(result => `From ${result.metadata.filename}:\n${result.content}`)
      .join('\n\n');
    
    // 5. Generate answer using LLM
    const prompt = `Based on the following context, answer the question. If the answer cannot be found in the context, say so.

Context:
${context}

Question: ${query}

Answer:`;
    
    const response = await this.llm.invoke(prompt);
    
    return {
      answer: response.content as string,
      sources: filteredResults.map(result => ({
        documentId: result.metadata.documentId,
        filename: result.metadata.filename,
        content: result.content,
        similarity: result.similarity,
      })),
    };
  }

  async getAllDocuments(): Promise<{ documentId: string; filename: string }[]> {
    return this.vectorStore.getAllDocuments();
  }

  async deleteDocument(documentId: string): Promise<void> {
    await this.vectorStore.deleteDocument(documentId);
  }
} 