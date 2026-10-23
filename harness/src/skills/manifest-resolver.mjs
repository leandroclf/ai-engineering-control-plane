import { createHash } from "node:crypto";

const VALID_DISCLOSURE = new Set(["metadata", "summary", "on-demand"]);

function normalize(value) { return String(value ?? "").toLowerCase(); }

export class SkillManifestRegistry {
  constructor(configuration = { schemaVersion: 1, manifests: [] }) {
    if (configuration.schemaVersion !== 1 || !Array.isArray(configuration.manifests)) throw new TypeError("skill manifest registry v1 is required");
    this.manifests = configuration.manifests.map((manifest) => {
      if (!manifest.id || !manifest.version || !manifest.knowledge?.source || !VALID_DISCLOSURE.has(manifest.knowledge.disclosure)) throw new TypeError("invalid skill manifest");
      return Object.freeze({ ...manifest, capabilities: [...new Set(manifest.capabilities ?? [])].sort(), manifestHash: createHash("sha256").update(JSON.stringify(manifest)).digest("hex") });
    });
  }

  list() { return this.manifests.map((manifest) => ({ ...manifest })); }

  resolve({ capabilities = [], query = "", limit = 5 } = {}) {
    const terms = normalize(query).split(/\s+/).filter(Boolean);
    return this.manifests.map((manifest) => {
      const capabilityScore = capabilities.filter((capability) => manifest.capabilities.includes(capability)).length * 2;
      const text = normalize(`${manifest.id} ${(manifest.appliesWhen ?? []).join(" ")}`);
      const lexicalScore = terms.filter((term) => text.includes(term)).length;
      return { manifest, score: capabilityScore + lexicalScore };
    }).filter(({ score }) => score > 0 || !capabilities.length && !terms.length)
      .sort((left, right) => right.score - left.score || left.manifest.id.localeCompare(right.manifest.id))
      .slice(0, limit)
      .map(({ manifest }) => ({ id: manifest.id, version: manifest.version, capabilities: manifest.capabilities, source: manifest.knowledge.source, disclosure: manifest.knowledge.disclosure, manifestHash: manifest.manifestHash }));
  }
}
