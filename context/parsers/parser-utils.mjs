import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

export function hash(...parts) { return createHash("sha256").update(parts.join("\0")).digest("hex"); }

export async function sourceInput({ content, absolutePath }) {
  return content ?? readFile(absolutePath, "utf8");
}

export function finalizeParse({ path, oid, language, content, symbols, references }) {
  const lines = content.split("\n");
  const normalized = symbols.map((symbol) => ({
    language,
    semanticContainer: symbol.semanticContainer ?? path,
    signatureHash: hash(language, symbol.kind, symbol.signature ?? symbol.qualifiedName),
    lineEnd: symbol.lineEnd ?? symbol.lineStart,
    ...symbol,
  }));
  return {
    symbols: normalized,
    references: references.sort((left, right) => left.line - right.line || left.target.localeCompare(right.target)),
    chunks: normalized.map((symbol) => {
      const text = lines.slice(symbol.lineStart - 1, symbol.lineEnd).join("\n");
      return { id: hash(oid, language, symbol.qualifiedName, symbol.signatureHash), symbol: symbol.qualifiedName, content: text, contentHash: hash(text), provenance: { path, oid, lineStart: symbol.lineStart, lineEnd: symbol.lineEnd, language } };
    }),
  };
}

