import fs from "fs";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import { getDocLoader } from "./DocLoaders.js";
import { getDocSplitter } from "./DocSplitters.js";

export default class LlmStore {
  constructor(directory, embeddings) {
    this.directory = directory;
    this.embeddings = embeddings;

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

    const splitter = getDocSplitter(type);
    const chunks = await splitter.splitDocuments(doc);

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
