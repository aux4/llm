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
        quantity: params.quantity || 1,
        ...params.imageOptions
      };

      if (this.callback) {
        this.callback("Generating image...");
      }

      // Check if this model supports batch generation (n > 1)
      const modelSupportsMultiple = !this.generator.config.config?.model?.startsWith("gpt-image");
      const requestedQuantity = options.quantity || 1;

      let imageResults = [];

      if (requestedQuantity > 1 && !modelSupportsMultiple) {
        // Model doesn't support n > 1, make multiple individual calls
        for (let i = 0; i < requestedQuantity; i++) {
          if (this.callback) {
            this.callback(`Generating image ${i + 1}/${requestedQuantity}...`);
          }
          const singleImageOptions = { ...options, quantity: 1 };
          const singleResult = await this.generator.generateImage(processedPrompt, singleImageOptions);
          imageResults.push(singleResult);
        }
      } else {
        // Model supports batch generation or only one image requested
        const imageResult = await this.generator.generateImage(processedPrompt, options);
        if (!imageResult) {
          throw new Error("No image data returned from generator");
        }
        imageResults = Array.isArray(imageResult) ? imageResult : [imageResult];
      }

      // Handle multiple images
      if (imageResults.length > 1 && requestedQuantity > 1) {
        const results = [];
        for (let i = 0; i < imageResults.length; i++) {
          const imageData = imageResults[i];
          let currentImagePath = imagePath;

          // Generate numbered filenames for multiple images
          if (imagePath) {
            const lastDotIndex = imagePath.lastIndexOf('.');
            if (lastDotIndex !== -1) {
              const nameWithoutExt = imagePath.substring(0, lastDotIndex);
              const extension = imagePath.substring(lastDotIndex);
              currentImagePath = `${i + 1}-${nameWithoutExt}${extension}`;
            } else {
              currentImagePath = `${i + 1}-${imagePath}`;
            }

            const saveResult = await this.tools.saveImage.invoke({
              imageName: currentImagePath,
              content: imageData
            });

            if (this.callback) {
              this.callback(saveResult);
            }

            results.push(saveResult);
          } else {
            results.push(imageData);
          }
        }
        return results;
      } else {
        // Single image handling
        const base64Image = imageResults[0];

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