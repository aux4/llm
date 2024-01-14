const LlmStore = require("../../lib/LlmStore");
const { getEmbeddings } = require("../../lib/Embeddings");

async function addDocumentExecutor(params) {
  const storage = await params.storage;
  const embeddingsType = await params.embeddings;
  const doc = await params.doc;
  const type = await params.type;

  const Embeddings = getEmbeddings(embeddingsType);
  const embeddings = new Embeddings();

  const store = new LlmStore(storage, embeddings);
  await store.load();
  await store.addDocument(doc, type);
  await store.save();
}

module.exports = { addDocumentExecutor };
