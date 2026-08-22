#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
node --input-type=module - "$root/harness/config/worker-profiles.json" <<'NODE' | while IFS=$'\t' read -r image dockerfile; do
import { readFile } from "node:fs/promises";
const config = JSON.parse(await readFile(process.argv[2], "utf8"));
for (const profile of Object.values(config.profiles)) process.stdout.write(`${profile.image}\t${profile.dockerfile}\n`);
NODE
  docker build --tag "$image" --file "$root/$dockerfile" "$root"
done
