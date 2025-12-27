import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from "@langchain/core/messages";
import { isOpenAITool } from "@langchain/core/language_models/base";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";

/**
 * Format tools for Databricks API (OpenAI-compatible format)
 */
function formatToolsForDatabricks(tools) {
  if (!tools || tools.length === 0) return undefined;

  return tools.map(tool => {
    if (isOpenAITool(tool)) {
      // Already in OpenAI format
      return tool;
    } else if (isLangChainTool(tool)) {
      // Convert LangChain tool to OpenAI format
      const schema = isInteropZodSchema(tool.schema) ? toJsonSchema(tool.schema) : tool.schema;
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description || "",
          parameters: schema
        }
      };
    } else {
      // Assume it's already a function definition
      return {
        type: "function",
        function: tool
      };
    }
  });
}

/**
 * Check if a message is an AIMessage
 */
function isAIMessage(message) {
  return message instanceof AIMessage;
}

/**
 * Chat model for Databricks serving endpoints.
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

    // Build the endpoint URL
    this.baseUrl = `${this.host.replace(/\/$/, '')}/serving-endpoints/${this.model}`;
  }

  _llmType() {
    return "databricks";
  }

  /**
   * Bind tools to this chat model
   */
  bindTools(tools, kwargs) {
    return this.withConfig({
      tools: formatToolsForDatabricks(tools),
      ...kwargs
    });
  }

  /**
   * Convert LangChain messages to Databricks API format
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
   */
  async _generate(messages, options, runManager) {
    const databricksMessages = this._convertMessages(messages);

    const payload = {
      messages: databricksMessages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
      stream: false
    };

    // Add tools if present
    if (options.tools && options.tools.length > 0) {
      payload.tools = options.tools;

      // Add tool_choice if specified
      if (options.tool_choice) {
        payload.tool_choice = options.tool_choice;
      }
    }

    try {
      const response = await fetch(`${this.baseUrl}/invocations`, {
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

      // Handle different response formats
      let content = "";
      let toolCalls = [];

      if (data.choices && data.choices.length > 0) {
        // OpenAI-compatible format
        const choice = data.choices[0];
        content = choice.message?.content || choice.text || "";

        // Parse tool calls if present
        if (choice.message?.tool_calls) {
          toolCalls = choice.message.tool_calls.map(toolCall => ({
            id: toolCall.id,
            name: toolCall.function.name,
            args: JSON.parse(toolCall.function.arguments || '{}')
          }));
        }
      } else if (data.response) {
        // Simple response format
        content = data.response;
      } else if (typeof data === 'string') {
        // Direct string response
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