import { createHash } from "node:crypto";

function positivePrice(environment, name) {
  const value = Number(environment[name]);
  return Number.isFinite(value) && value >= 0;
}

export class RoutingPolicy {
  constructor(catalog, environment = process.env) {
    if (catalog?.schemaVersion !== 1 || !catalog.aliases) throw new TypeError("validated model catalog is required");
    this.catalog = structuredClone(catalog);
    this.environment = environment;
  }

  decide({ alias, role = "producer", producerProvider = null }) {
    const route = this.catalog.aliases[alias];
    if (!route) throw Object.assign(new Error(`ROUTE_UNKNOWN:${alias}`), { name: "RoutingPolicyError" });
    const configured = route.deployments.filter((item) => this.environment[item.modelEnv]);
    const priced = configured.filter((item) => positivePrice(this.environment, item.inputPerMillionEnv) && positivePrice(this.environment, item.outputPerMillionEnv));
    if (configured.length !== priced.length) throw Object.assign(new Error(`PRICING_UNKNOWN:${alias}`), { name: "PricingUnknownError" });
    let eligible = priced;
    if (role === "reviewer" && route.requireProviderDiversity && producerProvider) eligible = priced.filter((item) => item.provider !== producerProvider);
    if (!eligible.length) throw Object.assign(new Error(`ROUTE_UNAVAILABLE:${alias}`), { name: "RoutingPolicyError" });
    const deployments = eligible.map(({ id, provider, modelEnv }) => ({ id, provider, model: this.environment[modelEnv], gatewayAlias: `${alias}-${provider}` }));
    const payload = { policyVersion: this.catalog.policyVersion, alias, capabilityClass: route.class, role, producerProvider, deployments };
    return Object.freeze({ decisionId: createHash("sha256").update(JSON.stringify(payload)).digest("hex"), ...payload, selected: deployments[0] });
  }
}
