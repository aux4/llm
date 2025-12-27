import { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";

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
   * Convert LangChain messages to Databricks API format
   */
  _convertMessages(messages) {
    return messages.map(message => {
      if (message instanceof SystemMessage) {
        return { role: "system", content: message.content };
      } else if (message instanceof HumanMessage) {
        return { role: "user", content: message.content };
      } else if (message instanceof AIMessage) {
        return { role: "assistant", content: message.content };
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
      let content;
      if (data.choices && data.choices.length > 0) {
        // OpenAI-compatible format
        content = data.choices[0].message?.content || data.choices[0].text || "";
      } else if (data.response) {
        // Simple response format
        content = data.response;
      } else if (typeof data === 'string') {
        // Direct string response
        content = data;
      } else {
        throw new Error(`Unexpected Databricks response format: ${JSON.stringify(data)}`);
      }

      const aiMessage = new AIMessage({ content });

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