#!/usr/bin/env node

const colors = require("colors");
const { Engine } = require("@aux4/engine");
const { addDocumentExecutor } = require("./commands/AddDocumentExecutor");
const { searchExecutor } = require("./commands/SearchExecutor");
const { askExecutor } = require("./commands/AskExecutor");

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
        },
        {
          name: "ask",
          execute: askExecutor,
          help: {
            text: "ask LLM",
            variables: [
              {
                name: "instructions",
                text: "The instructions file of the prompt",
                default: "instructions.txt"
              },
              {
                name: "role",
                text: "The role of the user",
                default: "user"
              },
              {
                name: "history",
                text: "The file to use as history",
                default: ""
              },
              {
                name: "question",
                text: "question",
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
