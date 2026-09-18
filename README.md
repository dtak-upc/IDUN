# IDUN

A browser workspace for raw-lake discovery, integration and augmentation. **Step 09 runs live contextual LOKI discovery over indexed candidates and exposes source evidence.** The compact white UI is accepted.

## Run locally

Requires Node.js 24+ and Python 3.11+ (verified: Node 24.15 / Python 3.13.9 / Chrome on Windows). The storage API uses Python's standard library. Profiling and LOKI require the separate Step 07 model runtime and pinned local artifacts.

### Automated fresh machine setup
When setting up on a new machine without Node.js 24 or Python pre-configured:
- **Windows**: Run `setup.cmd` or simply double-click `Start IDUN.cmd`. It automatically detects if Node.js 24 is available; if missing or on an older version, it provisions Node.js 24 (via winget or standalone runtime), installs npm dependencies, and configures the Python environment via `uv sync`.
- **macOS / Linux**: Run `./setup.sh` or `./Start\ IDUN.sh` (or double-click `Start IDUN.command` on macOS). It ensures Node.js 24 is installed (via NVM, FNM, Homebrew, or standalone binary) and bootstraps all dependencies.

### Manual start

```sh
npm install
npm start
```

Open http://127.0.0.1:5173. `npm start` runs the Python API on loopback port 8787 and Vite on 5173. Alternatively use two terminals: `npm run api` and `npm run dev`. The combined launcher resolves Python automatically (the existing local model runtime first, then PATH), waits for API health before starting Vite, and keeps the web port fixed at 5173. `IDUN_PYTHON` can override this with an absolute Python executable. Keep the launch terminal running while using IDUN.

On this host the global npm wrapper is broken. Use the installed CLI directly:

```powershell
$env:IDUN_PYTHON = 'C:/Users/SHAON/anaconda3/python.exe'
node 'C:/Program Files/nodejs/node_modules/npm/bin/npm-cli.js' start
```

The development Vite proxy forwards `/api/v1` to the local backend. `npm run build` checks TypeScript and bundles the frontend; a standalone production-hosting configuration is not included yet. The API is intended for loopback development only, not public hosting.

## Real data-lake workflow

Imports are manual only, including internal debugging. Nothing is seeded on startup. Choose files or nested folders, inspect local previews, name the dataset (the current import group), then choose **Save ready files**. Files are streamed to the local backend and parsed in ingestion jobs. **Saved data lake** lists persisted sources, allows search and bounded record paging, and downloads unchanged original bytes. Reloading the browser clears unsaved staging, but saved sources remain. Removing a staged file only clears that browser entry.

Storage defaults to `.idun/`: SQLite metadata/indexes, immutable SHA-256 blobs and temporary upload parts. Override with `python backend/server.py --storage PATH`. This folder is ignored by version control and contains the actual source data. Back it up while the API is stopped. Filter by dataset to remove an entire import group, or select individual saved files across pages and choose **Remove selected**. A confirmation shows the affected files and storage impact. Removal deletes IDUN copies, parsed records and jobs; original files on disk are untouched. Shared raw content is retained until its last saved owner is removed. Active jobs must finish or be cancelled first.

Cancelled/failed/interrupted jobs can retry. Parsing retries reuse stored raw bytes; incomplete uploads require their original staged file, or a new selection. Interrupted nonterminal jobs are marked on API restart. Failed/partial indexes are not exposed as ready sources. The latest 100 jobs are visible under Ingestion jobs; all events remain in SQLite.

Raw files are limited to 1 GiB, CSV fields to 1 MiB and decoded CSV records to 8 MiB/4096 fields. These limits produce explicit errors. CSV headers remain raw first records; values and types are not normalized. TXT offsets are Unicode code points in the decoded text, end exclusive. Asset + content/encoding/parser version + record index identifies stored rows/chunks. Preview display is bounded; downloads preserve full bytes.

The earlier assistant-imported 516 copies have been removed from IDUN at the researcher’s request. The catalog now contains only subsequent manual imports; `Datasets/mimic_100` remains available for manual selection. The automatic tree-import helper has been retired.

## Verification

- `npm test`: 25 frontend fixture/intake/policy checks.
- `npm run test:backend`: 40 isolated backend tests.
- `npm run test:readiness`: manual synthetic browser selection and backend model-input inspection.
- `npm run test:removal`: browser file selection into isolated storage; dataset naming, partial/whole removal, confirmation and shared-content preservation.
- `npm run test:storage`: real browser saves/reload/download against an isolated test API on 8789.
- `npm run test:discovery`, `npm run test:evidence`, `npm run test:augmentation`: illustrative UI checks.

Browser checks need Vite running and `IDUN_BROWSER_EXECUTABLE` pointing to Chrome, or Playwright Chromium installed. The storage check starts its own Python service; set `IDUN_PYTHON` when Python's PATH wrapper cannot be spawned. If the test service is started separately with `python backend/server.py --port 8789 --storage .idun-browser-test`, set `IDUN_TEST_EXTERNAL_API=1`. Test storage is separate from the real lake. Historical simulation/Atlas checks are obsolete and are not the current intake verification.

## Boundaries and plans

Discover and Evidence now expose real LOKI results; synthetic examples remain labeled and separate. Integration and Activity still include illustrative scenarios. Saving files does not automatically run inference. No annotation access or source-pair input is required. Protected identifier columns/known values and source paths/names are excluded from retrieval and model inputs. Semantic LLM integration is available; THOR augmentation remains a future step.

[Global plan](docs/implementation/global-plan.md) · [Step 06 plan](docs/implementation/steps/06.md) · [Step 06 walkthrough](docs/implementation/walkthroughs/06.md) · [Manual imports and removal](docs/implementation/walkthroughs/06-iteration-2.md) · [System proposal](docs/IDUN-system-proposal.md)

## Inference readiness

Open a saved source and expand **Inspect prepared model input** to view projected CSV/TXT content. Identifier columns and source metadata are excluded; known identifier values are masked without changing raw files. This is a preparation preview, not model inference. The **Inference readiness** panel reports saved sources and recorded model probes. Models never load or download on startup.

The supplied LOKI checkpoint passed strict loading and a synthetic GPU probe (0.668 GiB peak PyTorch reserved memory for that small case). THOR language pipelines passed CPU dependency/offset checks. Live indexed-candidate inference and memory measurements are recorded in Step 09. See the [Step 07 walkthrough](docs/implementation/walkthroughs/07.md) for artifact pins, compatibility adjustments, setup commands and limitations.

## Automatic profiling

In Data Lake, use **Understand your lake → Profile saved lake**. Indexing runs in the background with progress and cancellation. Existing profiles and embeddings are reused; changed sources are reprocessed. Inspect source only changes the displayed view.

Candidate search uses persistent SQLite FTS5 and semantic LSH passage indices, with bounded shortlists and up to five documents per table. The previous all-pairs implementation has been removed. Retrieval inputs exclude folder associations, source names and protected identifiers. Candidate cards show row/passage cues and remain unverified.

The UI reports representative coverage and work reused. Up to 32 row representatives per table and 128 passage representatives per document are indexed, with a wider bucket lookup when initial support is insufficient. The first build still scans source content; this is not a claim of exhaustive recall or distributed scale.

The local Step 07 encoder runtime is required for new embeddings. Set IDUN_MODEL_PYTHON if its interpreter is elsewhere. CUDA is used when available with a bounded allocator budget; otherwise encoding uses CPU. Models never download at startup. Saved-source removal deletes its cached profiles, vectors and postings; policy changes invalidate affected cache keys.

`npm run test:profiling` verifies manual browser intake, hybrid retrieval and cache reuse against isolated synthetic storage. [Current walkthrough](docs/implementation/walkthroughs/08-iteration-3.md).

## Live LOKI discovery

After profiling the saved lake, open **Discover → Run LOKI discovery**. Inspect score-sorted row–text links or shared-text bridges to see projected source rows and text offsets. Runs support progress, cancellation, persisted results and context reuse. Changes to sources or candidate contexts make evidence stale; source removal clears published evidence.

LOKI scores joint contexts of up to eight candidate tables (32 indexed row representatives each) and 128 text units. Larger document contexts are split; bridges are derived only within the same context. The default checkpoint threshold, 0.15, is uncalibrated for this lake. Scores are not probabilities or validated joins. At most three links per row, twelve links per bridge group and 2,000 bridge candidates are retained; the UI reports omissions. No row–sentence annotations are read.

`npm run test:loki` exercises manual synthetic browser intake, real LOKI, bridge evidence, cache reuse, persistence and mobile layout using isolated storage. `node scripts/verify-saved-discovery.cjs` runs against already manually saved sources without importing anything. Both require the Step 07 local model artifacts and runtime.

[Step 09 plan](docs/implementation/steps/09.md) · [Step 09 walkthrough](docs/implementation/walkthroughs/09.md).

### Real evidence workbench

Open a live link or bridge in Evidence. Select a table or document and adjust **Top K candidates** (1–20) to browse opposite-modality sources ranked by their highest retained LOKI link score. Select a candidate and evidence link to synchronize highlighted CSV rows with their original text spans. Shared-text bridges show both source tables. Browsing does not rerun inference; identifiers remain excluded/masked. Text excerpts and table context are bounded and described in the panel. `npm run test:real-workbench` verifies the read-only workflow against existing saved results.

## Backend settings

Open **Settings** in the application navigation. Select a detected Python environment or paste its full executable path, test its installed packages/CUDA availability, choose automatic/CUDA-required/CPU execution, and record an optional VRAM reference (informational only; no allocator cap). Changes apply to new LOKI/embedding workers; cached results are reused and retain their historical scoring-device measurements. CUDA-required mode fails if CUDA is unavailable.

The API Python under advanced runtime settings takes effect after restarting `npm start`. The combined launcher reads `.idun/settings.json`; an explicit `IDUN_PYTHON` override takes precedence. `IDUN_MODEL_PYTHON` similarly overrides the saved inference executable. The API and inference interpreters are separate. Preserve virtual-environment executable paths when choosing environments. No packages or model weights are automatically installed.

LLM connection options support **Direct In-Process Hugging Face models**, Ollama, LM Studio and OpenAI-compatible servers. Set the base URL, model ID, timeout and API-key **environment-variable name**. For Hugging Face models, models run in-process with PyTorch and 4-bit NF4 quantization (`bitsandbytes`) without requiring external server processes. Set the actual secret in the backend environment before launching IDUN; IDUN does not store or return the key. HTTP is allowed for loopback and private LAN IP addresses; public providers require HTTPS. Bare LM Studio and compatible server URLs automatically gain /v1. Connection testing only fetches model metadata, rejects redirects, and never sends lake data. LLM dataset integration is available in Integration (Step 10 refinement).

### Direct In-Process Hugging Face Runtime & VRAM Management

Under **Settings → LLM Provider → Hugging Face**, IDUN provides a built-in model manager:
- **Curated Models**: Pre-configured support for Qwen 2.5 (3B / 1.5B Instruct), Phi 3.5 Mini (3.8B), Gemma 2 (2B), and Llama 3.2 (3B / 1B). Custom Hugging Face repository IDs can also be downloaded directly to local cache.
- **Non-blocking Downloads**: Model snapshots are downloaded asynchronously in the background via `huggingface_hub` with live MB progress reporting and thread cancellation.
- **4-Bit NF4 Quantization**: When CUDA is available, models execute with `bitsandbytes` 4-bit NormalFloat quantization, dramatically reducing VRAM overhead while preserving reasoning quality.
- **VRAM Lifecycle & Unloading**:
  - **Live VRAM Tracking**: Settings and the Integration header report active in-memory models and allocated VRAM.
  - **Manual Unload**: A one-click **Unload from VRAM** button is available in Settings and directly inside the Integration header to immediately free GPU memory without interrupting your session.
  - **Auto-Unload by Default**: The setting **"Automatically unload model from VRAM after inference"** is enabled by default (`auto_unload: true`), cleanly releasing GPU memory once relationship probing or semantic integration proposals conclude.

Model listing contracts: [Ollama](https://docs.ollama.com/api/tags) and [OpenAI API](https://developers.openai.com/api/reference/resources/models/methods/list). `npm run test:settings` checks runtime diagnostics and a loopback metadata fixture without saving main-workspace preferences. The isolated real-LOKI browser test also saves a CUDA runtime and budget through Settings before manual synthetic file selection.

### Restart from Settings

Settings is at the top-right of the workspace. Expand **API server Python**, select the executable, then choose **Save & restart API**. The managed `npm start` launcher replaces the API while keeping Vite and the browser session alive; Settings reconnects automatically. The saved lake is preserved. Finish or cancel active ingestion/indexing/discovery first. If running the API separately, launch through `npm start` once to enable this control. The launcher preflights the selected Python and attempts recovery with the previous environment after a failed replacement startup.

`npm run test:restart` exercises a real restart using the currently saved preferences and checks browser/session and saved-job preservation. Run only when the development service is idle.

## Semantic integration (Step 10, refinement)

Open **Integration → Propose with LLM** after current LOKI discovery. The clinical profile detects diagnosis and medication columns from projected content. It extracts complementary row-pair paths, groups mediator passages, ranks them with the pinned GTE cross-encoder, clusters score-weighted LOKI contextual sentence embeddings, then uses the configured LLM to type clinical relationships. No patient/admission keys, filenames, folder associations or annotation files become inference inputs.

### Emergent Relationship Discovery & Dynamic Schema Builder (Step 10.S)

Before running full integration, open the **Schema & Predicates** studio to tailor relationship typing to your dataset:
- **Pre-Inference Probe**: Samples representative candidate join paths across LOKI clusters and queries the active LLM to surface emergent domain predicates (e.g. `PROPHYLAXIS_FOR`, `DOSE_TITRATED_FOR`, `SYMPTOMATIC_RELIEF`) grounded in exact narrative quotes.
- **Schema Modes**:
  - *Strict Schema*: Classifies evidence strictly against chosen clinical predicates (`TREATS`, `ADVERSE_EFFECT`, `DISCONTINUED`, etc.) using dynamic JSON Schema validation.
  - *Hybrid Mode*: Uses the chosen schema as primary targets while allowing the model to propose novel grounded relationships when supported by exact quotes.
  - *Fully Open Mode*: Discovers free-form canonical UPPER_SNAKE_CASE relationship predicates directly from narrative evidence.
- **Interactive Predicates**: Add custom user-defined relationship predicates with bespoke definitions; enable or disable suggestions based on observed frequencies and quote previews.

The default budget is 12 row pairs (1–100 selectable) from a bounded, document-diverse pool of 256. Request timeouts are 60/120/300 seconds in the UI. Review the joined table, relationship filters, contextual pair plot and every passage-level decision. **All source columns** exposes both projected records. Materialization persists one row per source-row pair, mediator document and supported relationship; CSV includes projected columns and exact evidence references. Clinical labels remain model proposals. Negative, uncertain, medication-list-only and conflicting decisions remain in review rather than positive output.

The cross-encoder/HDBSCAN worker runs in the Python selected in Settings. It needs scikit-learn, sentence-transformers and `Alibaba-NLP/gte-reranker-modernbert-base` revision `f7481e6055501a30fb19d090657df9ec1f79ab2c`. The current workspace has this model under `.idun/models/gte-reranker`; the worker also supports an existing pinned Hugging Face cache. Runtime never downloads missing weights automatically. LOKI and the cross-encoder run sequentially under the selected CUDA/CPU policy without an enforced VRAM cap; HDBSCAN runs on CPU. Ranking and LLM responses are cached for repeat proposals; removed source data invalidates dependent artifacts and clears semantic caches.

`node scripts/verify-integration.cjs` runs a real proposal on already imported data and checks materialization/export/evidence navigation. Set `IDUN_REUSE_PROPOSAL=1` to review the latest proposal without requesting another. `node scripts/verify-integration-fixture.cjs` manually imports synthetic files into isolated storage and verifies the workflow with explicit model doubles.

[Stage 10 refinement walkthrough](docs/implementation/walkthroughs/10-refinement.md) · [Stage 10.S schema walkthrough](docs/implementation/walkthroughs/10-relationship-tables.md) · [Hugging Face runtime & VRAM walkthrough](docs/implementation/walkthroughs/10-hf-model-manager-and-vram-lifecycle.md). The earlier concept-equality operator has been retired.

The small-lake coverage refinement preserves identical source-row occurrences, indexes up to 256 eligible rows / 1,024 eligible text units per source, and uses overlapping bounded LOKI windows. Larger-source sampling remains explicit. Reranking uses the original diagnosis/medication anchor query and ranks candidates by evidence score before the labeling budget. Paragraph context accompanies original sentence anchors; three distinct contextual passages are selected after reranking.

`python scripts/audit-join-reference.py --annotations Datasets/Annotated_Test.json` is a separate, read-only reference audit for the single-patient development example. Annotation files are never imported or used by inference. The private report distinguishes missing index coverage, retained join paths, pool/selection limits and missing labels; it measures agreement with supplied annotations, not certified clinical accuracy.

LLM Settings also exposes **Output token allowance**, **Temperature**, and **Top-p**. Blank sampling fields preserve server defaults. Changing sampling parameters invalidates label-response reuse; complete responses can be reused after increasing only the output allowance. The current researcher-selected allowance is 40,000 tokens. Token/context exhaustion is reported separately from invalid JSON; the server's own context window still applies.

After a completed run, `node scripts/verify-semantic-review.cjs` checks the real result without importing or running inference. Set `IDUN_MATERIALIZE_REVIEW=1` to additionally materialize/export the reviewed result. Real inference browser tests allow up to 30 minutes by default, configurable with `IDUN_INTEGRATION_TEST_TIMEOUT_MS`.

## Opening IDUN without typing npm start

On Windows, double-click `Start IDUN.cmd`. It opens an existing instance or starts IDUN and opens the browser. Keep its window open; Ctrl+C stops the services. This remains the local development launcher. Public hosting is being prepared separately; do not expose the local administrator API or Vite server.
