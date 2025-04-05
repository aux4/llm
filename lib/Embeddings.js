import { BedrockEmbeddings } from "@langchain/aws";
import { CohereEmbeddings } from "@langchain/cohere";
import { VertexAIEmbeddings } from "@langchain/google-vertexai";
import { MistralAIEmbeddings } from "@langchain/mistralai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { OpenAIEmbeddings } from "@langchain/openai";

const EMBEDDINGS = {
  openai: OpenAIEmbeddings,
  bedrock: BedrockEmbeddings,
  cohere: CohereEmbeddings,
  mistral: MistralAIEmbeddings,
  ollama: OllamaEmbeddings,
  vertex: VertexAIEmbeddings
};

export function getEmbeddings(type) {
  const embeddings = EMBEDDINGS[type];

  if (!embeddings) {
    throw new Error(`Unknown embeddings type: ${type}`);
  }

  return embeddings;
}
