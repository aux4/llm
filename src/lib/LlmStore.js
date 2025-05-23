import fs from "fs";
import path from "path";
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

  async addDocument(docPath, type) {
    if (!type) {
      type = docPath.split(".").pop();
    }

    const idsMap = getIdsMap(this.directory);

    if (this.store && idsMap[docPath]) {
      try {
        await this.store.delete({ ids: idsMap[docPath] });
      } catch (e) {
      } finally {
        delete idsMap[docPath];
        await saveIdsMap(this.directory, idsMap);
      }
    }

    const Loader = getDocLoader(type);
    const loader = new Loader(docPath);
    const doc = await loader.load();

    doc.forEach(document => {
      document.metadata.source = docPath;
    });

    const splitter = getDocSplitter(type);
    const chunks = await splitter.splitDocuments(doc);

    const chunkIds = [];
    chunks.forEach(chunk => {
      chunk.metadata.source = docPath;
    });

    for (let i = 0; i < chunks.length; i++) {
      chunkIds.push(`${docPath}-${Date.now()}-chunk-${i}`);
    }

    if (!this.store) {
      this.store = await FaissStore.fromDocuments([], this.embeddings);
    }

    await this.store.addDocuments(chunks, { ids: chunkIds });

    idsMap[docPath] = chunkIds;

    await saveIdsMap(this.directory, idsMap);
  }

  async search(query, options = {}) {
    const { limit: rawLimit, source } = options;
    const limit = parseInt(rawLimit) || 1;

    if (source) {

      const docPath = path.resolve(source);
      let searchLimit = limit * 2;

      const idsMap = getIdsMap(this.directory);
      const ids = idsMap[docPath];
      if (ids && ids.length < searchLimit) {
        searchLimit = ids.length;
      }

      const results = await this.store.similaritySearch(query, searchLimit);

      const filteredResults = results.filter(doc =>
        doc.metadata && doc.metadata.source === docPath
      ).slice(0, limit);

      return filteredResults;
    }

    return await this.store.similaritySearch(query, limit);
  }

  async save() {
    await this.store.save(this.directory);
  }

  asRetriever() {
    return this.store.asRetriever();
  }
}

async function getIdsMap(directory) {
  const idsFilePath = `${directory}/ids.json`;
  let idsMap = {};

  if (fs.existsSync(idsFilePath)) {
    try {
      idsMap = JSON.parse(fs.readFileSync(idsFilePath, 'utf8'));
    } catch (e) {
      idsMap = {};
    }
  }

  return idsMap;
}

async function saveIdsMap(directory, idsMap) {
  const idsFilePath = `${directory}/ids.json`;

  try {
    fs.writeFileSync(idsFilePath, JSON.stringify(idsMap), 'utf8');
  } catch (e) {
    console.error("Error saving ids:", `${directory}/.ids.json`, e.message);
  }
}
