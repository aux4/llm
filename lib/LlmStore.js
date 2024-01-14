const fs = require("fs");
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
const { RecursiveCharacterTextSplitter } = require("langchain/text_splitter");
const { getDocLoader } = require("./DocLoaders");

class LlmStore {
  constructor(directory, embeddings) {
    this.directory = directory;
    this.embeddings = embeddings;
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 0
    });

    if (!fs.existsSync(directory)) {
      fs.mkdirSync(directory, { recursive: true });
    }
  }

  async load() {
    if (!fs.existsSync(`${this.directory}/docstore.json`)) {
      return;
    }
    this.store = await FaissStore.load(this.directory, this.embeddings);
  }

  async addDocument(path, type) {
    if (!type) {
      type = path.split(".").pop();
    }

    const Loader = getDocLoader(type);
    const loader = new Loader(path);
    const doc = await loader.load();

    const chunks = await this.splitter.splitDocuments(doc);

    if (!this.store) {
      this.store = await FaissStore.fromDocuments(chunks, this.embeddings);
    } else {
      await this.store.addDocuments(chunks);
    }
  }

  async search(query, results) {
    return await this.store.similaritySearch(query, results);
  }

  async save() {
    await this.store.save(this.directory);
  }

  asRetriever() {
    return this.store.asRetriever();
  }
}

module.exports = LlmStore;
