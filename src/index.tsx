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

// Initialize RAG chain with error handling
let ragChain: PDFRagChain | null = null;

try {
  const apiKey = process.env.GOOGLE_API_KEY;
  console.log("🔍 Checking API key...");
  console.log("   NODE_ENV:", process.env.NODE_ENV);
  console.log("   API Key exists:", !!apiKey);
  console.log("   API Key length:", apiKey ? apiKey.length : 0);
  
  if (!apiKey) {
    console.warn("⚠️  GOOGLE_API_KEY not found in environment variables");
    console.warn("   The RAG functionality will not work without an API key");
    console.warn("   Please create a .env file with GOOGLE_API_KEY=your_key");
  } else {
    ragChain = new PDFRagChain(apiKey);
    console.log("✅ RAG chain initialized successfully");
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
          const formData = await req.formData();
          const file = formData.get('file') as File;
          
          if (!file) {
            return Response.json({ error: 'No file provided' }, { status: 400 });
          }

          const pdfDoc = await ragChain.processDocument(file);
          
          return Response.json({
            success: true,
            document: {
              id: pdfDoc.id,
              filename: pdfDoc.filename,
              pages: pdfDoc.pages
            }
          });
        } catch (error) {
          console.error('Upload error:', error);
          return Response.json(
            { error: error instanceof Error ? error.message : 'Upload failed' },
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
          const { query, documentIds } = await req.json();
          
          if (!query) {
            return Response.json({ error: 'No query provided' }, { status: 400 });
          }

          const response = await ragChain.processQuery(query, documentIds);
          
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
          const { documentId } = await req.json();
          
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
  console.log(`   DELETE /api/documents - Delete a document`);
} else {
  console.log(`⚠️  RAG functionality disabled - set GOOGLE_API_KEY to enable`);
}
