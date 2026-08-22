import { finalizeParse, sourceInput } from "./parser-utils.mjs";

export class PythonParser {
  supports(path) { return /\.py$/.test(path); }
  async parse(input) {
    const content = await sourceInput(input); const symbols = []; const references = []; let container = null;
    content.split("\n").forEach((line, index) => {
      const imported = line.match(/^\s*(?:from\s+([\w.]+)\s+import|import\s+([\w.]+))/);
      if (imported) references.push({ source: input.path, target: imported[1] ?? imported[2], line: index + 1, type: "IMPORTS" });
      const klass = line.match(/^class\s+([A-Za-z_]\w*)\s*(?:\([^)]*\))?\s*:/);
      if (klass) { container = klass[1]; symbols.push({ qualifiedName: container, semanticContainer: input.path, kind: "class", lineStart: index + 1, signature: line.trim() }); return; }
      const fn = line.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z_]\w*)\s*\(([^)]*)\)/);
      if (fn) { const nested = fn[1].length && container; symbols.push({ qualifiedName: nested ? `${container}.${fn[2]}` : fn[2], semanticContainer: nested ? container : input.path, kind: nested ? "method" : "function", lineStart: index + 1, signature: `${fn[2]}(${fn[3].replace(/\s+/g, " ").trim()})` }); }
      if (line && !/^\s/.test(line) && !klass) container = null;
    });
    return finalizeParse({ ...input, language: "python", content, symbols, references });
  }
}

