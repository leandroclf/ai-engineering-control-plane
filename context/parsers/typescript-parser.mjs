import { finalizeParse, sourceInput } from "./parser-utils.mjs";

export class TypeScriptParser {
  supports(path) { return /\.(?:ts|tsx)$/.test(path); }
  async parse(input) {
    const content = await sourceInput(input); const symbols = []; const references = [];
    content.split("\n").forEach((line, index) => {
      const declaration = line.match(/(?:export\s+)?(?:declare\s+)?(?:async\s+)?(?:function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)|(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?\(/);
      if (declaration) {
        const qualifiedName = declaration[1] ?? declaration[2];
        const kind = /\b(class|interface|type|enum)\b/.exec(line)?.[1] ?? "function";
        symbols.push({ qualifiedName, kind, lineStart: index + 1, signature: line.trim().replace(/\s*\{.*$/, "") });
      }
      for (const match of line.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)) references.push({ source: input.path, target: match[1], line: index + 1, type: "IMPORTS" });
    });
    return finalizeParse({ ...input, language: "typescript", content, symbols, references });
  }
}

