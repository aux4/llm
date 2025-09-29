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

    const idsMap = await getIdsMap(this.directory);

    if (this.store && idsMap[docPath]) {
      try {
        await this.store.delete({ ids: idsMap[docPath] });
      } catch {
      } finally {
        delete idsMap[docPath];
        await saveIdsMap(this.directory, idsMap);
      }
    }

    const Loader = getDocLoader(type);
    const loader = new Loader(docPath);

    let doc;
    try {
      doc = await loader.load();
    } catch (error) {
      throw new Error(`Failed to load document ${docPath}: ${error.message}`);
    }

    if (!doc || doc.length === 0) {
      throw new Error(`No content could be extracted from document: ${docPath}. The file may be empty, corrupted, or in an unsupported format.`);
    }

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

    if (chunks.length === 0) {
      throw new Error(`Document was loaded but no text chunks could be created from: ${docPath}. The document may contain only images or unsupported content.`);
    }

    if (!this.store) {
      this.store = await FaissStore.fromDocuments(chunks, this.embeddings, { ids: chunkIds });
    } else {
      await this.store.addDocuments(chunks, { ids: chunkIds });
    }

    idsMap[docPath] = chunkIds;

    await saveIdsMap(this.directory, idsMap);
  }

  async search(query, options = {}) {
    if (!this.store) {
      throw new Error("No documents have been indexed yet. Please use 'aux4 ai agent learn <document>' to add documents to the vector store first.");
    }

    const { limit: rawLimit, source } = options;
    const limit = parseInt(rawLimit) || 1;

    if (source) {

      const docPath = path.resolve(source);
      let searchLimit = limit * 2;

      const idsMap = await getIdsMap(this.directory);
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
    if (this.store) {
      await this.store.save(this.directory);
    }
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
      idsMap = JSON.parse(fs.readFileSync(idsFilePath, "utf8"));
    } catch {
      idsMap = {};
    }
  }

  return idsMap;
}

async function saveIdsMap(directory, idsMap) {
  const idsFilePath = `${directory}/ids.json`;

  try {
    fs.writeFileSync(idsFilePath, JSON.stringify(idsMap), "utf8");
  } catch (e) {
    console.error("Error saving ids:", `${directory}/.ids.json`, e.message);
  }
}
