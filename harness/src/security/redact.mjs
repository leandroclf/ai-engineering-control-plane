const patterns = [
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /\bsk-[A-Za-z0-9_-]{8,}/g,
  /\b(?:OPENAI|ANTHROPIC|GEMINI|LITELLM|MEMORY|HARNESS)_[A-Z0-9_]*(?:KEY|TOKEN|SECRET)\s*[=:]\s*[^\s,;]+/gi,
  /\bAICP_FAKE_SECRET_[A-Za-z0-9_]+/g,
];

export function redactText(value) {
  return patterns.reduce((text, pattern) => text.replace(pattern, "[REDACTED]"), String(value ?? ""));
}

export function redactValue(value) {
  if (typeof value === "string") return redactText(value);
  if (Array.isArray(value)) return value.map(redactValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, redactValue(item)]));
  }
  return value;
}
