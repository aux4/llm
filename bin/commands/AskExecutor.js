const { Printer } = require("@aux4/engine");
const Input = require("@aux4/input");
const Prompt = require("../../lib/Prompt");
const { readFile } = require("../../lib/util/FileUtils");

const out = Printer.on(process.stdout);

const VARIABLE_REGEX = /\{([^}]+)\}/g;

async function askExecutor(params) {
  const instructions = await params.instructions;
  const model = await params.model;
  const question = await params.question;
  const role = await params.role;
  const history = await params.history;
  const context = await params.context;

  let contextContent;
  if (context === true || context === "true") {
    contextContent = await Input.readAsString();
  }

  let message = question;
  if (contextContent) {
    message = `---\n${contextContent}\n---\n${question}`;
  }

  const variableMatches = question.match(VARIABLE_REGEX) || [];
  const variables = variableMatches.map(match => match.slice(1, -1));

  const values = {...params.$params};
  for (const variable of variables) {
    values[variable] = await params[variable];
  }

  const prompt = new Prompt(model);
  if (instructions) {
    await prompt.instructions(await readFile(instructions));
  }
  await prompt.history(history);

  prompt.onMessage(answer => {
    out.println(answer.trim());
  });

  await prompt.message(question, values, role);
}

module.exports = { askExecutor };
