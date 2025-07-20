import fs from "fs";
import path from "path";
import { z } from "zod";
import { tool } from "@langchain/core/tools";

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
      "Execute aux4 command-line tool. It will execute `aux4 <command with args and variables>`. If command is empty it will show all commands available.",
    schema: z.object({
      command: z.string()
    })
  }
);

const Tools = {
  readFile: readLocalFileTool,
  writeFile: writeLocalFileTool,
  listFiles: listFilesTool,
  createDirectory: createDirectoryTool,
  executeAux4: executeAux4CliTool
};

export default Tools;
