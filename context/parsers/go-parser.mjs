import { finalizeParse, sourceInput } from "./parser-utils.mjs";

export class GoParser {
  supports(path) { return /\.go$/.test(path); }
  async parse(input) {
    const content = await sourceInput(input); const symbols = []; const references = [];
    const packageName = content.match(/^\s*package\s+(\w+)/m)?.[1] ?? input.path;
    content.split("\n").forEach((line, index) => {
      for (const imported of line.matchAll(/"([\w./-]+)"/g)) if (/^\s*import\b/.test(line) || /^\s*[\w.]*\s*"/.test(line)) references.push({ source: input.path, target: imported[1], line: index + 1, type: "IMPORTS" });
      const type = line.match(/^\s*type\s+([A-Za-z_]\w*)\s+(struct|interface)\b/);
      if (type) symbols.push({ qualifiedName: `${packageName}.${type[1]}`, semanticContainer: packageName, kind: type[2], lineStart: index + 1, signature: line.trim().replace(/\s*\{.*$/, "") });
      const fn = line.match(/^\s*func\s*(?:\(\s*\w+\s+\*?([A-Za-z_]\w*)\s*\)\s*)?([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if (fn) { const container = fn[1] ? `${packageName}.${fn[1]}` : packageName; symbols.push({ qualifiedName: `${container}.${fn[2]}`, semanticContainer: container, kind: fn[1] ? "method" : "function", lineStart: index + 1, signature: `${fn[2]}(${fn[3].replace(/\s+/g, " ").trim()})` }); }
    });
    return finalizeParse({ ...input, language: "go", content, symbols, references });
  }
}

