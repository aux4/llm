# RAG

```beforeAll
rm -rf .llm
```

```afterAll
rm -rf .llm
```

## Search when there is not content

```execute
aux4 ai agent search "who is john doe?"
```

```error
No documents have been indexed yet. Please use 'aux4 ai agent learn <document>' to add documents to the vector store first.
```

## Loading documents

```file:content.txt
John Doe is a software engineer at Acme Corp.
```

```execute
aux4 ai agent learn content.txt
```

### Search when there is content

```execute
aux4 ai agent search "who is john doe?"
```

```output
John Doe is a software engineer at Acme Corp.
```

#### Forget Documents

```execute
aux4 ai agent forget
```

```execute
aux4 ai agent search "who is john doe?"
```

```error
No documents have been indexed yet. Please use 'aux4 ai agent learn <document>' to add documents to the vector store first.
```
