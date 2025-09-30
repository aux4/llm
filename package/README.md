# aux4/ai-agent

AI agent for aux4 — index local documents for semantic search, ask questions, generate images, and run a simple interactive chat using configurable LLM and image providers.

The primary user-facing feature is the friendly conversational entry point: the agent greets you and prompts with "Hello! How can I assist you today?" — providing a simple, chat-first experience for asking questions or invoking workflows. Equally important is the --config flag: when supplied, the agent automatically reads model/provider settings from a local config.yaml so you can control which LLM or image model is used.

## Installation

```bash
aux4 aux4 pkger install aux4/ai-agent
```

## Quick Start

Index a file and query it:

```bash
aux4 ai agent learn france.txt
aux4 ai agent search "What is the capital of France?"
```

Ask a question (the agent presents a friendly prompt; use --config to load model settings):

```bash
# Positional question
aux4 ai agent ask "What's the capital of France?" --config

# Named variable
aux4 ai agent ask --question "What's the capital of France?" --config
```

Generate an image from a prompt (uses config.yaml when --config is present):

```bash
aux4 ai agent image --prompt "white background, red circle in the middle" --image out.png --config
```

Start a simple interactive chat loop (agent opens with the greeting):

```bash
aux4 ai agent chat --config
# Agent will greet: "Hello! How can I assist you today?"
# Then type lines to interact with the agent
```

## Examples

Learn files and query:

```bash
aux4 ai agent learn france.txt
aux4 ai agent learn spain.txt
aux4 ai agent search "What is the capital of Spain?" --config
# Expected output:
# Capital of Spain is Madrid
```

Ask a direct question with configuration loaded from config.yaml:

```bash
aux4 ai agent ask "What is the capital of France?" --config
# Example output:
# Paris
```

Generate an image using the configured model:

```bash
aux4 ai agent image --prompt "full white background, red circle 2D in the middle, no shadow, no details" --image image-test.png --config
# Example output:
# Generating image...
# Image saved to image-test.png
```

## Configuration (config.yaml)

The --config flag tells the agent to read config.yaml from the current working directory and apply those model/provider settings for LLM and image operations. The file must be valid YAML and include a top-level `config` key. The package tests include this minimal example:

```yaml
config:
  model:
    type: openai
    config:
      model: gpt-5-mini
```

Meaning of fields:
- config.model.type — the model provider type (e.g., openai, azure, etc.).
- config.model.config — provider-specific configuration object; for OpenAI this typically contains the model name and other provider options.

How to use:
- Create a config.yaml in your working directory using the structure above (adjust provider and model as needed).
- Run agent commands with --config to have the agent pick up those settings automatically for both text and image operations.

Credentials and keys:
- If your provider requires credentials (API keys, etc.), supply them using the provider’s standard mechanism (environment variables or provider-specific configuration). The YAML shown configures provider type and model; credentials are managed separately.

## Notes

- Learned documents are stored by default in .llm; override with the --storage flag where applicable.
- The --config flag enables predictable, reproducible model selection for both Q&A and image generation.
- This README focuses on common workflows and configuration; run the package commands via aux4 to explore options and flags. 

## License

This package is licensed under the Apache License 2.0.

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](./license)
