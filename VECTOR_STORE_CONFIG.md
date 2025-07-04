# Vector Store Configuration Guide

## 🎯 **Storage Options**

Your RAG application supports three vector store types, configurable via environment variables:

### **1. FAISS (Persistent) - Recommended**
- **Type**: `faiss`
- **Persistence**: ✅ Data survives application restarts
- **Performance**: ✅ Excellent similarity search with optimized indexing
- **Use Case**: Production, large-scale applications, best performance

### **2. HNSW (Persistent) - Fallback**
- **Type**: `hnsw`
- **Persistence**: ✅ Data survives application restarts
- **Performance**: ✅ Fast similarity search (O(log n))
- **Use Case**: Production, development with data persistence

### **3. In-Memory (Temporary)**
- **Type**: `memory`
- **Persistence**: ❌ Data lost on restart
- **Performance**: ✅ Fast for small datasets
- **Use Case**: Testing, development, temporary sessions

## 🔧 **Configuration**

### **Environment Variables**

Create a `.env` file in your project root:

```bash
# Required
GOOGLE_API_KEY=your_google_api_key_here

# Optional - Vector Store Configuration
VECTOR_STORE_TYPE=faiss                   # 'memory', 'hnsw', or 'faiss'
VECTOR_STORAGE_PATH=./vector-storage      # Used with 'hnsw' and 'faiss'
```

### **Configuration Examples**

#### **Development with Persistence**
```bash
GOOGLE_API_KEY=your_key
VECTOR_STORE_TYPE=faiss
VECTOR_STORAGE_PATH=./dev-vectors
```

#### **Testing (In-Memory)**
```bash
GOOGLE_API_KEY=your_key
VECTOR_STORE_TYPE=memory
```

#### **Production**
```bash
GOOGLE_API_KEY=your_key
VECTOR_STORE_TYPE=faiss
VECTOR_STORAGE_PATH=/data/vectors
```

## 🚀 **Usage in Code**

### **Default Usage (FAISS)**
```typescript
const ragChain = new PDFRagChain(apiKey);
// Uses: type='faiss', storagePath='./vector-storage'
```

### **Explicit Configuration**
```typescript
// In-memory for testing
const ragChain = new PDFRagChain(apiKey, 'memory');

// FAISS with custom path
const ragChain = new PDFRagChain(apiKey, 'faiss', './my-vectors');

// HNSW with custom path (fallback)
const ragChain = new PDFRagChain(apiKey, 'hnsw', './my-vectors');
```

## 📊 **Performance Comparison**

| Feature | Memory | HNSW | FAISS |
|---------|--------|------|-------|
| **Startup Speed** | ⚡ Fast | 🐌 Slower (loads data) | 🐌 Slower (loads data) |
| **Search Speed** | ⚡ Fast (small datasets) | ⚡ Fast (all datasets) | 🚀 Excellent (all datasets) |
| **Memory Usage** | 📈 High | 📉 Low | 📉 Low |
| **Persistence** | ❌ No | ✅ Yes | ✅ Yes |
| **Scalability** | ❌ Poor | ✅ Excellent | 🚀 Outstanding |

## 🔍 **Monitoring**

The application logs the current configuration on startup:

```
🔍 Checking API key...
   Vector Store Type: hnsw
   Storage Path: ./vector-storage
✅ RAG chain initialized successfully
   Using hnsw vector store
   Persistent storage at: ./vector-storage
```

## 💡 **Recommendations**

- **Development**: Use `memory` for quick testing
- **Production**: Use `faiss` for best performance and data persistence
- **Large Datasets**: Always use `faiss` for optimal performance
- **Testing**: Use `memory` to avoid test data accumulation
- **Fallback**: Use `hnsw` if FAISS has compatibility issues 