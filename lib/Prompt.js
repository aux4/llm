const fs = require("fs");
const { StructuredOutputParser } = require("langchain/output_parsers");
const { SystemMessage, HumanMessage, AIMessage } = require("@langchain/core/messages");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { getModel } = require("./Models");
const { readFile, asJson } = require("./util/FileUtils");

const AI_PREFIX_REGEX = /^(AI|Robot|Bot)\:\s/;
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

  async history(file) {
    if (!file || file === "") return;

    this.historyFile = file;
    this.messages = (await readFile(file).then(asJson())) || [];
  }

  setOutputSchema(schema) {
    this.outputSchema = schema;
  }

  async message(text, params, role = "user") {
    const message = await replacePromptVariables(text, params);

    this.messages.push({
      role: role,
      content: message
    });

    const promptTemplate = ChatPromptTemplate.fromMessages(
      this.messages.map(message => {
        if (message.role === "system") {
          return new SystemMessage(message.content);
        } else if (message.role === "assistant") {
          return new AIMessage(message.content);
        }
        return new HumanMessage(message.content);
      })
    );


    let chain = promptTemplate.pipe(this.model);

    if (this.outputSchema) {
      const parser = StructuredOutputParser.fromNamesAndDescriptions(this.outputSchema);
      chain = chain.pipe(parser); 
    }

    const response = await chain.invoke();
    const answer = typeof response === "string" ? response : JSON.stringify(response);
    this.messages.push({ role: "assistant", content: answer });

    if (this.historyFile) {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.messages.filter(message => message.role !== "system")));
    }

    if (this.callback) {
      this.callback(`${answer}`);
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

module.exports = Prompt;
