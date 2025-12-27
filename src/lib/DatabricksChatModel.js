import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Detect the underlying model type from Databricks endpoint
 */
async function detectModelType(host, model, apiKey) {
  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/api/2.0/serving-endpoints/${model}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      console.warn(`Could not detect model type: ${response.status} ${response.statusText}`);
      return "openai"; // Default fallback
    }

    const data = await response.json();

    if (data.endpoint_type === "FOUNDATION_MODEL") {
      const modelClass = data.config?.served_entities?.[0]?.foundation_model?.model_class;
      return modelClass?.toLowerCase() || "openai";
    } else if (data.endpoint_type === "EXTERNAL_MODEL") {
      const provider = data.config?.served_entities?.[0]?.provider;
      return provider?.toLowerCase() || "openai";
    }

    return "openai"; // Default fallback
  } catch (error) {
    console.warn(`Warning: Could not detect model type for ${model}:`, error.message);
    return "openai"; // Default fallback
  }
}

/**
 * Map detected model types to LangChain classes
 */
function getModelClass(modelType) {
  const typeMapping = {
    'openai': ChatOpenAI,
    'gpt': ChatOpenAI,
    'claude': ChatAnthropic,
    'anthropic': ChatAnthropic,
    // Add more mappings as needed
  };

  return typeMapping[modelType] || ChatOpenAI; // Default to ChatOpenAI
}

/**
 * Factory function to create the appropriate chat model for Databricks endpoints.
 * Detects the underlying model type and returns the proper LangChain class.
 *
 * Configuration:
 * - host: Databricks workspace host URL
 * - model: Model serving endpoint name
 * - apiKey: Databricks API key
 * - temperature: (optional) Sampling temperature
 * - maxTokens: (optional) Maximum tokens to generate
 */
export async function createDatabricksChat(config = {}) {
  const host = config.host || process.env.DATABRICKS_HOST;
  const model = config.model || config.endpoint;
  const apiKey = config.apiKey || process.env.DATABRICKS_API_KEY;

  // Validate required fields
  if (!host) {
    throw new Error("Databricks host is required. Set host in config or DATABRICKS_HOST environment variable.");
  }
  if (!model) {
    throw new Error("Databricks model/endpoint is required. Set model in config.");
  }
  if (!apiKey) {
    throw new Error("Databricks API key is required. Set apiKey in config or DATABRICKS_API_KEY environment variable.");
  }

  // Detect the model type
  const modelType = await detectModelType(host, model, apiKey);
  const ModelClass = getModelClass(modelType);

  console.log(`Detected Databricks model type: ${modelType}, using ${ModelClass.name}`);

  // Create and configure the appropriate model
  const chatModel = new ModelClass({
    ...config,
    model,
    apiKey,
    configuration: {
      baseURL: `${host.replace(/\/$/, '')}/serving-endpoints/${model}/invocations`,
      ...config.configuration
    }
  });

  // Add a property to identify this as a Databricks model
  Object.defineProperty(chatModel, '_llmType', {
    value: () => "databricks",
    writable: false
  });

  return chatModel;
}

/**
 * Backwards-compatible class wrapper for the factory function.
 * Note: This requires async initialization, use createDatabricksChat() for new code.
 */
export class ChatDatabricks {
  constructor(config = {}) {
    this.config = config;
    this._model = null;
  }

  async _ensureModel() {
    if (!this._model) {
      this._model = await createDatabricksChat(this.config);
    }
    return this._model;
  }

  async bindTools(tools, kwargs) {
    const model = await this._ensureModel();
    return model.bindTools(tools, kwargs);
  }

  async invoke(input, options) {
    const model = await this._ensureModel();
    return model.invoke(input, options);
  }

  async _generate(messages, options, runManager) {
    const model = await this._ensureModel();
    return model._generate(messages, options, runManager);
  }

  _llmType() {
    return "databricks";
  }
}