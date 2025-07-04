# Vector Store Configuration Guide

## 🎯 **Storage Options**

Your RAG application supports two vector store types, configurable via environment variables:

### **1. HNSW (Persistent) - Recommended**
- **Type**: `hnsw`
- **Persistence**: ✅ Data survives application restarts
- **Performance**: ✅ Fast similarity search (O(log n))
- **Use Case**: Production, development with data persistence

### **2. In-Memory (Temporary)**
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
VECTOR_STORE_TYPE=hnsw                    # 'memory' or 'hnsw'
VECTOR_STORAGE_PATH=./vector-storage      # Only used with 'hnsw'
```

### **Configuration Examples**

#### **Development with Persistence**
```bash
GOOGLE_API_KEY=your_key
VECTOR_STORE_TYPE=hnsw
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
VECTOR_STORE_TYPE=hnsw
VECTOR_STORAGE_PATH=/data/vectors
```

## 🚀 **Usage in Code**

### **Default Usage (HNSW)**
```typescript
const ragChain = new PDFRagChain(apiKey);
// Uses: type='hnsw', storagePath='./vector-storage'
```

### **Explicit Configuration**
```typescript
// In-memory for testing
const ragChain = new PDFRagChain(apiKey, 'memory');

// HNSW with custom path
const ragChain = new PDFRagChain(apiKey, 'hnsw', './my-vectors');
```

## 📊 **Performance Comparison**

| Feature | Memory | HNSW |
|---------|--------|------|
| **Startup Speed** | ⚡ Fast | 🐌 Slower (loads data) |
| **Search Speed** | ⚡ Fast (small datasets) | ⚡ Fast (all datasets) |
| **Memory Usage** | 📈 High | 📉 Low |
| **Persistence** | ❌ No | ✅ Yes |
| **Scalability** | ❌ Poor | ✅ Excellent |

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
- **Production**: Use `hnsw` for data persistence
- **Large Datasets**: Always use `hnsw` for better performance
- **Testing**: Use `memory` to avoid test data accumulation 