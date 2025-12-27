import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";

/**
 * Chat model for Databricks serving endpoints.
 * Uses OpenAI tool conversion utilities but follows Databricks API requirements.
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
    this.baseUrl = `${this.host.replace(/\/$/, '')}/serving-endpoints/${this.model}/invocations`;
  }

  _llmType() {
    return "databricks";
  }

  /**
   * Bind tools to this chat model using OpenAI's proven tool conversion
   */
  bindTools(tools, kwargs) {
    return this.withConfig({
      tools: tools.map(tool => convertToOpenAITool(tool)),
      ...kwargs
    });
  }

  /**
   * Convert LangChain messages to Databricks API format (OpenAI-compatible)
   */
  _convertMessages(messages) {
    return messages.map(message => {
      if (message instanceof SystemMessage) {
        return { role: "system", content: message.content };
      } else if (message instanceof HumanMessage) {
        return { role: "user", content: message.content };
      } else if (message instanceof AIMessage) {
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
      } else if (message instanceof ToolMessage) {
        return {
          role: "tool",
          tool_call_id: message.tool_call_id,
          content: message.content
        };
      } else {
        // Fallback for other message types
        return { role: "user", content: message.content };
      }
    });
  }

  /**
   * Main generation method - implements the abstract _generate method
   * Uses OpenAI-compatible request format but follows Databricks URL structure
   */
  async _generate(messages, options, runManager) {
    const databricksMessages = this._convertMessages(messages);

    // Build request payload - NO MODEL FIELD (it's in the URL path)
    const payload = {
      messages: databricksMessages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
      stream: false
    };

    // Add tools if present (using OpenAI's converted format)
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;

      // Add tool_choice if specified
      if (options.tool_choice) {
        payload.tool_choice = options.tool_choice;
      }
    }

    try {
      const response = await fetch(this.baseUrl, {
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

      // Handle OpenAI-compatible response format
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
    } catch (error) {
      // Add context to the error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error connecting to Databricks: ${error.message}`);
      }
      throw error;
    }
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