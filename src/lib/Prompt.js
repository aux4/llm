import fs from "node:fs";
import path from "node:path";
import { StructuredOutputParser } from "langchain/output_parsers";
import { SystemMessage, HumanMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getModel } from "./Models.js";
import { readFile, asJson } from "./util/FileUtils.js";
import mime from "mime-types";
import Tools from "./Tools.js";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

const VARIABLE_REGEX = /\{([a-zA-Z0-9-_]+)\}/g;

class Prompt {
  constructor(config = {}) {
    this.config = config;
    this.messages = [];
    this.mcpClient = null;

    const Model = getModel(config.type || "openai");
    this.model = new Model(config.config);
  }

  async init() {
    const mcpConfigPath = path.join(process.cwd(), "mcp.json");
    if (!fs.existsSync(mcpConfigPath)) {
      this.model = this.model.bindTools(Object.values(Tools));
      this.tools = Tools;
      return;
    }

    try {
      const mcpConfig = JSON.parse(fs.readFileSync(mcpConfigPath, "utf-8"));

      this.mcpClient = new MultiServerMCPClient({
        ...mcpConfig
      });

      const mcpTools = await this.mcpClient.getTools();
      this.model = this.model.bindTools(mcpTools);

      this.tools = mcpTools.reduce((acc, tool) => {
        acc[tool.name] = tool;
        return acc;
      }, {});
    } catch (e) {
      console.error("Error reading mcp.json:", e.message);
      this.model = this.model.bindTools(Object.values(Tools));
      this.tools = Tools;
    }
  }

  async instructions(text, params) {
    if (!text) {
      return;
    }

    const message = await replacePromptVariables(text, params);

    this.messages.push({
      role: "system",
      content: message
    });
  }

  async history(file) {
    if (!file || file === "") return;

    this.historyFile = file;
    const historyMessages = (await readFile(file).then(asJson())) || [];
    this.messages = this.messages.concat(historyMessages);
  }

  setOutputSchema(schema) {
    this.outputSchema = schema;
  }

  async message(text, params, role = "user") {
    const messageContent = await replacePromptVariables(text, params);

    const message = {
      role: role,
      content: messageContent
    };

    if (params.image) {
      message.images = params.image
        .split(",")
        .map(imagePath => imagePath.trim())
        .filter(imagePath => imagePath !== "")
        .map(imagePath => path.resolve(imagePath.trim()))
        .map(image => {
          if (!fs.existsSync(image)) {
            throw new Error(`Image file not found: ${image}`);
          }

          const mimeType = mime.lookup(image);
          if (!mimeType) {
            throw new Error(`Unsupported image type: ${image}`);
          }

          const imageBuffer = fs.readFileSync(image);
          const base64Image = imageBuffer.toString("base64");

          return { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } };
        });
    }

    this.messages.push(message);

    const answer = await this.execute();

    if (this.callback) {
      this.callback(`${answer}`);
    }
  }

  async execute() {
    const promptTemplate = ChatPromptTemplate.fromMessages(
      this.messages.map(message => {
        const content = [];

        if (message.content) {
          content.push({ type: "text", text: message.content });
        }

        if (message.images) {
          message.images.forEach(image => {
            content.push(image);
          });
        }

        if (message.role === "system") {
          return new SystemMessage({ content });
        } else if (message.role === "assistant_with_tool") {
          return new AIMessage({ ...message.content });
        } else if (message.role === "assistant") {
          return new AIMessage({ content });
        } else if (message.role === "tool") {
          return new ToolMessage({ ...message.content });
        }
        return new HumanMessage({ content });
      })
    );

    let chain = promptTemplate.pipe(this.model);

    if (this.outputSchema) {
      const parser = StructuredOutputParser.fromNamesAndDescriptions(this.outputSchema);
      chain = chain.pipe(parser);
    }

    try {
      let response = await chain.invoke();

      if (response.tool_calls && response.tool_calls.length > 0) {
        this.messages.push({ role: "assistant_with_tool", content: response });

        for (const toolCall of response.tool_calls) {
          const tool = this.tools[toolCall.name];
          const toolResponse = await tool.invoke(toolCall);

          this.messages.push({ role: "tool", content: toolResponse });
        }

        return await this.execute();
      }

      const answer =
        typeof response === "string"
          ? response
          : typeof response.content === "string"
            ? response.content
            : JSON.stringify(response);
      this.messages.push({ role: "assistant", content: answer });

      if (this.historyFile) {
        fs.writeFileSync(this.historyFile, JSON.stringify(this.messages.filter(message => message.role !== "system")));
      }

      return answer;
    } catch (e) {
      return e.message;
    } finally {
      // Close MCP client if it exists to properly clean up resources
      if (this.mcpClient) {
        await this.mcpClient.close();
        this.mcpClient = null;
      }
    }
  }

  onMessage(callback) {
    this.callback = callback;
  }
}

async function replacePromptVariables(text, params) {
  const variables = text.match(VARIABLE_REGEX);
  const variableValues = (variables || [])
    .map(variable => variable.substring(1, variable.length - 1))
    .reduce((acc, variable) => ({ ...acc, [variable]: undefined }), {});

  for (const variable in variableValues) {
    variableValues[variable] = await params[variable];
  }

  let output = text;
  for (const variable in variableValues) {
    const value = variableValues[variable];
    if (value === undefined) {
      continue;
    }
    output = output.replaceAll(`{${variable}}`, variableValues[variable]);
  }

  return output;
}

export default Prompt;
