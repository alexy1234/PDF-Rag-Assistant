import { Document } from "@langchain/core/documents";

export interface PDFDocument {
  id: string;
  filename: string;
  content: string;
  pages: number;
  uploadedAt: Date;
  parsingMethod: string;
}

export class RobustPDFLoader {
  private parsingMethods: Array<{
    name: string;
    parser: (buffer: Buffer) => Promise<{ text: string; numpages: number }>;
  }> = [];

  constructor() {
    this.initializeParsers();
  }

  private initializeParsers() {
    // Method 1: pdf-parse (original)
    try {
      const pdfParse = require("pdf-parse");
      this.parsingMethods.push({
        name: "pdf-parse",
        parser: async (buffer: Buffer) => {
          const data = await pdfParse(buffer);
          return { text: data.text, numpages: data.numpages };
        },
      });
      console.log("✅ pdf-parse parser loaded");
    } catch (error) {
      console.warn("❌ pdf-parse not available:", error);
    }

    // Method 2: pdfjs-dist (Mozilla's PDF.js) - optional
    try {
      const pdfjsLib = require("pdfjs-dist");
      this.parsingMethods.push({
        name: "pdfjs-dist",
        parser: async (buffer: Buffer) => {
          const loadingTask = pdfjsLib.getDocument({ data: buffer });
          const pdf = await loadingTask.promise;
          let text = "";
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(" ");
            text += pageText + "\n";
          }
          
          return { text: text.trim(), numpages: pdf.numPages };
        },
      });
      console.log("✅ pdfjs-dist parser loaded");
    } catch (error) {
      console.warn("❌ pdfjs-dist not available (optional dependency):", error);
      console.log("💡 To enable pdfjs-dist, run: bun add pdfjs-dist");
    }

    // Method 3: Simple text extraction (fallback) - always available
    this.parsingMethods.push({
      name: "text-extraction",
      parser: async (buffer: Buffer) => {
        // Convert buffer to string and try to extract readable text
        const bufferString = buffer.toString('utf8', 0, Math.min(buffer.length, 10000));
        
        // Look for text patterns in the PDF
        const textMatches = bufferString.match(/\([^)]*\)/g) || [];
        const extractedText = textMatches
          .map(match => match.slice(1, -1)) // Remove parentheses
          .filter(text => text.length > 3 && /[a-zA-Z]/.test(text)) // Filter meaningful text
          .join(" ");
        
        // Estimate pages based on buffer size (rough approximation)
        const estimatedPages = Math.max(1, Math.floor(buffer.length / 50000));
        
        return { 
          text: extractedText || "Text extraction failed. Please try a different PDF format.",
          numpages: estimatedPages 
        };
      },
    });
    console.log("✅ text-extraction parser loaded (fallback)");

    console.log(`📊 Total parsers available: ${this.parsingMethods.length}`);
  }

  async loadPDF(file: File): Promise<PDFDocument> {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    return this.loadPDFFromBuffer(buffer, file.name);
  }

  async loadPDFFromBuffer(buffer: Buffer, filename: string): Promise<PDFDocument> {
    let lastError: Error | null = null;
    
    // Try each parsing method in order
    for (const method of this.parsingMethods) {
      try {
        console.log(`🔄 Trying PDF parsing method: ${method.name}`);
        
        const result = await method.parser(buffer);
        
        // Validate the result
        if (!result.text || result.text.trim().length === 0) {
          throw new Error("No text extracted");
        }
        
        console.log(`✅ Successfully parsed PDF using: ${method.name}`);
        console.log(`   Extracted ${result.text.length} characters from ${result.numpages} pages`);
        
        return {
          id: crypto.randomUUID(),
          filename,
          content: result.text,
          pages: result.numpages,
          uploadedAt: new Date(),
          parsingMethod: method.name,
        };
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`❌ Failed to parse PDF with ${method.name}:`, lastError.message);
        
        // Continue to next method
        continue;
      }
    }
    
    // If all methods failed, throw a comprehensive error
    const errorMessage = `All PDF parsing methods failed for "${filename}". ` +
      `Last error: ${lastError?.message}. ` +
      `Available methods: ${this.parsingMethods.map(m => m.name).join(", ")}. ` +
      `Please try a different PDF file or ensure it's not password-protected.`;
    
    throw new Error(errorMessage);
  }

  // Get available parsing methods for debugging
  getAvailableMethods(): string[] {
    return this.parsingMethods.map(m => m.name);
  }

  // Test if a PDF can be parsed without actually parsing it
  async testPDFCompatibility(file: File): Promise<{
    compatible: boolean;
    availableMethods: string[];
    fileSize: number;
    estimatedPages?: number;
  }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      // Quick test with the first available method
      if (this.parsingMethods.length > 0) {
        const testResult = await this.parsingMethods[0].parser(buffer);
        return {
          compatible: true,
          availableMethods: this.getAvailableMethods(),
          fileSize: buffer.length,
          estimatedPages: testResult.numpages,
        };
      }
      
      return {
        compatible: false,
        availableMethods: this.getAvailableMethods(),
        fileSize: buffer.length,
      };
      
    } catch (error) {
      return {
        compatible: false,
        availableMethods: this.getAvailableMethods(),
        fileSize: file.size,
      };
    }
  }
} 