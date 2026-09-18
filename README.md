# IDUN

Integrating Data-lake of Unstructured Nature.

This repository contains the public research-demo. The planned site is https://dtak-upc.github.io/IDUN/ . The site is not published yet.

## Release status

The interface and GitHub Pages workflow are prepared. Independently authored synthetic data must be processed and reviewed before publishing the interactive example. Restricted MIMIC data, clinical passages derived from it, and unpublished research materials are excluded.

The public demo will show saved source evidence and separate relationship tables. Saved examples do not perform live model inference. A future protected API will support approved live integration requests; GitHub Pages does not run the Python backend.

## Build

Requires Node.js 22.12 or later.

```
npm ci
npm run check
npm run build:showcase
```

For publication, add the reviewed synthetic `site-demo/` bundle and its SHA-256 publication manifest, then use `npm run build:pages` with `IDUN_PUBLIC_BASE=/IDUN/`. The build intentionally refuses publication without that bundle. Do not substitute a development database or raw research data.

In repository Settings > Pages, choose GitHub Actions as the build source. Dispatch the Publish reviewed IDUN demo workflow only after the public bundle has passed review. The workflow does not run automatically on upload.

Keep the repository's existing GPL-3.0 LICENSE file.
