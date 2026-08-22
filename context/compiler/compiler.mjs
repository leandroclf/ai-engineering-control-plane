export function compileContext({ candidates, budget }) {
  if (!Number.isInteger(budget) || budget < 0) throw new TypeError("budget must be a non-negative integer");
  const seen = new Set();
  const artifacts = [];
  let tokenCount = 0;

  const ordered = [...candidates].sort((left, right) =>
    left.priority - right.priority || left.id.localeCompare(right.id),
  );
  for (const candidate of ordered) {
    if (seen.has(candidate.contentHash)) continue;
    seen.add(candidate.contentHash);
    if (tokenCount + candidate.tokens > budget) continue;
    artifacts.push({ ...candidate });
    tokenCount += candidate.tokens;
  }
  return { artifacts, tokenCount, budget };
}
