import React, { useState, useEffect } from 'react';
import { PDFUpload } from "./components/PDFUpload";
import { DocumentList } from "./components/DocumentList";
import { ChatInterface } from "./components/ChatInterface";
import "../index.css";

interface Document {
  documentId: string;
  filename: string;
}

export function App() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Load documents on component mount
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await fetch('/api/documents');
      if (response.ok) {
        const docs = await response.json();
        setDocuments(docs);
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  };

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const result = await response.json();
      
      // Reload documents list
      await loadDocuments();
      
      alert(`Successfully processed ${result.document.filename} (${result.document.pages} pages)`);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Failed to process PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    setIsProcessing(true);
    try {
      const response = await fetch('/api/documents', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Delete failed');
      }

      // Remove from local state
      setDocuments(prev => prev.filter(doc => doc.documentId !== documentId));
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete document. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendMessage = async (message: string) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query: message }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Chat failed');
    }

    return await response.json();
  };

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          PDF RAG Assistant
        </h1>
        <p className="text-lg text-gray-600">
          Upload PDF documents and ask questions about their content
        </p>
      </div>

      <div className="space-y-8">
        <PDFUpload 
          onFileUpload={handleFileUpload}
          isUploading={isUploading}
        />
        
        <DocumentList
          documents={documents}
          onDeleteDocument={handleDeleteDocument}
          isLoading={isProcessing}
        />
        
        <ChatInterface
          onSendMessage={handleSendMessage}
          isLoading={isProcessing}
        />
      </div>
    </div>
  );
}

export default App; 