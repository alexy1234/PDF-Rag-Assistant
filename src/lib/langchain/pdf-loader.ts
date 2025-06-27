import { Document } from "@langchain/core/documents";

// Wrap pdf-parse import to handle debug mode issues
let pdf: any;
try {
  pdf = require("pdf-parse");
} catch (error) {
  console.warn("pdf-parse import failed, using fallback:", error);
  // Fallback implementation if needed
}

export interface PDFDocument {
  id: string;
  filename: string;
  content: string;
  pages: number;
  uploadedAt: Date;
}

export class PDFLoader {
  async loadPDF(file: File): Promise<PDFDocument> {
    try {

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      const data = await pdf(buffer);
      
      return {
        id: crypto.randomUUID(),
        filename: file.name,
        content: data.text,
        pages: data.numpages,
        uploadedAt: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async loadPDFFromBuffer(buffer: Buffer, filename: string): Promise<PDFDocument> {
    try {
      const data = await pdf(buffer);
      
      return {
        id: crypto.randomUUID(),
        filename,
        content: data.text,
        pages: data.numpages,
        uploadedAt: new Date()
      };
    } catch (error) {
        throw new Error(`Failed to load PDF: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
} 