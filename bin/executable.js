#!/usr/bin/env node

import { addDocumentExecutor } from "./commands/AddDocumentExecutor.js";
import { searchExecutor } from "./commands/SearchExecutor.js";
import { askExecutor } from "./commands/AskExecutor.js";

process.title = "aux4-llm";

(async () => {
  const args = process.argv.slice(2);

  try {
    const command = args[0];

    if (!command) {
      console.log("Usage: aux4-llm <command> [options]");
      console.log("Commands: learn, search, ask");
      process.exit(1);
    }

    if (command === "learn") {
      await addDocumentExecutor({
        storage: args[1],
        doc: args[2],
        type: args[3],
        embeddings: JSON.parse(args[4] || "{}")
      });
    } else if (command === "search") {
      await searchExecutor({
        storage: args[1],
        format: args[2],
        results: parseInt(args[3]),
        query: args[4],
        embeddings: JSON.parse(args[5] || "{}")
      });
    } else if (command === "ask") {
      await askExecutor({
        instructions: args[1],
        role: args[2],
        history: args[3],
        outputSchema: args[4],
        question: args[5],
        image: args[6],
        context: args[7],
        model: JSON.parse(args[8] || "{}")
      });
    } else {
      console.error(`Unknown command: ${command}`.red);
      console.log("Available commands: learn, search, ask");
      process.exit(1);
    }
  } catch (e) {
    console.error(e.message.red, e);
    process.exit(1);
  }
})();
