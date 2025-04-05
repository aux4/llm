import LlmStore from "../../lib/LlmStore.js";
import { getEmbeddings } from "../../lib/Embeddings.js";

export async function searchExecutor(params) {
  const storage = params.storage;
  const query = params.query;
  const format = params.format;
  const results = parseInt(params.results);
  const embeddingsConfig = params.embeddings;

  const type = embeddingsConfig ? embeddingsConfig.type || "openai" : "openai";
  const config = embeddingsConfig ? embeddingsConfig.config : {};
  const Embeddings = getEmbeddings(type);
  const embeddings = new Embeddings(config);

  const store = new LlmStore(storage, embeddings);
  await store.load();
  
  const result = await store.search(query, results);

  if (format === "json") {
    console.log(result);
  } else {
    const text = result.map(item => item.pageContent).join("\n");
    console.log(text); 
  }
}
