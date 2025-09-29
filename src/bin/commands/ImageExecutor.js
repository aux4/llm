import ImagePrompt from "../../lib/ImagePrompt.js";
import { readStdIn } from "../../lib/util/Input.js";

export async function imageExecutor(params) {
  try {
    const model = params.model;
    const prompt = params.prompt;
    const imagePath = params.image;
    const context = params.context;
    const size = params.size;
    const quality = params.quality;

    let contextContent;
    if (context === true || context === "true") {
      contextContent = await readStdIn();
    }

    let message = prompt;
    if (contextContent) {
      message = `---\n${contextContent}\n---\n${prompt}`;
    }

    const imagePrompt = new ImagePrompt(model);
    await imagePrompt.init();

    imagePrompt.onMessage(answer => {
      console.log(answer.trim());
    });

    // Add image generation options to params
    const imageParams = {
      ...params,
      size: size || "1024x1024",
      quality: quality || "standard"
    };

    const result = await imagePrompt.generateImage(message, imageParams, imagePath);

    imagePrompt.close();

    return result;
  } catch (error) {
    console.error("Error in imageExecutor:");
    console.error("Message:", error.message);
    console.error("Stack trace:");
    console.error(error.stack);
    throw error;
  }
}