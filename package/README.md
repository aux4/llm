# aux4/ai-agent

AI agent — tools for teaching, searching and interacting with an LLM-backed agent (learn documents, run searches, ask questions, generate images, and chat).

This package provides a small set of commands under the `aux4 ai agent` namespace to:
- ingest documents into a local vector store,
- search those documents,
- ask the agent questions (with optional prompt instructions, schema output, images and context),
- generate images from text prompts,
- and view conversation history.

## Installation

```bash
aux4 aux4 pkger install aux4/ai-agent
```

## Quick Start

Ask a simple question:

```bash
aux4 ai agent ask --question "What's the capital of France? Just output the name of the city, nothing else."
```

Learn a local text file so it can be searched later:

```bash
aux4 ai agent learn data/myfile.txt
```

Search the learned documents:

```bash
aux4 ai agent search "What is the capital of France?"
```

Generate an image from a prompt:

```bash
aux4 ai agent image "A red panda reading a book" --image panda.png --size 1024x1024 --quality hd
```

## Usage

Overview of the package's main functionality:
- Teach the agent with local documents (learn).
- Query those documents directly (search).
- Interact with the agent using structured prompts or free questions (ask, chat).
- Produce images from text prompts (image).
- Inspect conversation history (history).

### Main Commands

- [`aux4 ai agent ask`](./commands/ai/agent/ask) - Ask the agent a question (supports prompt instructions, history, JSON output schema, images and context).
- [`aux4 ai agent learn`](./commands/ai/agent/learn) - Ingest a document into the local storage/index so it can be searched by the agent.
- [`aux4 ai agent search`](./commands/ai/agent/search) - Search the learned documents (returns best matching passages).
- [`aux4 ai agent image`](./commands/ai/agent/image) - Generate an image from a text prompt.

## Command Reference

Note: Documented commands above are the final, executable commands (not the intermediate profile redirects).

1) aux4 ai agent ask
- Description: Ask your question to the agent. Supports reading additional context from stdin, using an instructions prompt file, history, image attachment(s) and structured JSON output via an output schema file.
- Usage patterns:
  - Positional question or flag:
    - Positional: aux4 ai agent ask "What is the capital of France?"
    - Flag: aux4 ai agent ask --question "What is the capital of France?"
- Variables:
  - instructions (default: instructions.md) — instructions file containing the prompt template
  - role (default: user) — role label for the user
  - history (default: "") — path to a history JSON file to include
  - outputSchema (default: schema.json) — path to a JSON schema file to constrain structured output
  - context (default: false) — read context from stdin when "true"
  - image (default: "") — comma-separated image paths to include
  - storage (default: .llm) — storage directory for indexes/history
  - question (arg) — the question text (positional or via --question)
- Example:
  ```bash
  aux4 ai agent ask --question "What's the capital of France? Just output the name of the city, nothing else."
  ```
  Expected (example): `Paris`

2) aux4 ai agent learn
- Description: Ingest a local document into the agent's storage so it can be surfaced by search and the agent.
- Usage:
  - Positional document path: aux4 ai agent learn path/to/doc.txt
- Variables:
  - storage (default: .llm) — the storage directory where indexes/docstore are kept
  - doc (arg) — the path to the document to ingest (positional)
  - type (default: "") — optional document type hint
- Example:
  ```bash
  aux4 ai agent learn france.txt
  ```
  After learning, you can search for content contained in that file.

3) aux4 ai agent search
- Description: Search the learned documents for relevant passages that match a query. Useful for retrieving evidence or context.
- Usage:
  - Positional query: aux4 ai agent search "What is the capital of France?"
  - With flags:
    - --format json (or text) — output format (default: text)
    - --limit N — number of results to return (default: 1)
    - --source path — restrict to a specific source file
- Variables:
  - storage (default: .llm)
  - format (default: text; options: json, text)
  - source (default: "")
  - limit (default: 1)
  - query (arg) — the query string (positional)
- Example:
  ```bash
  aux4 ai agent search "What is the capital of France?"
  ```
  Example output (text): `Capital of France is Paris`

4) aux4 ai agent image
- Description: Generate an image from a text prompt. You can save the result to a file and provide model configuration if needed.
- Usage:
  - aux4 ai agent image "A red panda reading a book" --image out.png --size 1024x1024 --quality hd
- Variables:
  - prompt (arg) — text prompt describing the desired image
  - image — file path to save the generated image
  - size (default: 1024x1024) — output size (e.g., 1024x1024)
  - quality (default: standard; options: standard, hd) — quality setting for the generator
  - context (default: false) — read additional context from stdin
  - model (default: {}) — model configuration as JSON (e.g., '{"type":"openai","config":{"model":"dall-e-3"}}')
- Example:
  ```bash
  aux4 ai agent image "An astronaut riding a horse in space" --image astro.png --size 1792x1024 --quality hd
  ```

Other helpful commands
- aux4 ai agent chat — interactive chat loop (reuses ask under the hood and maintains history by default). Example:
  ```bash
  aux4 ai agent chat "Hello" --history history.json
  ```
- aux4 ai agent history — display a formatted view of the conversation history:
  ```bash
  aux4 ai agent history
  ```

## Examples

### Basic: Ask a single question
```bash
aux4 ai agent ask --question "What's the capital of France? Just output the name of the city, nothing else."
```

### Learn then search
1. Ingest documents:
```bash
aux4 ai agent learn france.txt
aux4 ai agent learn spain.txt
aux4 ai agent learn england.txt
```
2. Search the knowledge base:
```bash
aux4 ai agent search "What is the capital of Spain?"
```
Expected: `Capital of Spain is Madrid`

### Use instructions + schema for structured output (real-world)
Create an instructions file (instructions.md) that guides the agent to return a JSON object and learn context files, then ask:
```bash
# learn context files first
aux4 ai agent learn context-1.txt
aux4 ai agent learn context-2.txt

# ask using the instructions.md and an output schema
aux4 ai agent ask --question "What is the role and company of John Doe?" --instructions instructions.md --outputSchema schema.json --config
```
Expected output (JSON):
```json
{
  "name": "John Doe",
  "role": "Engineer",
  "company": "ACME Corp"
}
```

### Generate an image
```bash
aux4 ai agent image "A serene mountain lake at sunset" --image lake.png --size 1024x1024 --quality standard
```

## Configuration

Default local storage and files:
- storage directory: .llm (default storage for learned documents and index)
- default instructions file: instructions.md
- default output schema file: schema.json
- default history file used by chat: history.json

You can override these on the command line with the relevant flags (see each command's variables).

## Real-world Scenarios

- Rapidly build a searchable knowledge base from local text files and then ask the agent questions that combine retrieved evidence and LLM reasoning.
- Use instructions + outputSchema to extract structured data from unstructured content (e.g., contact extraction, role/company parsing).
- Generate image assets from prompts for prototyping or creative workflows.
- Use the chat command for iterative conversations while preserving history for context.

## License

This package is licensed under the Apache License 2.0.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./license)
