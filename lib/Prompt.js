const fs = require("fs");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { getModel } = require("./Models");
const { readFile, asJson } = require("./util/FileUtils");

const AI_PREFIX_REGEX = /^(AI|Robot)\:\s/;

class Prompt {
  constructor(config = {}) {
    this.config = config;
    this.messages = [];

    const Model = getModel(config.type || "openai");
    this.model = new Model(config.config);
  }

  async instructions(text) {
    if (!text) {
      return;
    }

    this.messages.push({
      role: "system",
      content: text
    });
  }

  async history(file) {
    if (!file || file === "") return;

    this.historyFile = file;
    this.messages = (await readFile(file).then(asJson())) || [];
  }

  async message(message, params, role = "user") {
    this.messages.push({
      role: role,
      content: message
    });

    const promptTemplate = ChatPromptTemplate.fromMessages(
      this.messages.map(message => [message.role, message.content])
    );

    const chain = promptTemplate.pipe(this.model);
    const response = await chain.invoke(params);
    const answer = response.trim().replace(AI_PREFIX_REGEX, "");
    this.messages.push({ role: "assistant", content: answer });

    if (this.historyFile) {
      fs.writeFileSync(this.historyFile, JSON.stringify(this.messages.filter(message => message.role !== "system")));
    }

    if (this.callback) {
      this.callback(answer);
    }
  }

  onMessage(callback) {
    this.callback = callback;
  }
}

module.exports = Prompt;
