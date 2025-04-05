import fs from "fs";
import path from "path";
import { StructuredOutputParser } from "langchain/output_parsers";
import { SystemMessage, HumanMessage, AIMessage } from "@langchain/core/messages";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { getModel } from "./Models.js";
import { readFile, asJson } from "./util/FileUtils.js";
import mime from "mime-types";

const VARIABLE_REGEX = /\{([a-zA-Z0-9-_]+)\}/g;

class Prompt {
  constructor(config = {}) {
    this.config = config;
    this.messages = [];

    const Model = getModel(config.type || "openai");
    this.model = new Model(config.config);
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

  async tools(tools) {
    if (!tools) {
      return;
    }
    this.model.bindTools(tools);
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
        } else if (message.role === "assistant") {
          return new AIMessage({ content });
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
      const response = await chain.invoke();
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

      if (this.callback) {
        this.callback(`${answer}`);
      }
    } catch (e) {
      console.error(e.message);
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
