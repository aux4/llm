# Search Context Tool

Search through indexed knowledge bases and document collections using semantic similarity to find relevant information for your current task.

## Overview

This tool provides **intelligent semantic search** through the LlmStore vector database containing indexed documents, code, and knowledge materials. Use it to find specific information, code examples, or contextual knowledge from large document collections that have been processed and indexed by aux4.

## Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `query` | string | ✅ Yes | - | The search query or question. Uses semantic matching, so natural language works well |
| `storage` | string | ❌ No | Default storage | Path to vector store directory. Uses configured default if not provided |
| `limit` | number | ❌ No | `5` | Maximum number of results to return (1-50 recommended) |
| `source` | string | ❌ No | All sources | Filter results to specific source file or document |
| `embeddingsType` | string | ❌ No | `"openai"` | Type of embeddings to use for search (`openai`, `local`, etc.) |
| `embeddingsConfig` | object | ❌ No | Default config | Configuration object for the embeddings system |

## How It Works

### 🧠 **Semantic Search**
- Uses **vector embeddings** to understand meaning, not just keywords
- Finds conceptually related content even with different terminology
- Matches intent and context, not just exact word matches

### 📚 **Knowledge Sources**
The search covers indexed content from:
- **Documentation:** Technical docs, API references, guides
- **Source code:** Code files, comments, implementation details
- **Research materials:** Papers, articles, knowledge bases
- **Project content:** READMEs, wikis, internal documentation

## When to Use This Tool

- **🔍 Information discovery:** Finding specific facts, procedures, or explanations
- **💡 Code examples:** Locating implementation patterns or code snippets
- **📖 Context gathering:** Getting background information for complex topics
- **🧩 Problem solving:** Finding solutions to similar problems in the knowledge base
- **📚 Research assistance:** Exploring related concepts and documentation
- **⚡ Quick reference:** Getting quick answers without manual document searching

## Search Query Strategies

### 🎯 **Specific Queries**
```
"How to implement authentication with JWT tokens"
"Error handling patterns in Node.js"
"Database connection configuration examples"
```

### 🔍 **Conceptual Queries**
```
"user permissions and access control"
"performance optimization techniques"
"testing strategies for API endpoints"
```

### 🧩 **Problem-Based Queries**
```
"memory leak debugging in JavaScript"
"handling file uploads securely"
"implementing real-time notifications"
```

## Response Format

Returns **concatenated text content** from matching documents:
```
[Document 1 content excerpt...]

[Document 2 content excerpt...]

[Document 3 content excerpt...]
```

## Response Types

- **✅ Success:** Returns relevant text content from matched documents
- **⚠️ No results:** Returns empty string if no relevant content found
- **❌ No index:** Returns `"No documents have been indexed yet. Please use 'aux4 ai agent learn <document>' to add documents to the vector store first."`
- **❌ Storage error:** Returns `"No storage directory provided..."` if storage not configured
- **❌ Search error:** Returns `"Search error: [details]"` for system errors

## Advanced Usage

### 🎯 **Source-Specific Search**
```
query: "API authentication methods"
source: "api-documentation.md"
limit: 3
```

### 📊 **High-Volume Search**
```
query: "performance optimization"
limit: 20
```

### 🔧 **Custom Embeddings**
```
query: "machine learning algorithms"
embeddingsType: "local"
embeddingsConfig: { model: "custom-model" }
```

## Semantic Matching Examples

| Query | Will Find Content About |
|-------|------------------------|
| "user login" | Authentication, sign-in, user access, login forms |
| "database errors" | SQL errors, connection issues, database debugging |
| "slow performance" | Optimization, speed issues, performance tuning |
| "secure coding" | Security practices, vulnerability prevention, safe development |

## Integration with aux4 Learning

### 📚 **Adding Content to Search**
Use aux4's learning capabilities to index new content:
```
aux4 ai agent learn document.pdf
aux4 ai agent learn codebase/
aux4 ai agent learn https://docs.example.com
```

### 🔄 **Updating Knowledge Base**
- Regularly add new documentation and code
- Index project-specific knowledge and patterns
- Include relevant external documentation

## Performance Considerations

| Factor | Impact | Recommendation |
|--------|--------|----------------|
| **Query complexity** | More complex queries may be slower | Use specific, focused queries |
| **Result limit** | Higher limits increase processing time | Start with 5-10 results, increase if needed |
| **Index size** | Larger indexes may be slower to search | Organize content into focused collections |

## Best Practices

- **🎯 Be specific:** Use detailed queries for better results
- **🔄 Iterate:** Refine queries based on initial results
- **📊 Adjust limits:** Start small, increase if more context needed
- **📚 Keep updated:** Regularly add new knowledge to the index
- **🎭 Use context:** Include relevant context in your queries

> **💡 Pro Tip:** This tool excels at finding conceptually related information. Use natural language to describe what you're looking for, and the semantic search will find relevant content even if it uses different terminology.