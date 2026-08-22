function cosine(left, right) {
  if (!left?.length || left.length !== right?.length) return 0;
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const a = Math.sqrt(left.reduce((sum, value) => sum + value * value, 0));
  const b = Math.sqrt(right.reduce((sum, value) => sum + value * value, 0));
  return a && b ? dot / (a * b) : 0;
}

export class EmbeddingCache {
  constructor(embedder) {
    this.embedder = embedder;
    this.cache = new Map();
  }

  async embed(request) {
    const key = `${request.model}:${request.dimensions}:${request.contentHash}`;
    if (!this.cache.has(key)) this.cache.set(key, await this.embedder(request));
    return this.cache.get(key);
  }
}

export function hybridRetrieve({ query, queryVector, exactSymbols = [], candidates }) {
  const terms = new Set(query.toLowerCase().split(/\W+/).filter(Boolean));
  const exact = new Set(exactSymbols.map((value) => value.toLowerCase()));
  return candidates.map((candidate) => {
    const exactScore = exact.has(candidate.symbol?.toLowerCase()) ? 1 : 0;
    const haystack = `${candidate.symbol ?? ""} ${candidate.content}`.toLowerCase();
    const lexicalScore = [...terms].filter((term) => haystack.includes(term)).length;
    const vectorScore = cosine(queryVector, candidate.embedding);
    const reason = exactScore ? (lexicalScore ? "exact-symbol+lexical" : "exact-symbol") : lexicalScore ? "lexical" : "vector";
    return { ...candidate, exactScore, lexicalScore, vectorScore, reason };
  }).sort((a, b) => b.exactScore - a.exactScore || b.lexicalScore - a.lexicalScore || b.vectorScore - a.vectorScore || a.id.localeCompare(b.id));
}
