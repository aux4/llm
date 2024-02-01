const { OpenAIEmbeddings } = require("@langchain/openai");
const { BedrockEmbeddings } = require("@langchain/community/embeddings/bedrock");

const EMBEDDINGS = {
  openai: OpenAIEmbeddings,
  bedrock: BedrockEmbeddings
};

function getEmbeddings(type) {
  const embeddings = EMBEDDINGS[type];

  if (!embeddings) {
    throw new Error(`Unknown embeddings type: ${type}`);
  }

  return embeddings;
}

module.exports = { getEmbeddings };
