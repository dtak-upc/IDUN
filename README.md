# IDUN

Integrating Data-lake of Unstructured Nature.

Interactive research demonstration: https://dtak-upc.github.io/IDUN/

## Explore the example

The public site presents saved inference over four independently authored fictional CSV/TXT sources: 120 row-text links and nine joined rows across three relationship tables. Browse source evidence, follow highlighted passages and download relationship-specific CSVs. These are actual saved model outputs on a small explicit demonstration, not a benchmark or a claim of clinical accuracy.

The examples contain no real patient records, MIMIC text or unpublished paper figures. See `demo-synthetic/` for the fictional raw inputs. The saved example does not rerun models and remains available without the researcher's PC.

Live integration requires a separately hosted, access-controlled backend. It is not enabled in this public release. GitHub Pages hosts static files only.

## Build and publish

Use Node.js 22.12 or newer:

```
npm ci
npm run check
```

Set `IDUN_PUBLIC_BASE=/IDUN/`, then run `npm run build:pages`. The build validates the synthetic bundle against its approved SHA-256 manifest and packages only the static site. Never substitute a research database or raw patient data.

In Settings > Pages, select **GitHub Actions**. The **Publish reviewed IDUN demo** workflow runs on pushes to main or can be dispatched manually. Keep `.github/workflows/pages.yml` in the repository; this hidden directory must be included when uploading files.

The backend, credentials, model weights and unpublished research material are intentionally not included in this public frontend repository. See LICENSE for the repository licence.
