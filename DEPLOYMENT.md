# IDUN static workspace

This package uses the same React UI as the local application. Saved-result operations run inside a Python WebAssembly worker in the visitor's browser. No Python API service is deployed.

## Updating GitHub Pages

Upload the contents of this folder to `dtak-upc/IDUN`, preserving the existing `.github/workflows/pages.yml`. Keep the repository's current README and logo. The workflow installs dependencies, builds with `/IDUN/` as the base path, and deploys `.idun/showcase-build` to Pages.

Upload **all** files in `site-demo`, including Doc2DB's three numbered archive parts. Each file is below GitHub's web-upload size limit. `publication.json` verifies their hashes during the build. Do not upload `node_modules`, generated `.idun` build directories, local databases, research folders, model weights or credentials.

The package includes current saved results for Dummy, Doc2DB and Disease A–Z. MIMIC is excluded. Disease A–Z originates from [the THOR dataset repository](https://github.com/dtak-upc/THOR/tree/main/Dataset/Disease%20A-Z); retain its source attribution. No evaluation gold schema is used as application input.

## Visitor workspaces

Visitors can inspect tables and documents, browse existing Discovery evidence, review and edit saved Integration results, materialize and export existing proposals, inspect Augmentation results, and construct, refine, query and export knowledge graphs. New model inference and source imports require a backend and are disabled here.

Edits and saved queries persist privately in IndexedDB in that browser. They do not change the published examples or another visitor's workspace. Clearing this site's browser storage resets those edits. Publishing a changed lake snapshot starts a fresh copy for that lake; previous edits are not automatically migrated.

The runtime and selected lake load on first use. Doc2DB has a larger initial download because all its saved evidence is retained. A desktop browser is recommended for this large workspace.

## Local checks

With Node 24 or newer:

```sh
npm ci
npm run build:pages
npm run test:workspace
npm run test:browser
```

For the browser check, build with `IDUN_PUBLIC_BASE=/IDUN/`. The browser test uses locally installed Chrome, starts a static server on port 5197, and makes no requests to an inference API.
