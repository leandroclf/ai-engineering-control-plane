#!/usr/bin/env node
import { basename, resolve } from "node:path";
import process from "node:process";

import { ContextApiClient } from "../client/context-api-client.mjs";
import { GitIndexer, InMemoryIndexStore } from "../indexer/git-indexer.mjs";
import { JavaScriptParser } from "../parsers/javascript-parser.mjs";
import { TypeScriptParser } from "../parsers/typescript-parser.mjs";
import { JavaParser } from "../parsers/java-parser.mjs";
import { PythonParser } from "../parsers/python-parser.mjs";
import { GoParser } from "../parsers/go-parser.mjs";
import { ParserRegistry } from "../parsers/parser-registry.mjs";

const directory = resolve(process.argv[2] ?? ".");
const repository = process.argv[3] ?? basename(directory);
const rebuild = process.argv.includes("--rebuild");
const token = process.env.MEMORY_SERVICE_TOKEN;
if (!token) throw new Error("MEMORY_SERVICE_TOKEN is required");

const client = new ContextApiClient({ baseUrl: process.env.MEMORY_SERVICE_URL ?? "http://127.0.0.1:8080", token });
const store = new InMemoryIndexStore();
if (!rebuild) await store.save(repository, await client.indexState(repository));
const parser = new ParserRegistry([new JavaScriptParser(), new TypeScriptParser(), new JavaParser(), new PythonParser(), new GoParser()]);
const result = await new GitIndexer({ store, parser }).sync({
  repositoryId: repository,
  directory,
  parserVersion: "polyglot-v1",
  schemaVersion: "1",
});
const response = await client.sync(repository, {
  commit: result.commit,
  parser_version: "polyglot-v1",
  schema_version: "1",
  files: result.parsed.map(({ path, oid, previousPath, symbols, references, chunks }) => ({
    path, oid, previousPath, symbols, references, chunks,
  })),
  deleted: result.deleted,
  reused: result.reused,
}, { rebuild });
process.stdout.write(`${JSON.stringify({ ...response, changed: result.changed, deleted: result.deleted }, null, 2)}\n`);
