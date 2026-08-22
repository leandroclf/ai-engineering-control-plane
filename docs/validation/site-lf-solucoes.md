# Validation: site-lf-solucoes

Date: 2026-08-21

## Source

- Repository: `https://github.com/leandroclf/site-lf-solucoes.git`
- Branch: `main`
- Commit: `3389682f548d075c35a484a952007215afcc0511`
- Execution mode: read-only shallow clone under ignored `projects/`

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
| `performance-budget` | FAIL | HTML 206,523 bytes; limit 170,000; excess 36,523 bytes |
| `accountability` | PASS | Five eligible tasks, zero violations, 100% coverage |
| JavaScript syntax | PASS | All JavaScript files accepted by `node --check` |

Terminal Harness result: `blocked`.

The source checkout remained clean after validation. No repair, branch, commit,
push or deployment was performed.

## Deferred evidence

- Lighthouse was not run locally because its CLI is not installed and adding a
  dependency was not authorized. Its three-page quality gate remains available
  in the source repository CI configuration.
- Semgrep, Gitleaks, Trivy and Sonar Scanner are not installed locally.
- Snyk is installed but was not executed because cloud integration and data
  transfer are optional and have not been authorized.

## Outcome

The real-project exercise identified and closed a Harness compatibility gap:
project gate detection can now support static sites with native Python scripts
without inventing a `package.json` or reporting absent commands as successful.
The performance finding belongs to the target project and requires explicit
authorization before a repair branch is created.
