const { Printer } = require("@aux4/engine");
const Input = require("@aux4/input");
const Prompt = require("../../lib/Prompt");
const { readFile, asJson } = require("../../lib/util/FileUtils");

const out = Printer.on(process.stdout);

async function askExecutor(params) {
  const instructions = await params.instructions;
  const model = await params.model;
  const question = await params.question;
  const role = await params.role;
  const history = await params.history;
  const outputSchema = await params.outputSchema;
  const context = await params.context;

  let contextContent;
  if (context === true || context === "true") {
    contextContent = await Input.readAsString();
  }

  let message = question;
  if (contextContent) {
    message = `---\n${contextContent}\n---\n${question}`;
  }

  const prompt = new Prompt(model);
  if (instructions) {
    await prompt.instructions(await readFile(instructions));
  }
  await prompt.history(history);

  prompt.onMessage(answer => {
    out.println(answer.trim());
  });
  
  prompt.setOutputSchema(await readFile(outputSchema).then(asJson()));

  await prompt.message(question, params, role);
}

module.exports = { askExecutor };
