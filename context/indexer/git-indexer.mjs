import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { join } from "node:path";

import { planIncrementalIndex } from "./incremental-index.mjs";

const exec = promisify(execFile);

export class InMemoryIndexStore {
  constructor() {
    this.repositories = new Map();
    this.blobs = new Map();
  }

  async load(repositoryId) {
    return new Map(this.repositories.get(repositoryId) ?? []);
  }

  async save(repositoryId, records) {
    this.repositories.set(repositoryId, new Map(records));
    for (const [path, record] of records) this.blobs.set(record.oid, { ...record, path });
  }

  findByOid(oid) {
    return this.blobs.get(oid);
  }
}

export class GitIndexer {
  constructor({ store, parser }) {
    this.store = store;
    this.parser = parser;
  }

  async sync({ repositoryId, directory, parserVersion, schemaVersion }) {
    const [{ stdout: listing }, { stdout: commit }] = await Promise.all([
      exec("git", ["ls-files", "-s"], { cwd: directory }),
      exec("git", ["rev-parse", "HEAD"], { cwd: directory }),
    ]);
    const files = listing.trim().split("\n").filter(Boolean).map((line) => {
      const match = line.match(/^\d+ ([a-f0-9]+) \d+\t(.+)$/);
      if (!match) throw new Error(`unsupported git index entry: ${line}`);
      return { oid: match[1], path: match[2] };
    }).filter((file) => !this.parser.supports || this.parser.supports(file.path));
    const previous = await this.store.load(repositoryId);
    const plan = planIncrementalIndex(previous, files, { parserVersion, schemaVersion });
    const records = new Map();
    const parsed = [];
    for (const file of files) {
      const known = previous.get(file.path);
      if (!plan.changed.includes(file.path)) {
        records.set(file.path, known);
        continue;
      }
      const priorBlob = this.store.findByOid(file.oid);
      const artifacts = priorBlob?.artifacts ?? await this.parser.parse({
        ...file, absolutePath: join(directory, file.path), repositoryId,
      });
      const previousPath = [...previous.entries()].find(([path, value]) => path !== file.path && value.oid === file.oid)?.[0];
      const record = { oid: file.oid, parserVersion, schemaVersion, artifacts, commit: commit.trim() };
      records.set(file.path, record);
      parsed.push({ ...file, previousPath, ...artifacts });
    }
    await this.store.save(repositoryId, records);
    return { ...plan, parsed, commit: commit.trim() };
  }
}
