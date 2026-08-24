const BASE_ALLOWLIST = new Set(["PATH", "HOME", "LANG", "LC_ALL", "TERM", "TMPDIR"]);
const FORBIDDEN = /^(?:GITHUB_TOKEN|GH_TOKEN|AWS_|GOOGLE_|AZURE_|DATABASE_URL|LITELLM_|MEMORY_SERVICE_TOKEN|HARNESS_|WORKER_MANAGER_|OPENAI_API_KEY|ANTHROPIC_API_KEY|SSH_AUTH_SOCK|NPM_TOKEN|CLAUDE_CODE_OAUTH_TOKEN)/i;

export function providerEnvironment(baseEnvironment = process.env, { extraAllowed = [] } = {}) {
  const allowed = new Set([...BASE_ALLOWLIST, ...extraAllowed]);
  return Object.fromEntries(Object.entries(baseEnvironment).filter(([name, value]) => allowed.has(name) && !FORBIDDEN.test(name) && value !== undefined));
}

export function forbiddenProviderEnvironmentNames(environment) {
  return Object.keys(environment ?? {}).filter((name) => FORBIDDEN.test(name));
}
