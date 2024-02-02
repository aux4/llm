const { Printer } = require("@aux4/engine");
const LlmStore = require("../../lib/LlmStore");
const { getEmbeddings } = require("../../lib/Embeddings");

const out = Printer.on(process.stdout);

async function searchExecutor(params) {
  const storage = await params.storage;
  const query = await params.query;
  const format = await params.format;
  const results = parseInt(await params.results);
  const embeddingsConfig = await params.embeddings;

  const type = embeddingsConfig ? embeddingsConfig.type : "openai";
  const config = embeddingsConfig ? embeddingsConfig.config : {};
  const Embeddings = getEmbeddings(type);
  const embeddings = new Embeddings(config);

  const store = new LlmStore(storage, embeddings);
  await store.load();
  
  const result = await store.search(query, results);

  if (format === "json") {
    out.println(result);
  } else {
    const text = result.map(item => item.pageContent).join("\n");
    out.println(text); 
  }
}

module.exports = { searchExecutor };
