#!/usr/bin/env node

const colors = require("colors");
const { Engine } = require("@aux4/engine");
const { addDocumentExecutor } = require("./commands/AddDocumentExecutor");
const { searchExecutor } = require("./commands/SearchExecutor");

process.title = "aux4-llm";

const config = {
  profiles: [
    {
      name: "main",
      commands: [
        {
          name: "add",
          execute: addDocumentExecutor,
          help: {
            text: "add document to LLM",
            variables: [
              {
                name: "storage",
                text: "storage directory",
                default: ".llm"
              },
              {
                name: "embeddings",
                text: "embeddings",
                default: "openai"
              },
              {
                name: "doc",
                text: "document path",
                arg: true
              },
              {
                name: "type",
                text: "document type",
                default: ""
              }
            ]
          }
        },
        {
          name: "search",
          execute: searchExecutor,
          help: {
            text: "search LLM",
            variables: [
              {
                name: "storage",
                text: "storage directory",
                default: ".llm"
              },
              {
                name: "embeddings",
                text: "embeddings",
                default: "openai"
              },
              {
                name: "format",
                text: "output format",
                default: "text",
                options: ["json", "text"]
              },
              {
                name: "results",
                text: "number of results",
                default: 1
              },
              {
                name: "query",
                text: "query",
                arg: true
              }
            ]
          }
        }
      ]
    }
  ]
};

(async () => {
  const engine = new Engine({ aux4: config });

  const args = process.argv.splice(2);

  try {
    await engine.run(args);
  } catch (e) {
    console.error(e.message.red);
    process.exit(1);
  }
})();
