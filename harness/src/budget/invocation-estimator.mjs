import { normalizeUsage } from "./budget-policy.mjs";

export class ConservativeTokenizer {
  count(value) {
    return Math.max(0, Math.ceil(Buffer.byteLength(String(value ?? ""), "utf8") / 4));
  }
}

export class InvocationEstimator {
  constructor({ tokenizer = new ConservativeTokenizer(), pricingCatalog, safetyMargin = 1.2, fixedOverheadTokens = 512 } = {}) {
    if (!pricingCatalog?.pricesFor) throw new TypeError("pricingCatalog.pricesFor is required");
    if (!Number.isFinite(safetyMargin) || safetyMargin < 1) throw new TypeError("safetyMargin must be >= 1");
    this.tokenizer = tokenizer;
    this.pricingCatalog = pricingCatalog;
    this.safetyMargin = safetyMargin;
    this.fixedOverheadTokens = fixedOverheadTokens;
  }

  async estimate({ alias, prompt, contextTokenCount = 0, schema = {}, toolSchemas = [], maxOutputTokens = 4096, maxPhysicalAttempts = 1, accountingMode = "metered-api" }) {
    if (!Number.isInteger(maxPhysicalAttempts) || maxPhysicalAttempts < 1) throw new TypeError("maxPhysicalAttempts must be a positive integer");
    const promptTokens = await this.tokenizer.count(prompt);
    const schemaTokens = await this.tokenizer.count(JSON.stringify({ response: schema, tools: toolSchemas }));
    // The rendered prompt normally contains context. max() prevents counting it twice while
    // still reserving the compiler's authoritative token count if the rendering estimate is low.
    const knownInput = Math.max(promptTokens, Number(contextTokenCount) || 0) + schemaTokens + this.fixedOverheadTokens;
    const inputTokens = Math.ceil(knownInput * this.safetyMargin);
    if (["subscription", "subscription-credit"].includes(accountingMode)) {
      return normalizeUsage({ calls: 1, inputTokens: inputTokens * maxPhysicalAttempts, outputTokens: maxOutputTokens * maxPhysicalAttempts, costUsd: 0 });
    }
    const prices = await this.pricingCatalog.pricesFor(alias);
    if (!Array.isArray(prices) || !prices.length || prices.some((price) =>
      !Number.isFinite(price?.inputPerToken) || !Number.isFinite(price?.outputPerToken)
    )) throw Object.assign(new Error(`PRICING_UNKNOWN:${alias}`), { name: "PricingUnknownError", alias });
    const costUsd = Math.max(...prices.map((price) =>
      inputTokens * price.inputPerToken + maxOutputTokens * price.outputPerToken
    ));
    return normalizeUsage({ calls: 1, inputTokens: inputTokens * maxPhysicalAttempts, outputTokens: maxOutputTokens * maxPhysicalAttempts, costUsd: costUsd * maxPhysicalAttempts });
  }
}

export class RoutingPricingCatalog {
  constructor(routes = {}, environment = process.env) { this.routes = structuredClone(routes); this.environment = environment; }
  modelsFor(alias) { return this.routes[alias]?.deployments?.map((item) => item.model ?? this.environment[item.modelEnv]).filter(Boolean) ?? []; }
  pricesFor(alias) {
    return this.routes[alias]?.deployments?.map(({ inputPerMillion, outputPerMillion, inputPerMillionEnv, outputPerMillionEnv }) => ({
      inputPerToken: Number(inputPerMillion ?? this.environment[inputPerMillionEnv]) / 1_000_000,
      outputPerToken: Number(outputPerMillion ?? this.environment[outputPerMillionEnv]) / 1_000_000,
    })) ?? [];
  }
}
