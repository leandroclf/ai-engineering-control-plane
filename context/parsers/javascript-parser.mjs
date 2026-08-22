import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { createHash } from "node:crypto";
import { finalizeParse } from "./parser-utils.mjs";

const exec = promisify(execFile);

export class JavaScriptParser {
  supports(path) {
    return /\.(?:cjs|js|mjs)$/.test(path);
  }

  async parse({ path, absolutePath, oid }) {
    const content = await readFile(absolutePath, "utf8");
    let syntaxPath = absolutePath;
    let temporaryDirectory;
    if (/^\s*(?:import|export)\s/m.test(content) && !absolutePath.endsWith(".mjs")) {
      temporaryDirectory = await mkdtemp(join(tmpdir(), "aicp-esm-check-"));
      syntaxPath = join(temporaryDirectory, "module.mjs");
      await writeFile(syntaxPath, content);
    }
    try {
      await exec(process.execPath, ["--check", syntaxPath]);
    } catch (error) {
      throw new Error(`syntax error in ${path}: ${error.stderr || error.message}`);
    } finally {
      if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
    }
    const lines = content.split("\n");
    const symbols = [];
    const references = [];
    lines.forEach((line, index) => {
      const symbol = line.match(/(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)|(?:export\s+)?class\s+([A-Za-z_$][\w$]*)|(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/);
      if (symbol) {
        const qualifiedName = symbol[1] ?? symbol[2] ?? symbol[3];
        symbols.push({ language: "javascript", qualifiedName, semanticContainer: path, signatureHash: createHash("sha256").update(line.trim().replace(/\s*\{.*$/, "")).digest("hex"), kind: symbol[2] ? "class" : "function", lineStart: index + 1, lineEnd: index + 1 });
      }
      for (const match of line.matchAll(/(?:from\s+|require\s*\(\s*)['"]([^'"]+)['"]/g)) {
        references.push({ source: path, target: match[1], line: index + 1, type: "IMPORTS" });
      }
    });
    return finalizeParse({ path, oid, language: "javascript", content, symbols, references });
  }
}
