import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { AIMessage } from "@langchain/core/messages";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

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
   * Main generation method - calls Databricks API directly
   */
  async _generate(messages, options, runManager) {
    await this._initializeDelegate();

    // Convert LangChain messages to Databricks API format
    const databricksMessages = this._convertMessages(messages);

    // Build request payload for Databricks API
    const payload = {
      messages: databricksMessages,
      temperature: options?.temperature ?? this.temperature,
      max_tokens: options?.maxTokens ?? this.maxTokens,
      stream: false
    };

    // Add tools if bound (use delegate model's tool format)
    if (this._pendingTools) {
      // Get tools in the correct format for the detected model type
      payload.tools = this._formatToolsForProvider();
    }

    try {
      // Call Databricks API directly
      const response = await fetch(this.baseURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Databricks API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      // Parse response based on detected model type
      return this._parseResponse(data);

    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error connecting to Databricks: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Convert LangChain messages to Databricks API format
   */
  _convertMessages(messages) {
    return messages.map(message => {
      if (message._getType() === "system") {
        return { role: "system", content: message.content };
      } else if (message._getType() === "human") {
        return { role: "user", content: message.content };
      } else if (message._getType() === "ai") {
        const result = { role: "assistant", content: message.content };
        // Add tool calls if present
        if (message.tool_calls && message.tool_calls.length > 0) {
          result.tool_calls = message.tool_calls.map(toolCall => ({
            id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: "function",
            function: {
              name: toolCall.name,
              arguments: JSON.stringify(toolCall.args)
            }
          }));
        }
        return result;
      } else if (message._getType() === "tool") {
        return {
          role: "tool",
          tool_call_id: message.tool_call_id,
          content: message.content
        };
      } else {
        return { role: "user", content: message.content };
      }
    });
  }

  /**
   * Format tools for the detected provider (OpenAI-compatible format)
   */
  _formatToolsForProvider() {
    if (!this._pendingTools) return [];

    // Use LangChain's proven tool conversion to OpenAI format
    return this._pendingTools.map(tool => convertToOpenAITool(tool));
  }

  /**
   * Parse Databricks API response
   */
  _parseResponse(data) {
    let content = "";
    let toolCalls = [];

    if (data.choices && data.choices.length > 0) {
      const choice = data.choices[0];
      content = choice.message?.content || choice.text || "";

      // Parse tool calls if present
      if (choice.message?.tool_calls) {
        toolCalls = choice.message.tool_calls.map(toolCall => ({
          id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: toolCall.function.name,
          args: JSON.parse(toolCall.function.arguments || '{}')
        }));
      }
    } else if (data.response) {
      content = data.response;
    } else if (typeof data === 'string') {
      content = data;
    } else {
      throw new Error(`Unexpected Databricks response format: ${JSON.stringify(data)}`);
    }

    // Create AIMessage with tool calls if present
    const messageFields = { content };
    if (toolCalls.length > 0) {
      messageFields.tool_calls = toolCalls;
    }

    const aiMessage = new AIMessage(messageFields);

    return {
      generations: [
        {
          text: content,
          message: aiMessage,
        },
      ],
      llmOutput: {
        model: this.model,
        usage: data.usage || {},
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