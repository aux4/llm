import path from "path";
import LlmStore from "../../lib/LlmStore.js";
import { getEmbeddings } from "../../lib/Embeddings.js";

export async function addDocumentExecutor(params) {
  const storage = params.storage;
  const doc = params.doc;
  const docType = params.type;
  const embeddingsConfig = params.embeddings;

  const type = embeddingsConfig ? embeddingsConfig.type || "openai" : "openai";
  const config = embeddingsConfig ? embeddingsConfig.config : {};
  const Embeddings = getEmbeddings(type);
  const embeddings = new Embeddings(config);

  const store = new LlmStore(storage, embeddings);
  await store.load();
  await store.addDocument(path.resolve(doc), docType);
  await store.save();
}
