import { getImageGenerator } from "./ImageModels.js";
import Tools from "./Tools.js";

const VARIABLE_REGEX = /\{([a-zA-Z0-9-_]+)\}/g;

class ImagePrompt {
  constructor(config = {}) {
    this.config = config;
    this.generator = getImageGenerator(config.type || "openai", config);
    this.tools = Tools;
  }

  async init() {
    // Image generation doesn't need tool binding like text models
    // But we keep this method for consistency with Prompt class
  }

  /**
   * Generate an image from a prompt and save it to the specified path
   * @param {string} prompt - The text prompt to generate image from
   * @param {Object} params - Parameters including image path and options
   * @param {string} imagePath - Path where to save the generated image
   * @returns {Promise<string>} - Success message or error
   */
  async generateImage(prompt, params = {}, imagePath) {
    try {
      const processedPrompt = await replacePromptVariables(prompt, params);

      // Extract image generation options from params
      const options = {
        size: params.size || "1024x1024",
        quality: params.quality || "standard",
        ...params.imageOptions
      };

      if (this.callback) {
        this.callback("Generating image...");
      }

      // Generate the image
      const base64Image = await this.generator.generateImage(processedPrompt, options);

      if (!base64Image) {
        throw new Error("No image data returned from generator");
      }

      // Save the image using the saveImage tool
      if (imagePath) {
        const saveResult = await this.tools.saveImage.invoke({
          imageName: imagePath,
          content: base64Image
        });

        if (this.callback) {
          this.callback(saveResult);
        }

        return saveResult;
      } else {
        // Return base64 data if no path specified
        if (this.callback) {
          this.callback("Image generated successfully (base64 data returned)");
        }
        return base64Image;
      }

    } catch (error) {
      const errorMessage = `Image generation failed: ${error.message}`;
      if (this.callback) {
        this.callback(errorMessage);
      }
      throw new Error(errorMessage);
    }
  }

  /**
   * Set a callback function to receive progress updates
   * @param {Function} callback - Callback function
   */
  onMessage(callback) {
    this.callback = callback;
  }

  /**
   * Get information about the current image generator
   * @returns {Object} - Generator information
   */
  getGeneratorInfo() {
    return {
      type: this.generator.type,
      supportedModels: this.generator.getSupportedModels(),
      supportedSizes: this.generator.getSupportedSizes()
    };
  }

  async close() {
    // Nothing to close for image generation
  }
}

async function replacePromptVariables(text, params = {}) {
  if (!text) return text;

  const variables = text.match(VARIABLE_REGEX);
  const variableValues = (variables || [])
    .map(variable => variable.substring(1, variable.length - 1))
    .reduce((acc, variable) => ({ ...acc, [variable]: undefined }), {});

  for (const variable in variableValues) {
    variableValues[variable] = await params[variable];
  }

  let output = text;
  for (const variable in variableValues) {
    const value = variableValues[variable];
    if (value === undefined) {
      continue;
    }
    output = output.replaceAll(`{${variable}}`, variableValues[variable]);
  }

  return output;
}

export default ImagePrompt;