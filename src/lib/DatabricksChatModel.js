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
    console.log(`[DATABRICKS] bindTools called with ${tools?.length || 0} tools`);

    const convertedTools = tools.map((tool, index) => {
      console.log(`[DATABRICKS] Converting tool ${index}:`, {
        name: tool.name || 'unknown',
        type: typeof tool,
        hasSchema: !!tool.schema
      });

      const converted = convertToOpenAITool(tool);
      console.log(`[DATABRICKS] Converted tool ${index}:`, JSON.stringify(converted, null, 2));
      return converted;
    });

    console.log(`[DATABRICKS] Total converted tools: ${convertedTools.length}`);

    return this.withConfig({
      tools: convertedTools,
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
    console.log(`[DATABRICKS] _generate called with ${messages?.length || 0} messages`);
    console.log(`[DATABRICKS] Options:`, {
      hasTools: !!(options.tools && options.tools.length > 0),
      toolCount: options.tools?.length || 0,
      temperature: options.temperature,
      maxTokens: options.maxTokens
    });

    const databricksMessages = this._convertMessages(messages);
    console.log(`[DATABRICKS] Converted ${databricksMessages.length} messages`);

    // Build request payload - NO MODEL FIELD (it's in the URL path)
    const payload = {
      messages: databricksMessages,
      temperature: options.temperature ?? this.temperature,
      max_tokens: options.maxTokens ?? this.maxTokens,
      stream: false
    };

    // Add tools if present (using OpenAI's converted format)
    if (options.tools && options.tools.length > 0) {
      console.log(`[DATABRICKS] Adding ${options.tools.length} tools to payload`);
      console.log(`[DATABRICKS] Tools being sent:`, JSON.stringify(options.tools, null, 2));

      payload.tools = options.tools;

      // Add tool_choice if specified
      if (options.tool_choice) {
        console.log(`[DATABRICKS] Adding tool_choice:`, options.tool_choice);
        payload.tool_choice = options.tool_choice;
      }
    } else {
      console.log(`[DATABRICKS] No tools to add to payload`);
    }

    console.log(`[DATABRICKS] Final request payload:`, JSON.stringify(payload, null, 2));
    console.log(`[DATABRICKS] Request URL:`, this.baseUrl);

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
      console.log(`[DATABRICKS] Raw response:`, JSON.stringify(data, null, 2));

      // Handle OpenAI-compatible response format
      let content = "";
      let toolCalls = [];

      if (data.choices && data.choices.length > 0) {
        const choice = data.choices[0];
        console.log(`[DATABRICKS] Processing choice:`, JSON.stringify(choice, null, 2));

        content = choice.message?.content || choice.text || "";
        console.log(`[DATABRICKS] Extracted content:`, content);

        // Parse tool calls if present
        if (choice.message?.tool_calls) {
          console.log(`[DATABRICKS] Raw tool_calls from response:`, JSON.stringify(choice.message.tool_calls, null, 2));

          toolCalls = choice.message.tool_calls.map((toolCall, index) => {
            console.log(`[DATABRICKS] Processing tool call ${index}:`, JSON.stringify(toolCall, null, 2));

            let parsedArgs = {};
            try {
              parsedArgs = JSON.parse(toolCall.function.arguments || '{}');
              console.log(`[DATABRICKS] Successfully parsed args for tool ${toolCall.function.name}:`, parsedArgs);
            } catch (e) {
              console.error(`[DATABRICKS] Failed to parse args for tool ${toolCall.function.name}:`, toolCall.function.arguments, e.message);
              parsedArgs = {};
            }

            return {
              id: toolCall.id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              name: toolCall.function.name,
              args: parsedArgs
            };
          });

          console.log(`[DATABRICKS] Final processed tool calls:`, JSON.stringify(toolCalls, null, 2));
        } else {
          console.log(`[DATABRICKS] No tool_calls in response`);
        }
      } else if (data.response) {
        console.log(`[DATABRICKS] Using data.response format:`, data.response);
        content = data.response;
      } else if (typeof data === 'string') {
        console.log(`[DATABRICKS] Using direct string response:`, data);
        content = data;
      } else {
        console.error(`[DATABRICKS] Unexpected response format:`, JSON.stringify(data, null, 2));
        throw new Error(`Unexpected Databricks response format: ${JSON.stringify(data)}`);
      }

      // Create AIMessage with tool calls if present
      const messageFields = { content };
      if (toolCalls.length > 0) {
        console.log(`[DATABRICKS] Adding ${toolCalls.length} tool calls to message`);
        messageFields.tool_calls = toolCalls;
      } else {
        console.log(`[DATABRICKS] No tool calls to add to message`);
      }

      const aiMessage = new AIMessage(messageFields);
      console.log(`[DATABRICKS] Created AIMessage with tool_calls:`, !!messageFields.tool_calls);

      const result = {
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

      console.log(`[DATABRICKS] Returning result with ${result.generations.length} generations`);
      return result;
    } catch (error) {
      console.error(`[DATABRICKS] Error in _generate:`, error);
      console.error(`[DATABRICKS] Error stack:`, error.stack);

      // Add context to the error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        const networkError = new Error(`Network error connecting to Databricks: ${error.message}`);
        console.error(`[DATABRICKS] Network error:`, networkError.message);
        throw networkError;
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