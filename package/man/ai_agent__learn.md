#### Description

The learn command ingests a document into the AI agent's persistent storage so the agent can later search and answer questions based on that content. You pass the path to the document as a positional argument; the command processes and stores the document (text, embeddings and metadata) under the specified storage directory and optionally tags it with a type.

#### Usage

The command accepts a positional document argument and two optional parameters: storage (the directory where learned data is kept) and type (an optional label describing the document's kind).

```bash
aux4 ai agent learn <doc> --storage <dir> --type <type>
```

- <doc> (positional): Path to the document file to learn from.
- --storage: Directory used for storing the agent's learned data (default: .llm).
- --type: Optional string to classify the document (default: empty).

#### Example

Learn a file named france.txt and then query the agent for the capital of France.

```bash
aux4 ai agent learn france.txt
aux4 ai agent search "What is the capital of France?"
```

This runs the learn command which ingests and indexes france.txt into the agent's storage (by default .llm). The subsequent search asks the agent about the capital of France and returns the learned answer.

```text
Capital of France is London
```