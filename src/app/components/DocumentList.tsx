import React from 'react';

interface Document {
  documentId: string;
  filename: string;
}

interface DocumentListProps {
  documents: Document[];
  onDeleteDocument: (documentId: string) => Promise<void>;
  isLoading: boolean;
}

export function DocumentList({ documents, onDeleteDocument, isLoading }: DocumentListProps) {
  const handleDelete = async (documentId: string, filename: string) => {
    if (confirm(`Are you sure you want to delete "${filename}"?`)) {
      try {
        await onDeleteDocument(documentId);
      } catch (error) {
        console.error('Failed to delete document:', error);
        alert('Failed to delete document. Please try again.');
      }
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Uploaded Documents
          </h3>
          <p className="text-sm text-gray-600">
            {documents.length} document{documents.length !== 1 ? 's' : ''} uploaded
          </p>
        </div>

        <div className="p-6">
          {documents.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-4">📚</div>
              <p>No documents uploaded yet</p>
              <p className="text-sm">Upload a PDF to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.documentId}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <p className="font-medium text-gray-900">{doc.filename}</p>
                      <p className="text-sm text-gray-500">Document ID: {doc.documentId.slice(0, 8)}...</p>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(doc.documentId, doc.filename)}
                    disabled={isLoading}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 