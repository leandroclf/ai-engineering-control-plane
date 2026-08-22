import { createHash } from "node:crypto";

function id(...parts) {
  return createHash("sha256").update(parts.join("\0")).digest("hex");
}

export function planGraphDelta({ repositoryId, changed, deleted }) {
  const deletePaths = new Set(deleted);
  const upsertFiles = [];
  const upsertSymbols = [];
  for (const file of changed) {
    if (file.previousPath) deletePaths.add(file.previousPath);
    upsertFiles.push({ id: id(repositoryId, file.path), repositoryId, path: file.path });
    const occurrences = new Map();
    for (const symbol of file.symbols) {
      const semanticKey = [symbol.language ?? "javascript", symbol.semanticContainer ?? file.path, symbol.qualifiedName, symbol.kind, symbol.signatureHash ?? ""].join("\0");
      const occurrence = (occurrences.get(semanticKey) ?? 0) + 1;
      occurrences.set(semanticKey, occurrence);
      upsertSymbols.push({
        ...symbol,
        id: id(repositoryId, symbol.language ?? "javascript", symbol.semanticContainer ?? file.path,
          symbol.qualifiedName, symbol.kind, symbol.signatureHash ?? "", occurrence),
        repositoryId,
        path: file.path,
      });
    }
  }
  return {
    deletePaths: [...deletePaths].sort(),
    upsertFiles: upsertFiles.sort((a, b) => a.path.localeCompare(b.path)),
    upsertSymbols: upsertSymbols.sort((a, b) => a.path.localeCompare(b.path) || a.lineStart - b.lineStart),
  };
}
