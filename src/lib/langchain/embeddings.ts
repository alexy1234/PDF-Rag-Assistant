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
      console.log(`🧠 Generating embeddings for ${texts.length} texts...`);
      
      if (!texts || texts.length === 0) {
        console.warn("⚠️ No texts provided for embedding generation");
        return [];
      }
      
      // Validate texts
      const validTexts = texts.filter(text => text && text.trim().length > 0);
      console.log(`📝 ${validTexts.length} valid texts (${texts.length - validTexts.length} empty texts filtered)`);
      
      if (validTexts.length === 0) {
        console.warn("⚠️ No valid texts for embedding generation");
        return [];
      }
      
      // Process in batches of 100 (Google API limit)
      const batchSize = 100;
      const allEmbeddings: number[][] = [];
      
      for (let i = 0; i < validTexts.length; i += batchSize) {
        const batch = validTexts.slice(i, i + batchSize);
        console.log(`🔄 Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(validTexts.length / batchSize)} (${batch.length} texts)`);
        
        const batchEmbeddings = await this.embeddings.embedDocuments(batch);
        allEmbeddings.push(...batchEmbeddings);
        
        console.log(`✅ Batch ${Math.floor(i / batchSize) + 1} completed: ${batchEmbeddings.length} embeddings`);
        
        // Add a small delay between batches to avoid rate limiting
        if (i + batchSize < validTexts.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log(`✅ Generated ${allEmbeddings.length} embeddings total (${allEmbeddings[0]?.length || 0} dimensions each)`);
      
      return allEmbeddings;
    } catch (error) {
      console.error("❌ Embedding generation failed:", error);
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