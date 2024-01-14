const { OpenAIEmbeddings } = require("@langchain/openai");

const EMBEDDINGS = {
  openai: OpenAIEmbeddings,
};

function getEmbeddings(type) {
  const embeddings = EMBEDDINGS[type];

  if (!embeddings) {
    throw new Error(`Unknown embeddings type: ${type}`);
  }

  return embeddings;
}

module.exports = { getEmbeddings };
