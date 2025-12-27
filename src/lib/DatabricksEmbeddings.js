import { Embeddings } from "@langchain/core/embeddings";

/**
 * Embeddings implementation for Databricks serving endpoints.
 *
 * Configuration:
 * - host: Databricks workspace host URL
 * - model: Model serving endpoint name
 * - apiKey: Databricks API key
 * - batchSize: (optional) Number of documents to embed in a single request
 */
export class DatabricksEmbeddings extends Embeddings {
  constructor(fields = {}) {
    super(fields);

    this.host = fields.host || process.env.DATABRICKS_HOST;
    this.model = fields.model || fields.endpoint;
    this.apiKey = fields.apiKey || process.env.DATABRICKS_API_KEY;
    this.batchSize = fields.batchSize ?? 20; // Default batch size

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

  /**
   * Make a request to the Databricks embeddings endpoint
   */
  async _callDatabricksEmbeddingEndpoint(texts) {
    const payload = {
      input: texts,
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
        throw new Error(`Databricks Embeddings API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();

      // Handle different response formats
      let embeddings;
      if (data.data && Array.isArray(data.data)) {
        // OpenAI-compatible format
        embeddings = data.data.map(item => item.embedding || item);
      } else if (data.embeddings && Array.isArray(data.embeddings)) {
        // Direct embeddings format
        embeddings = data.embeddings;
      } else if (Array.isArray(data)) {
        // Direct array format
        embeddings = data;
      } else {
        throw new Error(`Unexpected Databricks embeddings response format: ${JSON.stringify(data)}`);
      }

      // Validate that we got embeddings for all inputs
      if (embeddings.length !== texts.length) {
        throw new Error(`Expected ${texts.length} embeddings, got ${embeddings.length}`);
      }

      return embeddings;
    } catch (error) {
      // Add context to the error
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Network error connecting to Databricks embeddings endpoint: ${error.message}`);
      }
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple documents
   */
  async embedDocuments(texts) {
    // Process in batches to handle large inputs efficiently
    const batches = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      batches.push(texts.slice(i, i + this.batchSize));
    }

    const batchPromises = batches.map(async (batch) => {
      return this.caller.call(async () => {
        return this._callDatabricksEmbeddingEndpoint(batch);
      });
    });

    const batchResults = await Promise.all(batchPromises);

    // Flatten the batch results
    return batchResults.flat();
  }

  /**
   * Generate embedding for a single query
   */
  async embedQuery(text) {
    const embeddings = await this.embedDocuments([text]);
    return embeddings[0];
  }
}