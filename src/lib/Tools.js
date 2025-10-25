import fs from "fs";
import path from "path";
import os from "os";
import { z } from "zod";
import { tool } from "@langchain/core/tools";
import LlmStore from "./LlmStore.js";
import { getEmbeddings } from "./Embeddings.js";

// Import tool descriptions
import readFileDesc from "../docs/tools/readFile.md?raw";
import writeFileDesc from "../docs/tools/writeFile.md?raw";
import listFilesDesc from "../docs/tools/listFiles.md?raw";
import createDirectoryDesc from "../docs/tools/createDirectory.md?raw";
import executeAux4Desc from "../docs/tools/executeAux4.md?raw";
import saveImageDesc from "../docs/tools/saveImage.md?raw";
import removeFilesDesc from "../docs/tools/removeFiles.md?raw";
import searchContextDesc from "../docs/tools/searchContext.md?raw";

// Array to track files and directories created by the agent
const createdPaths = [];

// Helper function to expand ~ to home directory
function expandTildePath(filePath) {
  if (filePath.startsWith("~/") || filePath === "~") {
    return filePath.replace("~", os.homedir());
  }
  return filePath;
}

// Helper function to check if path is allowed for read-only access
function isReadOnlyPathAllowed(filePath, currentDirectory) {
  const aux4ConfigPath = path.join(os.homedir(), ".aux4.config", "packages");
  return filePath.startsWith(currentDirectory) || filePath.startsWith(aux4ConfigPath);
}

export const readLocalFileTool = tool(
  async ({ file }) => {
    try {
      const expandedPath = expandTildePath(file);
      const filePath = path.resolve(expandedPath);
      const currentDirectory = process.cwd();
      if (!isReadOnlyPathAllowed(filePath, currentDirectory)) throw new Error("Access denied");
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
    description: readFileDesc,
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

      // Check if file already exists
      const fileExists = fs.existsSync(filePath);

      fs.writeFileSync(filePath, content, { encoding: "utf-8" });

      // Track the created file only if it's new
      if (!fileExists) {
        createdPaths.push(filePath);
      }

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
    description: writeFileDesc,
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

      const expandedPath = expandTildePath(targetPath || currentDirectory);
      const directory = path.resolve(expandedPath);
      const recurse = recursive !== false && recursive !== "false";
      const excludePrefixes = (exclude && exclude.split(",")) || [];
      if (!isReadOnlyPathAllowed(directory, currentDirectory)) throw new Error("Access denied");

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
    description: listFilesDesc,
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

    // Track the created directory
    createdPaths.push(directory);

    return "directory created";
  },
  {
    name: "createDirectory",
    description: createDirectoryDesc,
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
    description: executeAux4Desc,
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

      // Check if file already exists
      const fileExists = fs.existsSync(filePath);

      fs.writeFileSync(filePath, buffer);

      // Track the created file only if it's new
      if (!fileExists) {
        createdPaths.push(filePath);
      }

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
    description: saveImageDesc,
    schema: z.object({
      imageName: z.string(),
      content: z.string()
    })
  }
);

export const removeFilesTool = tool(
  async ({ files }) => {
    try {
      const currentDirectory = process.cwd();
      const results = [];
      const filesToRemove = Array.isArray(files) ? files : [files];

      for (const file of filesToRemove) {
        const filePath = path.resolve(file);

        // Security check - only allow removal within current directory
        if (!filePath.startsWith(currentDirectory)) {
          results.push(`${file}: Access denied - path outside current directory`);
          continue;
        }

        // Safety check - only allow removal of files/directories created by the agent
        if (!createdPaths.includes(filePath)) {
          results.push(`${file}: You can just delete files previously created by the agent`);
          continue;
        }

        // Check if file/directory exists
        if (!fs.existsSync(filePath)) {
          results.push(`${file}: File or directory not found`);
          // Remove from tracking even if it doesn't exist
          const index = createdPaths.indexOf(filePath);
          if (index > -1) {
            createdPaths.splice(index, 1);
          }
          continue;
        }

        try {
          const stats = fs.statSync(filePath);
          if (stats.isDirectory()) {
            fs.rmSync(filePath, { recursive: true, force: true });
            results.push(`${file}: Directory removed successfully`);
          } else {
            fs.unlinkSync(filePath);
            results.push(`${file}: File removed successfully`);
          }

          // Remove from tracking array
          const index = createdPaths.indexOf(filePath);
          if (index > -1) {
            createdPaths.splice(index, 1);
          }
        } catch (removeError) {
          results.push(`${file}: Error removing - ${removeError.message}`);
        }
      }

      return results.join("\n");
    } catch (e) {
      return `Error: ${e.message}`;
    }
  },
  {
    name: "removeFiles",
    description: removeFilesDesc,
    schema: z.object({
      files: z.union([z.string(), z.array(z.string())]).describe("File or directory path(s) to remove. Can be a single string or array of strings.")
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
    description: searchContextDesc,
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
    removeFiles: removeFilesTool,
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
  removeFiles: removeFilesTool,
  executeAux4: executeAux4CliTool,
  searchContext: searchContextTool
};

export default Tools;
