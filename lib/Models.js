const { OpenAI } = require("@langchain/openai");
const { BedrockChat } = require("@langchain/community/chat_models/bedrock");

const MODELS = {
  openai: OpenAI,
  bedrock: BedrockChat
};

function getModel(type) {
  const model = MODELS[type];

  if (!model) {
    throw new Error(`Unknown model type: ${type}`);
  }

  return model;
}

module.exports = { getModel };
