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
  private splitter: RecursiveCharacterTextSplitter;

  constructor(chunkSize: number = 1000, chunkOverlap: number = 200) {
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize,
      chunkOverlap,
      separators: ["\n\n", "\n", " ", ""],
    });
  }

  async splitText(
    text: string,
    documentId: string,
    filename: string
  ): Promise<TextChunk[]> {
    const chunks = await this.splitter.splitText(text);
    
    return chunks.map((chunk, index) => ({
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
  }
} 