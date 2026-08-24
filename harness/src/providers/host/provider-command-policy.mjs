import { ProviderError, PROVIDER_ERROR_CODES } from "../provider-errors.mjs";

const COMMANDS = Object.freeze({ "codex-subscription": "codex", "claude-code-subscription": "claude" });
const FORBIDDEN = /(?:danger-full-access|(?:^|\s)(?:sh|bash|zsh|fish|eval|sudo|su|mount|nsenter|docker|ssh)(?:\s|$))/i;

export class ProviderCommandPolicy {
  constructor({ commands = COMMANDS } = {}) { this.commands = { ...commands }; }
  validate({ providerId, executable, args = [] }) {
    if (this.commands[providerId] !== executable) throw new ProviderError(PROVIDER_ERROR_CODES.POLICY_DENIED, `provider executable is not allowed for ${providerId}`);
    if (!Array.isArray(args) || args.some((arg) => typeof arg !== "string")) throw new TypeError("provider argv must contain strings");
    if (args.some((arg) => FORBIDDEN.test(arg))) throw new ProviderError(PROVIDER_ERROR_CODES.POLICY_DENIED, "provider command contains forbidden capability");
    return Object.freeze({ executable, args: [...args] });
  }
}
