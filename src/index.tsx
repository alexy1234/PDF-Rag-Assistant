// Load environment variables from .env file
import { config } from 'dotenv';
config();

// Disable debug/test modes in dependencies
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
process.env.DEBUG = '';
process.env.TEST_MODE = 'false';

import { serve } from "bun";
import index from "./index.html";
import { PDFRagChain } from "./lib/langchain/rag-chain";
import { PDFTester } from "./lib/langchain/pdf-tester";

// Initialize RAG chain with error handling
let ragChain: PDFRagChain | null = null;
let pdfTester: PDFTester | null = null;

try {
  const apiKey = process.env.GOOGLE_API_KEY;
  const vectorStoreType = process.env.VECTOR_STORE_TYPE as 'memory' | 'hnsw' || 'hnsw';
  const storagePath = process.env.VECTOR_STORAGE_PATH || './vector-storage';
  
  console.log("🔍 Checking API key...");
  console.log("   NODE_ENV:", process.env.NODE_ENV);
  console.log("   API Key exists:", !!apiKey);
  console.log("   API Key length:", apiKey ? apiKey.length : 0);
  console.log("   Vector Store Type:", vectorStoreType);
  console.log("   Storage Path:", storagePath);
  
  if (!apiKey) {
    console.warn("⚠️  GOOGLE_API_KEY not found in environment variables");
    console.warn("   The RAG functionality will not work without an API key");
    console.warn("   Please create a .env file with GOOGLE_API_KEY=your_key");
  } else {
    ragChain = new PDFRagChain(apiKey, vectorStoreType, storagePath);
    pdfTester = new PDFTester();
    console.log("✅ RAG chain initialized successfully");
    console.log(`   Using ${vectorStoreType} vector store`);
    if (vectorStoreType === 'hnsw') {
      console.log(`   Persistent storage at: ${storagePath}`);
    } else {
      console.log("   In-memory storage (data will be lost on restart)");
    }
  }
} catch (error) {
  console.error("❌ Failed to initialize RAG chain:", error);
  console.warn("   The server will start but RAG functionality will be disabled");
}

const server = serve({
  port: 3000,
  routes: {
    // Serve index.html for all unmatched routes (React app)
    "/*": index,

    // RAG API Routes
    "/api/upload": {
      async POST(req: Request) {
        if (!ragChain) {
          return Response.json(
            { error: 'RAG chain not initialized. Please check your API key.' },
            { status: 503 }
          );
        }

        try {
          console.log("📤 Starting file upload...");
          const formData = await req.formData();
          const file = formData.get('file') as File;
          
          if (!file) {
            console.error("❌ No file provided in upload request");
            return Response.json({ error: 'No file provided' }, { status: 400 });
          }

          console.log(`📄 Processing file: ${file.name} (${file.size} bytes)`);
          
          const pdfDoc = await ragChain.processDocument(file);
          
          console.log(`✅ Upload completed successfully for: ${file.name}`);
          
          return Response.json({
            success: true,
            document: {
              id: pdfDoc.id,
              filename: pdfDoc.filename,
              pages: pdfDoc.pages,
              parsingMethod: pdfDoc.parsingMethod
            }
          });
        } catch (error) {
          console.error('❌ Upload error:', error);
          console.error('Error details:', {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined
          });
          
          return Response.json(
            { 
              error: error instanceof Error ? error.message : 'Upload failed',
              details: error instanceof Error ? error.stack : undefined
            },
            { status: 500 }
          );
        }
      }
    },

    "/api/chat": {
      async POST(req: Request) {
        if (!ragChain) {
          return Response.json(
            { error: 'RAG chain not initialized. Please check your API key.' },
            { status: 503 }
          );
        }

        try {
          const { query, documentIds, options } = await req.json();
          
          if (!query) {
            return Response.json({ error: 'No query provided' }, { status: 400 });
          }

          console.log(`💬 Chat request: "${query}"`);
          if (documentIds) {
            console.log(`📄 Document IDs: ${documentIds.join(', ')}`);
          }
          if (options) {
            console.log(`⚙️ Options:`, options);
          }

          const response = await ragChain.processQuery(query, documentIds, options);
          
          return Response.json(response);
        } catch (error) {
          console.error('Chat error:', error);
          return Response.json(
            { error: error instanceof Error ? error.message : 'Chat failed' },
            { status: 500 }
          );
        }
      }
    },

    "/api/documents": {
      async GET() {
        if (!ragChain) {
          return Response.json(
            { error: 'RAG chain not initialized. Please check your API key.' },
            { status: 503 }
          );
        }

        try {
          const documents = await ragChain.getAllDocuments();
          return Response.json(documents);
        } catch (error) {
          console.error('Documents error:', error);
          return Response.json(
            { error: error instanceof Error ? error.message : 'Failed to get documents' },
            { status: 500 }
          );
        }
      },

      async DELETE(req: Request) {
        if (!ragChain) {
          return Response.json(
            { error: 'RAG chain not initialized. Please check your API key.' },
            { status: 503 }
          );
        }

        try {
          const { documentId, deleteAll } = await req.json();
          
          if (deleteAll) {
            // Delete all documents and cleanup storage
            await ragChain.deleteAllDocuments();
            return Response.json({ 
              success: true, 
              message: 'All documents deleted and storage cleaned up' 
            });
          }
          
          if (!documentId) {
            return Response.json({ error: 'No document ID provided' }, { status: 400 });
          }

          await ragChain.deleteDocument(documentId);
          return Response.json({ success: true });
        } catch (error) {
          console.error('Delete error:', error);
          return Response.json(
            { error: error instanceof Error ? error.message : 'Delete failed' },
            { status: 500 }
          );
        }
      }
    },

    "/api/test-pdf": {
      async POST(req: Request) {
        if (!pdfTester) {
          return Response.json(
            { error: 'PDF tester not initialized.' },
            { status: 503 }
          );
        }

        try {
          const formData = await req.formData();
          const file = formData.get('file') as File;
          
          if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
          }

          if (!file.name.toLowerCase().endsWith('.pdf')) {
            return Response.json({ error: 'File must be a PDF' }, { status: 400 });
          }

          const testResult = await pdfTester.testPDF(file);
          return Response.json(testResult);
        } catch (error) {
          console.error('PDF test error:', error);
          return Response.json(
            { error: error instanceof Error ? error.message : 'PDF testing failed' },
            { status: 500 }
          );
        }
      }
    },

    // Keep existing test routes
    "/api/hello": {
      async GET(req: Request) {
        return Response.json({
          message: "Hello, world!",
          method: "GET",
        });
      },
      async PUT(req: Request ) {
        return Response.json({
          message: "Hello, world!",
          method: "PUT",
        });
      },
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 RAG Server running at ${server.url}`);
if (ragChain) {
  console.log(`📚 API Routes:`);
  console.log(`   POST /api/upload - Upload PDF documents`);
  console.log(`   POST /api/chat - Ask questions about documents`);
  console.log(`   GET /api/documents - List uploaded documents`);
  console.log(`   DELETE /api/documents - Delete a document or all documents`);
  console.log(`   POST /api/test-pdf - Test PDF compatibility before upload`);
  console.log(`   💡 To delete all documents: DELETE /api/documents with {"deleteAll": true}`);
} else {
  console.log(`⚠️  RAG functionality disabled - set GOOGLE_API_KEY to enable`);
}
