# Validation: site-lf-solucoes

Date: 2026-08-21

## Source

- Repository: `https://github.com/leandroclf/site-lf-solucoes.git`
- Branch: `main`
- Commit: `21990535336d5ab20fb6983bd85f3c8a5e0c64c4`
- Execution mode: governed local checkout under ignored `projects/`

## Detected profile

Static website published through GitHub Pages, with native Python quality
scripts and Lighthouse CI configuration. The repository has no `package.json`;
the empty lockfile is used by GitHub Actions only for npm cache setup.

## Harness result

Command:

```bash
npm run validate:project -- --project projects/site-lf-solucoes
```

| Gate | Result | Evidence |
|---|---|---|
| `structure` | PASS | Menus, local links and About section valid |
| `quality-smoke` | PASS | Basic SEO/accessibility passed for 12 HTML files |
| `performance-budget` | PASS | Largest HTML page 40,358 bytes; per-page limit 50,000 bytes |
| `accountability` | PASS | Five eligible tasks, zero violations, 100% coverage |
| JavaScript syntax | PASS | All JavaScript files accepted by `node --check` |

Terminal Harness result: `pass`.

The false aggregate-HTML budget was corrected to measure each navigation
independently. Commit `2199053` was validated and pushed to `main`; no deployment
was performed by the Control Plane.

## Context/index evidence

The persistent pipeline indexed the repository through the authenticated API:

- first successful rebuild: 7 JavaScript files, 128 symbols and 128 chunks;
- unchanged second run: zero files parsed and zero embeddings requested;
- exact symbol `bootDashboard` ranked first as `exact-symbol+lexical`;
- context package used 526 of a 1,000-token calculated budget;
- after deleting the Neo4j projection and stopping Redis, `--rebuild` restored
  1 repository, 7 files, 128 symbols and 128 chunks using cached embeddings.

## Deferred evidence

- Lighthouse was not run locally because its CLI is not installed and adding a
  dependency was not authorized. Its three-page quality gate remains available
  in the source repository CI configuration.
- Semgrep, Gitleaks, Trivy and Sonar Scanner are not installed locally.
- Snyk is installed but was not executed because cloud integration and data
  transfer are optional and have not been authorized.

## Outcome

The real-project exercise closed both the Harness compatibility gap and the
incorrect performance-budget semantics. It also proves persistent incremental
indexing, exact-symbol retrieval and graph recovery against a non-fixture
repository.
