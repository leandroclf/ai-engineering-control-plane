export class EnvironmentSecretProvider {
  constructor(environment = process.env) { this.environment = environment; }
  async resolve(reference) {
    if (!reference?.startsWith("env:")) throw new Error("SECRET_REFERENCE_INVALID");
    const name = reference.slice(4); if (!/^[A-Z][A-Z0-9_]*$/.test(name) || !this.environment[name]) throw new Error("SECRET_UNAVAILABLE");
    return this.environment[name];
  }
}
