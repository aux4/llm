import { ChatOpenAI } from "@langchain/openai";
import { ChatXAI } from "@langchain/xai";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatBedrockConverse } from "@langchain/aws";
import { ChatGroq } from "@langchain/groq";
import { ChatMistralAI } from "@langchain/mistralai";
import { ChatVertexAI } from "@langchain/google-vertexai";
import { ChatCohere } from "@langchain/cohere";
import { ChatOllama } from "@langchain/ollama";

const MODELS = {
  anthropic: ChatAnthropic,
  bedrock: ChatBedrockConverse,
  cohere: ChatCohere,
  gemini: ChatGoogleGenerativeAI,
  groq: ChatGroq,
  mistral: ChatMistralAI,
  ollama: ChatOllama,
  openai: ChatOpenAI,
  vertex: ChatVertexAI,
  xai: ChatXAI
};

export function getModel(type) {
  const model = MODELS[type];

  if (!model) {
    throw new Error(`Unknown model type: ${type}`);
  }

  return model;
}
