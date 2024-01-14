const { CSVLoader } = require("langchain/document_loaders/fs/csv");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { PDFLoader } = require("langchain/document_loaders/fs/pdf");
const { DocxLoader } = require("langchain/document_loaders/fs/docx");
const { PPTXLoader } = require("langchain/document_loaders/fs/pptx");

const FS_LOADERS = {
  csv: CSVLoader,
  json: JSONLoader,
  txt: TextLoader,
  pdf: PDFLoader,
  docx: DocxLoader,
  pptx: PPTXLoader
};

function getLoader(loaders, type) {
  const loader = loaders[type];

  if (!loader) {
    throw new Error(`Unknown document loader type: ${type}`);
  }

  return loader;
}

function getDocLoader(type) {
  return getLoader(FS_LOADERS, type);
}

module.exports = { getDocLoader };
