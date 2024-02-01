const { OpenAI } = require("@langchain/openai");
const { Bedrock } = require("@langchain/community/llms/bedrock");

const MODELS = {
  openai: OpenAI,
  bedrock: Bedrock
};

function getModel(type) {
  const model = MODELS[type];

  if (!model) {
    throw new Error(`Unknown model type: ${type}`);
  }

  return model;
}

module.exports = { getModel };
