import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

export class ScannerBundleAttestor {
  constructor({ manifest, root = process.cwd(), now = () => new Date() }) {
    if (manifest?.schemaVersion !== 1) throw new TypeError("scanner bundle v1 manifest is required");
    this.manifest = structuredClone(manifest);
    this.root = root;
    this.now = now;
  }

  async attest(scanner) {
    if (scanner === "semgrep" || scanner === "gitleaks") {
      const item = this.manifest[scanner];
      const actual = await sha256(resolve(this.root, scanner === "semgrep" ? item.rulesPath : item.configPath));
      if (!/^[a-f0-9]{64}$/.test(item.sha256) || actual !== item.sha256) throw Object.assign(new Error(`SCANNER_BUNDLE_HASH_MISMATCH:${scanner}`), { name: "ScannerBundleError" });
      return { bundleVersion: this.manifest.bundleVersion, sha256: actual, offline: true };
    }
    if (scanner === "trivy") {
      const runtime = JSON.parse(await readFile(resolve(this.root, this.manifest.trivy.runtimeManifestPath), "utf8"));
      const dbPath = resolve(this.root, this.manifest.trivy.cachePath, "db/trivy.db");
      const actual = await sha256(dbPath);
      const ageHours = (this.now().getTime() - new Date(runtime.downloadedAt).getTime()) / 3_600_000;
      if (runtime.schemaVersion !== 1 || actual !== runtime.dbSha256 || !Number.isFinite(ageHours) || ageHours < 0 || ageHours > this.manifest.trivy.maxAgeHours) throw Object.assign(new Error("SCANNER_BUNDLE_STALE:trivy"), { name: "ScannerBundleError" });
      return { bundleVersion: this.manifest.bundleVersion, sha256: actual, downloadedAt: runtime.downloadedAt, ageHours, offline: true };
    }
    throw new TypeError(`unsupported scanner bundle: ${scanner}`);
  }
}

