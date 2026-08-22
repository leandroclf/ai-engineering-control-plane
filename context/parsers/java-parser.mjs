import { finalizeParse, sourceInput } from "./parser-utils.mjs";

export class JavaParser {
  supports(path) { return /\.java$/.test(path); }
  async parse(input) {
    const content = await sourceInput(input); const symbols = []; const references = [];
    const lines = content.split("\n"); const packageName = content.match(/^\s*package\s+([\w.]+)\s*;/m)?.[1] ?? ""; let container = null;
    lines.forEach((line, index) => {
      const imported = line.match(/^\s*import\s+(?:static\s+)?([\w.*]+)\s*;/);
      if (imported) references.push({ source: input.path, target: imported[1], line: index + 1, type: "IMPORTS" });
      const type = line.match(/\b(class|interface|enum|record)\s+([A-Za-z_$][\w$]*)/);
      if (type) {
        container = [packageName, type[2]].filter(Boolean).join(".");
        symbols.push({ qualifiedName: container, semanticContainer: packageName || input.path, kind: type[1], lineStart: index + 1, signature: line.trim().replace(/\s*\{.*$/, "") });
        return;
      }
      const method = line.match(/^(?:\s*(?:public|protected|private|static|final|abstract|synchronized|native|default)\s+)*(?:<[\w, ?]+>\s+)?[\w.$<>\[\], ?]+\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)\s*(?:throws\s+[\w., ]+)?\s*\{?/);
      if (container && method && !["if", "for", "while", "switch", "catch", "return", "new"].includes(method[1])) symbols.push({ qualifiedName: `${container}.${method[1]}`, semanticContainer: container, kind: "method", lineStart: index + 1, signature: `${method[1]}(${method[2].replace(/\s+/g, " ").trim()})` });
    });
    return finalizeParse({ ...input, language: "java", content, symbols, references });
  }
}

