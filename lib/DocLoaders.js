const { CSVLoader } = require("@langchain/community/document_loaders/fs/csv");
const { JSONLoader } = require("langchain/document_loaders/fs/json");
const { TextLoader } = require("langchain/document_loaders/fs/text");
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const { PPTXLoader } = require("@langchain/community/document_loaders/fs/pptx");
const { WebPDFLoader } = require("@langchain/community/document_loaders/web/pdf");

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
