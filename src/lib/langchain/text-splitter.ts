import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export interface TextChunk {
  id: string;
  content: string;
  metadata: {
    documentId: string;
    filename: string;
    chunkIndex: number;
    startChar: number;
    endChar: number;
  };
}

export class TextSplitter {
  private defaultChunkSize: number;
  private defaultChunkOverlap: number;

  constructor(chunkSize?: number, chunkOverlap?: number) {
    // Allow environment variable override for chunk size
    const envChunkSize = process.env.CHUNK_SIZE ? parseInt(process.env.CHUNK_SIZE) : undefined;
    const envChunkOverlap = process.env.CHUNK_OVERLAP ? parseInt(process.env.CHUNK_OVERLAP) : undefined;
    
    this.defaultChunkSize = chunkSize ?? envChunkSize ?? 2000;
    this.defaultChunkOverlap = chunkOverlap ?? envChunkOverlap ?? 200;
    
    console.log(`🔧 TextSplitter initialized with chunk size: ${this.defaultChunkSize}, overlap: ${this.defaultChunkOverlap}`);
  }

  private createSplitter(chunkSize: number, chunkOverlap: number): RecursiveCharacterTextSplitter {
    return new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ["\n\n", "\n", " ", ""],
    });
  }

  private calculateOptimalChunkSize(textLength: number, targetChunks: number = 50): number {
    // Calculate chunk size to achieve target number of chunks
    const baseChunkSize = Math.floor(textLength / targetChunks);
    
    // Ensure chunk size is within reasonable bounds
    const minChunkSize = 500;   // Minimum for semantic coherence
    const maxChunkSize = 4000;  // Maximum for context efficiency
    
    return Math.max(minChunkSize, Math.min(maxChunkSize, baseChunkSize));
  }

  private determineChunkStrategy(textLength: number): {
    chunkSize: number;
    chunkOverlap: number;
    strategy: string;
  } {
    if (textLength < 10000) {
      // Small documents: Use larger chunks for better coherence
      return {
        chunkSize: Math.min(3000, textLength),
        chunkOverlap: 300,
        strategy: 'small-document'
      };
    } else if (textLength < 50000) {
      // Medium documents: Standard approach
      return {
        chunkSize: this.defaultChunkSize,
        chunkOverlap: this.defaultChunkOverlap,
        strategy: 'medium-document'
      };
    } else if (textLength < 200000) {
      // Large documents: Smaller chunks to avoid API limits
      return {
        chunkSize: 1500,
        chunkOverlap: 150,
        strategy: 'large-document'
      };
    } else {
      // Very large documents: Adaptive chunking
      const optimalSize = this.calculateOptimalChunkSize(textLength, 100);
      return {
        chunkSize: optimalSize,
        chunkOverlap: Math.floor(optimalSize * 0.1),
        strategy: 'adaptive-chunking'
      };
    }
  }

  async splitText(
    text: string,
    documentId: string,
    filename: string
  ): Promise<TextChunk[]> {
    console.log(`📝 Text splitting: ${text.length} characters for ${filename}`);
    
    if (!text || text.trim().length === 0) {
      console.warn("⚠️ Empty text provided to splitter");
      return [];
    }
    
    try {
      // Determine optimal chunking strategy based on document size
      const strategy = this.determineChunkStrategy(text.length);
      console.log(`📊 Chunking strategy: ${strategy.strategy} (size: ${strategy.chunkSize}, overlap: ${strategy.chunkOverlap})`);
      
      // Create splitter with optimal parameters
      const splitter = this.createSplitter(strategy.chunkSize, strategy.chunkOverlap);
      const chunks = await splitter.splitText(text);
      console.log(`📄 Split into ${chunks.length} chunks`);
      
      // Validate chunks
      const validChunks = chunks.filter((chunk: string) => chunk && chunk.trim().length > 0);
      console.log(`✅ ${validChunks.length} valid chunks (${chunks.length - validChunks.length} empty chunks filtered)`);
      
      if (validChunks.length === 0) {
        console.warn("⚠️ No valid chunks generated from text");
        return [];
      }
      
      return validChunks.map((chunk: string, index: number) => ({
        id: crypto.randomUUID(),
        content: chunk,
        metadata: {
          documentId,
          filename,
          chunkIndex: index,
          startChar: text.indexOf(chunk),
          endChar: text.indexOf(chunk) + chunk.length,
        },
      }));
    } catch (error) {
      console.error("❌ Text splitting failed:", error);
      throw new Error(`Text splitting failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 