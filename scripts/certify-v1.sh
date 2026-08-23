#!/usr/bin/env bash
set -euo pipefail

npm ci
npm run validate
npm run test:architecture
npm run test:integration
npm run test:e2e:mock-gateway
npm run test:adversarial
npm run test:budget-adversarial
npm run test:worker-e2e
npm run test:multistack
npm run validate:supply-chain
npm run build:owned-images
npm run scan:owned-images
npm run validate:model-catalog
npm run validate:version-contract
npm run validate:benchmark
npm run validate:benchmark-results
npm run release:evaluate
