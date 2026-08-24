import { isAbsolute, relative, resolve } from "node:path";

function readOptions(args, allowed) {
  const options = new Map();
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index];
    const value = args[index + 1];
    if (!allowed.has(flag)) throw new TypeError(`unknown option: ${flag}`);
    if (!value || value.startsWith("--")) throw new TypeError(`missing value for option: ${flag}`);
    const values = options.get(flag) ?? [];
    values.push(value);
    options.set(flag, values);
  }
  return options;
}

function required(options, flag) {
  const value = options.get(flag)?.at(-1);
  if (!value) throw new TypeError(`required option missing: ${flag}`);
  return value;
}

export function parseRuntimeArguments(argv) {
  const [command, ...args] = argv;
  if (command === "resume") {
    const options = readOptions(args, new Set(["--run"]));
    return { command, runId: required(options, "--run") };
  }
  if (command !== "start") throw new TypeError("command must be start or resume");
  const options = readOptions(args, new Set([
    "--project", "--query", "--idempotency-key", "--repository", "--provider", "--scope",
  ]));
  const project = required(options, "--project");
  return {
    command,
    project,
    query: required(options, "--query"),
    idempotencyKey: required(options, "--idempotency-key"),
    ...(options.get("--provider")?.at(-1) ? { providerId: options.get("--provider").at(-1) } : {}),
    repository: options.get("--repository")?.at(-1) ?? project,
    scopes: options.get("--scope") ?? [`REPOSITORY:${project}`],
  };
}

export function resolveProjectDirectory(projectsRoot, project) {
  const root = resolve(projectsRoot);
  const candidate = resolve(root, project);
  const pathFromRoot = relative(root, candidate);
  if (isAbsolute(pathFromRoot) || pathFromRoot === ".." || pathFromRoot.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`)) {
    throw new TypeError("project is outside projects root");
  }
  return candidate;
}
