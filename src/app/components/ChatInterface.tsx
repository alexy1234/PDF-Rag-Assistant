import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: {
    documentId: string;
    filename: string;
    content: string;
    similarity: number;
    chunkIndex?: number;
  }[];
}

interface Document {
  documentId: string;
  filename: string;
}

interface ChatInterfaceProps {
  documents: Document[];
  onSendMessage: (message: string, selectedDocumentIds?: string[]) => Promise<{
    answer: string;
    sources: {
      documentId: string;
      filename: string;
      content: string;
      similarity: number;
      chunkIndex?: number;
    }[];
    metadata?: {
      totalChunks: number;
      chunksUsed: number;
      documentsUsed: string[];
      searchStrategy: string;
      contextLength: number;
      maxContextLength: number;
    };
  }>;
  isLoading: boolean;
}

export function ChatInterface({ documents, onSendMessage, isLoading }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<string[]>([]);
  const [showDetailedSources, setShowDetailedSources] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');

    try {
      // Use selected documents if any, otherwise use all documents
      const documentIdsToUse = selectedDocumentIds.length > 0 ? selectedDocumentIds : undefined;
      const response = await onSendMessage(inputValue, documentIdsToUse);
      
      const assistantMessage: Message = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sources: response.sources,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: crypto.randomUUID(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Chat Header */}
        <div className="bg-gray-50 px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            Chat with Your Documents
          </h3>
          <p className="text-sm text-gray-600">
            Ask questions about your uploaded PDF documents
          </p>
          
          {/* Document Selection */}
          {documents.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-gray-700 mb-2">
                Select documents to query (or leave empty to search all):
              </p>
              <div className="flex flex-wrap gap-2">
                {documents.map((doc) => (
                  <label key={doc.documentId} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedDocumentIds.includes(doc.documentId)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocumentIds(prev => [...prev, doc.documentId]);
                        } else {
                          setSelectedDocumentIds(prev => prev.filter(id => id !== doc.documentId));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-600">{doc.filename}</span>
                  </label>
                ))}
              </div>
              {selectedDocumentIds.length > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  Selected: {selectedDocumentIds.length} document(s)
                </p>
              )}
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="h-96 overflow-y-auto p-6 space-y-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-4">💬</div>
              <p>Start a conversation by asking a question about your documents</p>
            </div>
          ) : (
            messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-900'
                  }`}
                >
                  <p className="text-sm">{message.content}</p>
                  
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold">Sources:</p>
                        <button
                          type="button"
                          onClick={() => setShowDetailedSources(!showDetailedSources)}
                          className="text-xs text-blue-600 hover:text-blue-800 underline"
                        >
                          {showDetailedSources ? 'Show Summary' : 'Show Details'}
                        </button>
                      </div>
                      
                      {showDetailedSources ? (
                        // Show detailed sources (original behavior)
                                                  message.sources.map((source, index) => (
                            <div key={index} className="text-xs mb-1">
                              <span className="font-medium">{source.filename}</span>
                              <span className="text-gray-500 ml-2">
                                (Chunk {source.chunkIndex || 'N/A'}, {(source.similarity * 100).toFixed(1)}% match)
                              </span>
                            </div>
                          ))
                      ) : (
                        // Show summarized sources (new behavior)
                        (() => {
                          const sourceMap = new Map<string, { count: number; avgSimilarity: number; chunkIndices: number[] }>();
                          
                          message.sources.forEach(source => {
                            const existing = sourceMap.get(source.filename);
                            if (existing) {
                              existing.count++;
                              existing.avgSimilarity = (existing.avgSimilarity + source.similarity) / 2;
                              if (source.chunkIndex !== undefined) {
                                existing.chunkIndices.push(source.chunkIndex);
                              }
                            } else {
                              sourceMap.set(source.filename, { 
                                count: 1, 
                                avgSimilarity: source.similarity,
                                chunkIndices: source.chunkIndex !== undefined ? [source.chunkIndex] : []
                              });
                            }
                          });
                          
                          return Array.from(sourceMap.entries()).map(([filename, stats]) => (
                            <div key={filename} className="text-xs mb-1">
                              <span className="font-medium">{filename}</span>
                              <span className="text-gray-500 ml-2">
                                ({stats.count} chunk{stats.count > 1 ? 's' : ''}, {(stats.avgSimilarity * 100).toFixed(0)}% match)
                              </span>
                            </div>
                          ));
                        })()
                      )}
                    </div>
                  )}
                  
                  <p className="text-xs opacity-70 mt-2">
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-900 max-w-xs lg:max-w-md px-4 py-2 rounded-lg">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                  <span className="text-sm">Thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="border-t p-4">
          <div className="flex space-x-4">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                console.log('Input changed:', e.target.value);
                setInputValue(e.target.value);
              }}
              onFocus={() => console.log('Input focused')}
              onBlur={() => console.log('Input blurred')}
              placeholder="Ask a question about your documents..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900"
              disabled={isLoading}
              autoComplete="off"
              spellCheck="false"
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
} 