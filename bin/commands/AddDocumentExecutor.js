const LlmStore = require("../../lib/LlmStore");
const { getEmbeddings } = require("../../lib/Embeddings");

async function addDocumentExecutor(params) {
  const storage = await params.storage;
  const doc = await params.doc;
  const docType = await params.type;
  const embeddingsConfig = await params.embeddings;

  const type = embeddingsConfig ? embeddingsConfig.type : "openai";
  const config = embeddingsConfig ? embeddingsConfig.config : {};
  const Embeddings = getEmbeddings(type);
  const embeddings = new Embeddings(config);

  const store = new LlmStore(storage, embeddings);
  await store.load();
  await store.addDocument(doc, docType);
  await store.save();
}

module.exports = { addDocumentExecutor };
