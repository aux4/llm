import { RecursiveCharacterTextSplitter, SupportedTextSplitterLanguages } from "@langchain/textsplitters";

const DEFAULT_SPLITTER = new RecursiveCharacterTextSplitter({
  chunkSize: 256,
  chunkOverlap: 64
});

export function getDocSplitter(type) {
  const standardizedType = toStandardizedType(type);
  const isSupported = SupportedTextSplitterLanguages.includes(standardizedType);
  if (isSupported) {
    return RecursiveCharacterTextSplitter.fromLanguage(standardizedType, {
      chunkSize: 512,
      chunkOverlap: 32
    });
  }
  return DEFAULT_SPLITTER;
}

function toStandardizedType(type) {
  const typeMap = {
    cpp: "cpp",
    hpp: "cpp",
    h: "cpp",
    go: "go",
    java: "java",
    js: "js",
    javascript: "js",
    php: "php",
    proto: "proto",
    python: "python",
    py: "python",
    rst: "rst",
    rb: "ruby",
    ruby: "ruby",
    rs: "rust",
    rust: "rust",
    scala: "scala",
    swift: "swift",
    md: "markdown",
    markdown: "markdown",
    tex: "latex",
    html: "html",
    htm: "html",
    sol: "sol"
  };
  return typeMap[type?.toLowerCase()] || type;
}
