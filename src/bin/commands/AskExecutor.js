import Prompt from "../../lib/Prompt.js";
import { readFile, asJson } from "../../lib/util/FileUtils.js";
import { readStdIn } from "../../lib/util/Input.js";

export async function askExecutor(params) {
  const instructions = params.instructions;
  const model = params.model;
  const question = params.question;
  const role = params.role;
  const history = params.history;
  const outputSchema = params.outputSchema;
  const context = params.context;

  let contextContent;
  if (context === true || context === "true") {
    contextContent = await readStdIn();
  }

  let message = question;
  if (contextContent) {
    message = `---\n${contextContent}\n---\n${question}`;
  }

  const prompt = new Prompt(model);
  await prompt.init();
  if (instructions) {
    await prompt.instructions(await readFile(instructions), params);
  }

  await prompt.history(history);

  prompt.onMessage(answer => {
    console.log(answer.trim());
  });

  prompt.setOutputSchema(await readFile(outputSchema).then(asJson()));

  await prompt.message(message, params, role);
}
