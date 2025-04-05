import { CSVLoader } from "@langchain/community/document_loaders/fs/csv";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";

const FS_LOADERS = {
  csv: CSVLoader,
  json: JSONLoader,
  txt: TextLoader,
  pdf: PDFLoader,
  docx: DocxLoader,
  pptx: PPTXLoader
};

export function getDocLoader(type) {
  const loader = FS_LOADERS[type?.toLowerCase()];

  if (!loader) {
    return FS_LOADERS.txt;
  }

  return loader;
}
