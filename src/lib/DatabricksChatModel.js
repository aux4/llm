import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Dynamic Databricks chat model that detects the underlying model type
 * and routes to the appropriate LangChain implementation.
 *
 * Configuration:
 * - host: Databricks workspace host URL
 * - model: Model serving endpoint name
 * - apiKey: Databricks API key
 * - temperature: (optional) Sampling temperature
 * - maxTokens: (optional) Maximum tokens to generate
 */
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
      throw new Error(`Failed to detect model type: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (data.endpoint_type === "FOUNDATION_MODEL") {
      const modelClass = data.config?.served_entities?.[0]?.foundation_model?.model_class;
      return modelClass?.toLowerCase() || "unknown";
    } else if (data.endpoint_type === "EXTERNAL_MODEL") {
      const provider = data.config?.served_entities?.[0]?.provider;
      return provider?.toLowerCase() || "unknown";
    }

    return "unknown";
  } catch (error) {
    console.warn(`Warning: Could not detect model type for ${model}:`, error.message);
    return "unknown";
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
    // 'llama': ChatLlama,  // When available
    // 'mistral': ChatMistral,  // When available
  };

  return typeMapping[modelType] || ChatOpenAI; // Default to ChatOpenAI for unknown types
}

export class ChatDatabricks {
  constructor(fields = {}) {
    this.host = fields.host || process.env.DATABRICKS_HOST;
    this.model = fields.model || fields.endpoint;
    this.apiKey = fields.apiKey || process.env.DATABRICKS_API_KEY;
    this.fields = fields;

    // Validate required fields
    if (!this.host) {
      throw new Error("Databricks host is required. Set host in config or DATABRICKS_HOST environment variable.");
    }
    if (!this.model) {
      throw new Error("Databricks model/endpoint is required. Set model in config.");
    }
    if (!this.apiKey) {
      throw new Error("Databricks API key is required. Set apiKey in config or DATABRICKS_API_KEY environment variable.");
    }

    this._actualModel = null;
    this._modelDetected = false;
  }

  /**
   * Lazy initialization of the actual model based on detected type
   */
  async _getActualModel() {
    if (!this._modelDetected) {
      const modelType = await detectModelType(this.host, this.model, this.apiKey);
      const ModelClass = getModelClass(modelType);

      console.log(`Detected model type: ${modelType}, using ${ModelClass.name}`);

      // Configure the actual model with Databricks endpoint
      this._actualModel = new ModelClass({
        ...this.fields,
        apiKey: this.apiKey,
        model: this.model,
        configuration: {
          baseURL: `${this.host.replace(/\/$/, '')}/serving-endpoints/${this.model}/invocations`,
          ...this.fields.configuration
        }
      });

      this._modelDetected = true;
    }

    return this._actualModel;
  }

  /**
   * Delegate all method calls to the actual model
   */
  async bindTools(tools, kwargs) {
    const actualModel = await this._getActualModel();
    return actualModel.bindTools(tools, kwargs);
  }

  async _generate(messages, options, runManager) {
    const actualModel = await this._getActualModel();
    return actualModel._generate(messages, options, runManager);
  }

  async invoke(input, options) {
    const actualModel = await this._getActualModel();
    return actualModel.invoke(input, options);
  }

  async stream(input, options) {
    const actualModel = await this._getActualModel();
    return actualModel.stream(input, options);
  }

  withConfig(config) {
    const actualModel = this._actualModel;
    if (actualModel) {
      return actualModel.withConfig(config);
    }
    // If not yet initialized, create a new instance with merged config
    return new ChatDatabricks({
      ...this.fields,
      ...config
    });
  }

  _llmType() {
    return "databricks";
  }
}