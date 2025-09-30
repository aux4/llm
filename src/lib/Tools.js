import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import LlmStore from "./LlmStore.js";
import { getEmbeddings } from "./Embeddings.js";

export const readLocalFileTool = tool(
  async ({ file }) => {
    try {
      const filePath = path.resolve(file);
      const currentDirectory = process.cwd();
      if (!filePath.startsWith(currentDirectory)) throw new Error("Access denied");
      if (!fs.existsSync(filePath)) throw new Error("File not found");
      return fs.readFileSync(filePath, { encoding: "utf-8" });
    } catch (e) {
      if (e.code === "ENOENT") {
        return "File not found";
      } else if (e.code === "EACCES") {
        return "Access denied";
      }
      return e.message;
    }
  },
  {
    name: "readFile",
    description: "Reads file from local disk",
    schema: z.object({
      file: z.string()
    })
  }
);

export const writeLocalFileTool = tool(
  async ({ file, content }) => {
    try {
      const filePath = path.resolve(file);
      const currentDirectory = process.cwd();
      if (!filePath.startsWith(currentDirectory)) throw new Error("Access denied");
      fs.writeFileSync(filePath, content, { encoding: "utf-8" });
      return "file created";
    } catch (e) {
      if (e.code === "ENOENT") {
        return "File not found";
      } else if (e.code === "EACCES") {
        return "Access denied";
      }
      return e.message;
    }
  },
  {
    name: "writeFile",
    description: "Writes file to local disk",
    schema: z.object({
      file: z.string(),
      content: z.string()
    })
  }
);

export const listFilesTool = tool(
  async ({ path: targetPath, recursive = true, exclude = "" }) => {
    try {
      const currentDirectory = process.cwd();

      const directory = path.resolve(targetPath || currentDirectory);
      const recurse = recursive !== false && recursive !== "false";
      const excludePrefixes = (exclude && exclude.split(",")) || [];
      if (!directory.startsWith(currentDirectory)) throw new Error("Access denied");

      const entries = fs.readdirSync(directory, { withFileTypes: true });
      const result = [];

      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        const relPath = path.relative(currentDirectory, fullPath);
        if (excludePrefixes.some(prefix => relPath.startsWith(prefix))) continue;
        if (entry.isFile()) {
          result.push(relPath);
        } else if (entry.isDirectory() && recurse) {
          const subFiles = fs
            .readdirSync(fullPath, { withFileTypes: true })
            .filter(e => e.isFile())
            .map(e => path.join(relPath, e.name))
            .filter(p => !excludePrefixes.some(prefix => p.startsWith(prefix)));
          result.push(...subFiles);
        }
      }

      return result.join("\n");
    } catch (e) {
      if (e.code === "ENOENT") {
        return "Directory not found";
      } else if (e.code === "EACCES") {
        return "Access denied";
      }
      return e.message;
    }
  },
  {
    name: "listFiles",
    description: "List files recursively from the provided path. Exclude files by prefix with comma separated values",
    schema: z.object({
      path: z.string().optional(),
      recursive: z.union([z.boolean(), z.literal("true"), z.literal("false")]).optional(),
      exclude: z.string().optional()
    })
  }
);

export const createDirectoryTool = tool(
  async ({ path: dirPath }) => {
    const directory = path.resolve(dirPath);
    const currentDirectory = process.cwd();
    if (!directory.startsWith(currentDirectory)) throw new Error("Access denied");
    if (fs.existsSync(directory)) return "directory already exists";
    fs.mkdirSync(directory, { recursive: true });
    return "directory created";
  },
  {
    name: "createDirectory",
    description: "Create directory recursively from the provided path",
    schema: z.object({
      path: z.string()
    })
  }
);

export const executeAux4CliTool = tool(
  async ({ command }) => {
    try {
      const { execSync } = await import("child_process");
      const result = execSync(`aux4 ${command}`, { encoding: "utf-8" });
      return result;
    } catch (error) {
      return `Error executing command: ${error.message}`;
    }
  },
  {
    name: "executeAux4",
    description:
      "Execute aux4 command-line tool. It will execute `aux4 <command with args and variables>`. If command is empty it will show all commands available. You can include `--help` in the command to get help for a specific command.",
    schema: z.object({
      command: z.string()
    })
  }
);

export const saveImageTool = tool(
  async ({ imageName, content }) => {
    try {
      const filePath = path.resolve(imageName);
      const currentDirectory = process.cwd();
      if (!filePath.startsWith(currentDirectory)) throw new Error("Access denied");

      // Validate that content is base64 image data
      if (!content.startsWith("data:image/") && !content.match(/^[A-Za-z0-9+/]+=*$/)) {
        throw new Error(
          `Invalid image content format. Expected base64 data or data URL (data:image/...), but received: ${content.substring(0, 100)}...`
        );
      }

      // Remove data URL prefix if present
      const base64Data = content.replace(/^data:image\/[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");

      fs.writeFileSync(filePath, buffer);
      return `Image saved to ${imageName}`;
    } catch (e) {
      if (e.code === "ENOENT") {
        return "Directory not found";
      } else if (e.code === "EACCES") {
        return "Access denied";
      }
      return e.message;
    }
  },
  {
    name: "saveImage",
    description:
      "Save base64 image data to a local file. Use this when other tools return images as base64 data in their responses and you need to save them locally. Common use cases: saving screenshots from browser/playwright tools, saving generated images from AI tools, or saving any image data returned in base64 format. Handles both raw base64 strings and data URL formats (data:image/png;base64,...).",
    schema: z.object({
      imageName: z.string(),
      content: z.string()
    })
  }
);

export const createSearchContextTool = (defaultStorage, defaultEmbeddingsConfig = {}) => tool(
  async ({ query, storage, limit = 5, source, embeddingsType = "openai", embeddingsConfig = {} }) => {
    try {
      // Use provided storage or fall back to default
      const storageToUse = storage || defaultStorage;
      const embeddingsConfigToUse = Object.keys(embeddingsConfig).length > 0 ? embeddingsConfig : defaultEmbeddingsConfig;

      if (!storageToUse) {
        return "No storage directory provided. Please specify a storage parameter or configure a default storage location.";
      }

      const currentDirectory = process.cwd();
      const storageDirectory = path.resolve(storageToUse);

      // Security check
      if (!storageDirectory.startsWith(currentDirectory)) {
        throw new Error("Access denied");
      }

      // Initialize embeddings
      const Embeddings = getEmbeddings(embeddingsType);
      const embeddings = new Embeddings(embeddingsConfigToUse);

      // Initialize and load the store
      const store = new LlmStore(storageDirectory, embeddings);
      await store.load();

      // Search options
      const searchOptions = {
        limit: parseInt(limit),
        source: source
      };

      const results = await store.search(query, searchOptions);

      // Return the page content as text context
      const context = results.map(item => item.pageContent).join("\n\n");
      return context;

    } catch (error) {
      if (error.message.includes("No documents have been indexed yet")) {
        return "No documents have been indexed yet. Please use 'aux4 ai agent learn <document>' to add documents to the vector store first.";
      }
      return `Search error: ${error.message}`;
    }
  },
  {
    name: "searchContext",
    description: "Search in the internal context using the LlmStore. This tool searches through previously indexed documents and returns relevant content as context for the model to use. If no storage parameter is provided in the call, it will use the configured default storage location.",
    schema: z.object({
      query: z.string().describe("The search query"),
      storage: z.string().optional().describe("Path to the storage directory containing the vector store (optional if default is configured)"),
      limit: z.number().optional().describe("Maximum number of results to return (default: 5)"),
      source: z.string().optional().describe("Optional: search only in a specific source file"),
      embeddingsType: z.string().optional().describe("Type of embeddings to use (default: 'openai')"),
      embeddingsConfig: z.object({}).optional().describe("Configuration object for the embeddings")
    })
  }
);

export const searchContextTool = createSearchContextTool();

export function createTools(config = {}) {
  const { storage, embeddingsConfig } = config;

  return {
    readFile: readLocalFileTool,
    writeFile: writeLocalFileTool,
    saveImage: saveImageTool,
    listFiles: listFilesTool,
    createDirectory: createDirectoryTool,
    executeAux4: executeAux4CliTool,
    searchContext: createSearchContextTool(storage, embeddingsConfig)
  };
}

const Tools = {
  readFile: readLocalFileTool,
  writeFile: writeLocalFileTool,
  saveImage: saveImageTool,
  listFiles: listFilesTool,
  createDirectory: createDirectoryTool,
  executeAux4: executeAux4CliTool,
  searchContext: searchContextTool
};

export default Tools;
