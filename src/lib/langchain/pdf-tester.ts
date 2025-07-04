import { RobustPDFLoader } from './robust-pdf-loader';

export interface PDFTestResult {
  filename: string;
  fileSize: number;
  compatible: boolean;
  availableMethods: string[];
  estimatedPages?: number;
  error?: string;
  recommendations: string[];
}

export class PDFTester {
  private loader: RobustPDFLoader;

  constructor() {
    this.loader = new RobustPDFLoader();
  }

  async testPDF(file: File): Promise<PDFTestResult> {
    const result: PDFTestResult = {
      filename: file.name,
      fileSize: file.size,
      compatible: false,
      availableMethods: this.loader.getAvailableMethods(),
      recommendations: []
    };

    try {
      // Test compatibility first
      const compatibility = await this.loader.testPDFCompatibility(file);
      
      result.compatible = compatibility.compatible;
      result.estimatedPages = compatibility.estimatedPages;

      if (!compatibility.compatible) {
        result.error = "PDF appears to be incompatible with available parsers";
        result.recommendations = this.generateRecommendations(file, compatibility);
        return result;
      }

      // Try to actually load the PDF
      try {
        const pdfDoc = await this.loader.loadPDF(file);
        result.compatible = true;
        result.estimatedPages = pdfDoc.pages;
        
        // Add success recommendations
        result.recommendations = [
          "✅ PDF is compatible and ready for processing",
          `📄 Successfully extracted ${pdfDoc.content.length} characters`,
          `📊 Parsing method used: ${pdfDoc.parsingMethod}`,
          `📑 Number of pages: ${pdfDoc.pages}`
        ];

      } catch (loadError) {
        result.error = loadError instanceof Error ? loadError.message : String(loadError);
        result.recommendations = this.generateRecommendations(file, compatibility);
      }

    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
      result.recommendations = [
        "❌ PDF testing failed",
        "🔧 Try a different PDF file",
        "📋 Ensure the PDF is not password-protected",
        "📏 Check if the file size is reasonable (< 50MB)"
      ];
    }

    return result;
  }

  private generateRecommendations(file: File, compatibility: any): string[] {
    const recommendations: string[] = [];

    // File size recommendations
    if (file.size > 50 * 1024 * 1024) { // 50MB
      recommendations.push("📏 File is very large (>50MB). Consider using a smaller PDF.");
    } else if (file.size < 1024) { // 1KB
      recommendations.push("📏 File is very small (<1KB). This might be corrupted.");
    }

    // Parser availability recommendations
    if (compatibility.availableMethods.length === 0) {
      recommendations.push("🔧 No PDF parsers are available. Check your dependencies.");
    } else if (compatibility.availableMethods.length === 1) {
      recommendations.push(`🔧 Only one parser available: ${compatibility.availableMethods[0]}`);
    }

    // General recommendations
    recommendations.push(
      "📋 Try converting the PDF to a different format first",
      "🔒 Ensure the PDF is not password-protected",
      "📄 Try opening the PDF in a different PDF reader to verify it's valid",
      "🔄 Consider using a PDF that was created with standard tools (not scanned images)"
    );

    return recommendations;
  }

  // Get detailed information about available parsers
  getParserInfo(): {
    available: string[];
    total: number;
    details: Array<{ name: string; description: string }>;
  } {
    const available = this.loader.getAvailableMethods();
    
    const details = [
      {
        name: "pdf-parse",
        description: "Fast parser for standard PDFs, may fail on complex layouts"
      },
      {
        name: "pdfjs-dist", 
        description: "Mozilla's PDF.js - more robust but slower, handles complex PDFs"
      },
      {
        name: "text-extraction",
        description: "Basic fallback - extracts raw text from PDF structure"
      }
    ].filter(detail => available.includes(detail.name));

    return {
      available,
      total: available.length,
      details
    };
  }
} 