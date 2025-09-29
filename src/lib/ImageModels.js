import OpenAI from "openai";

/**
 * Generic image generator class that wraps different image generation models
 */
class ImageGenerator {
  constructor(config = {}) {
    this.config = config;
    this.type = config.type || "openai";
    this.model = this.createModel();
  }

  createModel() {
    switch (this.type) {
      case "openai":
        return new OpenAI({
          apiKey: this.config.config?.apiKey || process.env.OPENAI_API_KEY,
          ...this.config.config
        });
      default:
        throw new Error(`Unsupported image generation model type: ${this.type}`);
    }
  }

  /**
   * Generate an image from a text prompt
   * @param {string} prompt - The text prompt to generate image from
   * @param {Object} options - Additional options like size, quality, etc.
   * @returns {Promise<string>} - Base64 encoded image data
   */
  async generateImage(prompt, options = {}) {
    try {
      switch (this.type) {
        case "openai":
          return await this.generateOpenAIImage(prompt, options);
        default:
          throw new Error(`Image generation not implemented for type: ${this.type}`);
      }
    } catch (error) {
      throw new Error(`Image generation failed: ${error.message}`);
    }
  }

  async generateOpenAIImage(prompt, options = {}) {
    const params = {
      prompt: prompt,
      model: this.config.config?.model || "dall-e-3",
      size: options.size || "1024x1024",
      quality: options.quality || "standard",
      n: 1,
      response_format: "b64_json"
    };

    // Use OpenAI client directly for image generation
    const openai = this.model;

    try {
      const response = await openai.images.generate(params);

      if (response.data && response.data[0] && response.data[0].b64_json) {
        return response.data[0].b64_json;
      }

      throw new Error("No image data returned from OpenAI");
    } catch (error) {
      throw new Error(`OpenAI image generation failed: ${error.message}`);
    }
  }

  /**
   * Get supported models for the current type
   * @returns {Array<string>} - Array of supported model names
   */
  getSupportedModels() {
    switch (this.type) {
      case "openai":
        return ["dall-e-3", "dall-e-2"];
      default:
        return [];
    }
  }

  /**
   * Get supported sizes for the current type and model
   * @returns {Array<string>} - Array of supported sizes
   */
  getSupportedSizes() {
    switch (this.type) {
      case "openai":
        const model = this.config.config?.model || "dall-e-3";
        if (model === "dall-e-3") {
          return ["1024x1024", "1024x1792", "1792x1024"];
        } else if (model === "dall-e-2") {
          return ["256x256", "512x512", "1024x1024"];
        }
        return ["1024x1024"];
      default:
        return ["1024x1024"];
    }
  }
}

/**
 * Get image generator instance
 * @param {string} type - The image generation model type (e.g., "openai")
 * @param {Object} config - Model configuration
 * @returns {ImageGenerator} - Image generator instance
 */
export function getImageGenerator(type = "openai", config = {}) {
  return new ImageGenerator({ type, config });
}

export default ImageGenerator;