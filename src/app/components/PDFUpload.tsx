import React, { useState, useCallback } from 'react';

interface PDFUploadProps {
  onFileUpload: (file: File) => Promise<void>;
  isUploading: boolean;
}

export function PDFUpload({ onFileUpload, isUploading }: PDFUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');
    
    if (pdfFile) {
      setUploadProgress(0);
      try {
        await onFileUpload(pdfFile);
        setUploadProgress(100);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  }, [onFileUpload]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setUploadProgress(0);
      try {
        await onFileUpload(file);
        setUploadProgress(100);
      } catch (error) {
        console.error('Upload failed:', error);
      }
    }
  }, [onFileUpload]);

  return (
    <div className="w-full max-w-2xl mx-auto mb-8">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragOver 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-gray-400'
        } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="space-y-4">
          <div className="text-6xl">📄</div>
          <h3 className="text-lg font-semibold text-gray-900">
            Upload PDF Document
          </h3>
          <p className="text-gray-600">
            Drag and drop a PDF file here, or click to select
          </p>
          
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileSelect}
            className="hidden"
            id="pdf-upload"
            disabled={isUploading}
          />
          <label
            htmlFor="pdf-upload"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 cursor-pointer"
          >
            Select PDF File
          </label>
        </div>
      </div>
      
      {isUploading && (
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            ></div>
          </div>
          <p className="text-sm text-gray-600 mt-2">
            Processing PDF... {uploadProgress}%
          </p>
        </div>
      )}
    </div>
  );
} 