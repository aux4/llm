import LlmStore from "../../lib/LlmStore.js";
import { getEmbeddings } from "../../lib/Embeddings.js";

export async function searchExecutor(params) {
  const storage = params.storage;
  const query = params.query;
  const format = params.format;
  const limit = params.limit;
  const source = params.source;
  const embeddingsConfig = params.embeddings;

  const type = embeddingsConfig ? embeddingsConfig.type || "openai" : "openai";
  const config = embeddingsConfig ? embeddingsConfig.config : {};
  const Embeddings = getEmbeddings(type);
  const embeddings = new Embeddings(config);

  const store = new LlmStore(storage, embeddings);
  await store.load();
  
  const searchOptions = {
    limit: limit,
    source: source
  };
  
  const result = await store.search(query, searchOptions);

  if (format === "json") {
    console.log(JSON.stringify(result));
  } else {
    const text = result.map(item => item.pageContent).join("\n\n");
    console.log(text); 
  }
}
