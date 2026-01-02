import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

/**
 * Chat model for Databricks serving endpoints.
 * Uses strategy pattern to delegate to appropriate LangChain model based on endpoint type.
 *
 * Supported model providers:
 * - OpenAI (GPT models)
 * - Anthropic (Claude models)
 * - Meta (Llama models)
 * - xAI (Grok models)
 *
 * Configuration:
 * - host: Databricks workspace host URL
 * - model: Model serving endpoint name
 * - apiKey: Databricks API key
 * - temperature: (optional) Sampling temperature
 * - maxTokens: (optional) Maximum tokens to generate
 */
export class ChatDatabricks extends BaseChatModel {
  constructor(fields = {}) {
    super(fields);

    this.host = fields.host || process.env.DATABRICKS_HOST;
    this.model = fields.model || fields.endpoint;
    this.apiKey = fields.apiKey || process.env.DATABRICKS_API_KEY;
    this.temperature = fields.temperature ?? 0.1;
    this.maxTokens = fields.maxTokens ?? 512;

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

    // Build the endpoint URL (model is part of the path, not request body)
    this.baseURL = `${this.host.replace(/\/$/, '')}/serving-endpoints/${this.model}/invocations`;

    // Delegate model will be initialized asynchronously
    this.delegateModel = null;
    this.initialized = false;
  }

  _llmType() {
    return "databricks";
  }

  /**
   * Initialize the delegate model by detecting the endpoint type
   */
  async _initializeDelegate() {
    if (this.initialized) {
      return;
    }

    try {
      const metadataURL = `${this.host.replace(/\/$/, '')}/api/2.0/serving-endpoints/${this.model}`;
      const response = await fetch(metadataURL, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        // Fallback to OpenAI if metadata fetch fails
        this._createOpenAIDelegate();
        return;
      }

      const metadata = await response.json();
      const modelProvider = this._detectModelProvider(metadata);

      switch (modelProvider) {
        case 'anthropic':
        case 'claude':
          this._createAnthropicDelegate();
          break;
        case 'llama':
        case 'meta':
          this._createLlamaDelegate();
          break;
        case 'xai':
        case 'grok':
          this._createXAIDelegate();
          break;
        case 'openai':
        default:
          this._createOpenAIDelegate();
          break;
      }

    } catch (error) {
      // Fallback to OpenAI if detection fails
      this._createOpenAIDelegate();
    }

    this.initialized = true;
  }

  /**
   * Detect model provider from Databricks endpoint metadata
   */
  _detectModelProvider(metadata) {
    if (metadata.endpoint_type === "FOUNDATION_MODEL") {
      const modelClass = metadata.config?.served_entities?.[0]?.foundation_model?.model_class;
      if (modelClass) {
        return modelClass.toLowerCase();
      }
    } else if (metadata.endpoint_type === "EXTERNAL_MODEL") {
      const provider = metadata.config?.served_entities?.[0]?.provider;
      if (provider) {
        return provider.toLowerCase();
      }
    }

    // Fallback: analyze model name
    const modelName = this.model.toLowerCase();
    if (modelName.includes('claude') || modelName.includes('anthropic')) {
      return 'anthropic';
    } else if (modelName.includes('llama') || modelName.includes('meta')) {
      return 'llama';
    } else if (modelName.includes('grok') || modelName.includes('xai')) {
      return 'xai';
    }

    return 'openai'; // Default fallback
  }

  /**
   * Create OpenAI delegate model
   */
  _createOpenAIDelegate() {
    this.delegateModel = new ChatOpenAI({
      model: "gpt-3.5-turbo", // Dummy model name, gets overridden by baseURL
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Create Anthropic delegate model
   */
  _createAnthropicDelegate() {
    this.delegateModel = new ChatAnthropic({
      model: "claude-3-sonnet-20240229", // Dummy model name, gets overridden by baseURL
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Create Llama delegate model (uses OpenAI-compatible interface)
   */
  _createLlamaDelegate() {
    this.delegateModel = new ChatOpenAI({
      model: "llama-3.1-8b", // Dummy model name, gets overridden by baseURL
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Create xAI/Grok delegate model (uses OpenAI-compatible interface)
   */
  _createXAIDelegate() {
    this.delegateModel = new ChatOpenAI({
      model: "grok-beta", // Dummy model name, gets overridden by baseURL
      apiKey: this.apiKey,
      baseURL: this.baseURL,
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });
  }

  /**
   * Bind tools using delegate model's tool binding
   */
  bindTools(tools, kwargs = {}) {
    // Store tools for later binding to delegate
    this._pendingTools = tools;
    this._pendingToolsKwargs = kwargs;

    // Return this instance for method chaining
    return this;
  }

  /**
   * Main generation method - delegates to appropriate model
   */
  async _generate(messages, options, runManager) {
    await this._initializeDelegate();

    // If we have pending tools, bind them to the delegate
    if (this._pendingTools) {
      this.delegateModel = this.delegateModel.bindTools(this._pendingTools, this._pendingToolsKwargs);
    }

    // Convert LangChain messages for delegate model
    const langChainMessages = messages.map(msg => {
      if (typeof msg.content === 'string') {
        return msg;
      }
      // Handle complex content
      return msg;
    });

    // Use the delegate model to generate response
    const response = await this.delegateModel.invoke(langChainMessages, options);

    // Convert response back to the expected format for BaseChatModel
    return {
      generations: [
        {
          text: response.content,
          message: response,
        },
      ],
      llmOutput: {
        model: this.model,
      },
    };
  }

  /**
   * Get the parameters used to invoke the model (used by LangSmith)
   */
  invocationParams(options = {}) {
    return {
      model: this.model,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
      host: this.host,
    };
  }
}