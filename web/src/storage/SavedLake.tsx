import { apiUrl } from "./api";
import { savedDemo } from "../mode";
import { ModelInputPreview } from "../inference/Readiness";
import { useEffect, useState } from "react";
import { api, post, type Job } from "./api";
import "./storage.css";
type Dataset = { id: string; name: string; files: number; bytes: number };
type Removal = {
  token: string;
  files: number;
  bytes: number;
  reclaimable_bytes: number;
  shared_blobs_retained: number;
  asset_ids: string[];
  sample_paths: string[];
  dataset_id?: string;
  removed?: number;
  cleanup_pending?: number;
};
type Catalog = {
  total: number;
  matched: number;
  offset: number;
  assets: Job[];
};
type RecordView = {
  id: string;
  index: number;
  start: number | null;
  end: number | null;
  value: string | string[];
  clipped: boolean;
};
type Preview = {
  version: string;
  total: number;
  offset: number;
  records: RecordView[];
  offsetUnit: string;
};
export function SavedLake({ onCount }: { onCount: (count: number) => void }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [removal, setRemoval] = useState<Removal>();
  const [removing, setRemoving] = useState(false);
  const [removalNotice, setRemovalNotice] = useState("");
  const [catalog, setCatalog] = useState<Catalog>();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Job>();
  const [rowPage, setRowPage] = useState(0);
  const [preview, setPreview] = useState<Preview>();
  const [revision, setRevision] = useState(0);
  const [actionError, setActionError] = useState("");
  const [encodings, setEncodings] = useState<Record<string, string>>({});
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function refresh() {
      try {
        const [c, j, groups] = await Promise.all([
          api<Catalog>(
            `/assets?q=${encodeURIComponent(query)}&offset=${page * 25}&dataset=${encodeURIComponent(dataset)}`,
          ),
          api<{ jobs: Job[] }>("/jobs"),
          api<{ datasets: Dataset[] }>("/datasets"),
        ]);
        if (active) {
          setCatalog(c);
          setDatasets(groups.datasets);
          onCount(c.total);
          setJobs(j.jobs);
          setError("");
        }
      } catch (e) {
        if (active) setError((e as Error).message);
      } finally {
        if (active) timer = setTimeout(refresh, 2500);
      }
    }
    void refresh();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, page, revision, dataset]);
  useEffect(() => {
    let active = true;
    setPreview(undefined);
    if (selected)
      void api<Preview>(
        `/assets/${selected.asset_id}/preview?offset=${rowPage * 20}`,
      )
        .then((p) => {
          if (active) setPreview(p);
        })
        .catch((e) => {
          if (active) setActionError(e.message);
        });
    return () => {
      active = false;
    };
  }, [selected, rowPage, revision]);
  async function action(job: Job, verb: string) {
    setActionError("");
    try {
      await post(
        `/jobs/${job.id}/${verb}`,
        verb === "retry" ? { encoding: encodings[job.id] || job.encoding } : {},
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function previewRemoval(
    scope: { dataset_id: string } | { asset_ids: string[] },
  ) {
    setActionError("");
    setRemovalNotice("");
    try {
      setRemoval(await post<Removal>("/removals/preview", scope));
    } catch (e) {
      setActionError((e as Error).message);
    }
  }
  async function confirmRemoval() {
    if (!removal || removing) return;
    setRemoving(true);
    setActionError("");
    try {
      const scope = removal.dataset_id
        ? { dataset_id: removal.dataset_id }
        : { asset_ids: removal.asset_ids };
      const result = await post<Removal>("/removals/apply", {
        ...scope,
        token: removal.token,
      });
      if (selected && removal.asset_ids.includes(selected.asset_id)) {
        setSelected(undefined);
        setPreview(undefined);
      }
      setChecked([]);
      setRemoval(undefined);
      setPage(0);
      if (removal.dataset_id) setDataset("");
      setRemovalNotice(
        `${result.removed} saved files removed from IDUN. Original files on your computer were not changed.${result.cleanup_pending ? " Some unreferenced stored bytes still need cleanup." : ""}`,
      );
      setRevision((r) => r + 1);
    } catch (e) {
      setActionError((e as Error).message);
    } finally {
      setRemoving(false);
    }
  }
  return (
    <section className="saved-lake" aria-label="Persisted raw data lake">
      <div className="saved-heading">
        <div>
          <h2>
            Saved data lake <span>{catalog?.total ?? "—"} files</span>
          </h2>
          <p>{savedDemo ? "Synthetic source records" : "Original bytes on this machine · No discovery inference has run"}</p>
        </div>
        <button className="secondary" onClick={() => setRevision((r) => r + 1)}>
          Refresh saved files
        </button>
      </div>
      {error ? (
        <p className="storage-error" role="status">
          {error}
        </p>
      ) : (
        <>
          <div className="saved-tools">
            <label>
              Find saved sources
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(0);
                }}
                placeholder="Filename or source path"
              />
            </label>
            <span>{catalog?.matched ?? 0} matching sources</span>
          </div>
          <div className="saved-removal-tools">
            <label>
              Dataset{" "}
              <select
                aria-label="Saved dataset"
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setPage(0);
                  setChecked([]);
                }}
              >
                <option value="">All datasets</option>
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.files} files)
                  </option>
                ))}
              </select>
            </label>
            <label>
              <input
                type="checkbox"
                aria-label="Select this saved page"
                checked={
                  !!catalog?.assets.length &&
                  catalog.assets.every((a) => checked.includes(a.asset_id))
                }
                onChange={(e) =>
                  setChecked((c) =>
                    e.target.checked
                      ? [
                          ...new Set([
                            ...c,
                            ...(catalog?.assets.map((a) => a.asset_id) || []),
                          ]),
                        ]
                      : c.filter(
                          (id) =>
                            !catalog?.assets.some((a) => a.asset_id === id),
                        ),
                  )
                }
              />{" "}
              Select this page
            </label>
            <button
              className="remove-saved"
              disabled={savedDemo || !checked.length || removing}
              onClick={() => previewRemoval({ asset_ids: checked })}
            >
              Remove selected ({checked.length})
            </button>
            <button
              className="remove-saved"
              disabled={savedDemo || !dataset || removing}
              onClick={() => previewRemoval({ dataset_id: dataset })}
            >
              Remove entire dataset
            </button>
          </div>
          {removalNotice && (
            <p role="status" className="removal-notice">
              {removalNotice}
            </p>
          )}
          {removal && (
            <section
              className="removal-confirmation"
              role="alertdialog"
              aria-labelledby="removal-title"
              aria-describedby="removal-description"
            >
              <h3 id="removal-title">Remove {removal.files} saved files?</h3>
              <p id="removal-description">
                This permanently removes these copies, parsed records and
                ingestion jobs from IDUN. Original files in your folders are
                untouched.
              </p>
              <p>
                {removal.bytes.toLocaleString()} source bytes ·{" "}
                {removal.reclaimable_bytes.toLocaleString()} bytes can be freed
                · {removal.shared_blobs_retained} shared content blobs retained.
              </p>
              <ul>
                {removal.sample_paths.map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
              {removal.files > 5 && (
                <small>
                  And {removal.files - 5} more files in this selection.
                </small>
              )}
              <div>
                <button
                  className="remove-saved"
                  disabled={removing}
                  onClick={confirmRemoval}
                >
                  {removing ? "Removing…" : "Confirm removal"}
                </button>
                <button
                  className="secondary"
                  disabled={removing}
                  onClick={() => setRemoval(undefined)}
                >
                  Keep files
                </button>
              </div>
            </section>
          )}
          <div className="saved-layout">
            <div>
              <ul className="saved-files">
                {catalog?.assets.map((a) => (
                  <li key={a.asset_id} className="saved-file-selectable">
                    <input
                      type="checkbox"
                      aria-label={`Select saved ${a.path}`}
                      checked={checked.includes(a.asset_id)}
                      onChange={(e) =>
                        setChecked((c) =>
                          e.target.checked
                            ? [...c, a.asset_id]
                            : c.filter((id) => id !== a.asset_id),
                        )
                      }
                    />
                    <button
                      aria-label={`Open saved ${a.path}`}
                      aria-pressed={selected?.asset_id === a.asset_id}
                      onClick={() => {
                        setSelected(a);
                        setRowPage(0);
                        setActionError("");
                      }}
                    >
                      <strong>{a.name}</strong>
                      <small>{a.path}</small>
                      <span>
                        {a.size.toLocaleString()} bytes · {a.records}{" "}
                        {a.name.toLowerCase().endsWith(".csv")
                          ? "raw records"
                          : "text chunks"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {catalog?.total === 0 && (
                <p>
                  No saved files yet. Choose files or folders above, then save
                  them from the local review.
                </p>
              )}
              <div className="saved-pages">
                <button
                  aria-label="Previous saved files"
                  disabled={!page}
                  onClick={() => setPage((p) => p - 1)}
                >
                  ←
                </button>
                <span>
                  Page {page + 1} of{" "}
                  {Math.max(1, Math.ceil((catalog?.matched ?? 0) / 25))}
                </span>
                <button
                  aria-label="Next saved files"
                  disabled={(page + 1) * 25 >= (catalog?.matched ?? 0)}
                  onClick={() => setPage((p) => p + 1)}
                >
                  →
                </button>
              </div>
            </div>
            <div className="saved-preview">
              {selected ? (
                <>
                  <div className="saved-preview-heading">
                    <h3>{selected.name}</h3>
                    {!savedDemo && <a
                      href={apiUrl(`/assets/${selected.asset_id}/raw`)}
                      download
                    >
                      Download original bytes
                    </a>}
                  </div>
                  <p>
                    Stored source preview · Names and paths are provenance, not
                    model inputs.
                  </p>
                  {preview ? (
                    <>
                      <div
                        className="stored-records"
                        role="region"
                        aria-label="Stored records"
                        tabIndex={0}
                      >
                        <ModelInputPreview
                          key={selected.asset_id}
                          assetId={selected.asset_id}
                        />
                        {preview.records.map((r) => (
                          <div key={r.id} className="stored-record">
                            <small title={r.id}>
                              {Array.isArray(r.value) ? "Row" : "Chunk"}{" "}
                              {r.index}
                              {r.start !== null
                                ? ` · characters ${r.start}–${r.end}`
                                : ""}
                            </small>
                            {Array.isArray(r.value) ? (
                              <div className="stored-cells">
                                {r.value.map((v, i) => (
                                  <span key={i}>{v || <em>Empty</em>}</span>
                                ))}
                              </div>
                            ) : (
                              <pre>{r.value}</pre>
                            )}
                            {r.clipped && (
                              <small>
                                Display shortened; original data is unchanged.
                              </small>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="saved-pages">
                        <button
                          aria-label="Previous stored records"
                          disabled={!rowPage}
                          onClick={() => setRowPage((p) => p - 1)}
                        >
                          ←
                        </button>
                        <span>
                          {rowPage * 20 + 1}–
                          {Math.min((rowPage + 1) * 20, preview.total)} of{" "}
                          {preview.total}
                        </span>
                        <button
                          aria-label="Next stored records"
                          disabled={(rowPage + 1) * 20 >= preview.total}
                          onClick={() => setRowPage((p) => p + 1)}
                        >
                          →
                        </button>
                      </div>
                      <details>
                        <summary>Stable provenance references</summary>
                        <p>
                          Asset: <code>{selected.asset_id}</code>
                        </p>
                        <p>
                          Version: <code>{preview.version}</code>
                        </p>
                        <p>
                          {preview.offsetUnit}. Row IDs use the asset, version
                          and one-based record index. CSV headers are preserved
                          as raw records.
                        </p>
                      </details>
                    </>
                  ) : (
                    <p>Loading stored records…</p>
                  )}
                </>
              ) : (
                <p>Select a saved source to read its persisted records.</p>
              )}
            </div>
          </div>
          <details className="ingestion-jobs">
            <summary>Ingestion jobs · latest {jobs.length}</summary>
            <p>
              Cancelled uploads without stored bytes need the original file
              selected again. Failed parsing can retry from stored bytes.
            </p>
            {jobs.map((j) => (
              <div key={j.id}>
                <strong>{j.name}</strong>
                <span>
                  {j.status} · {j.received}/{j.size} bytes · {j.records} records
                </span>
                {j.error && <p>{j.error}</p>}
                {["failed", "interrupted", "cancelled"].includes(j.status) ? (
                  <>
                    <label>
                      Retry encoding{" "}
                      <select
                        aria-label={`Retry encoding for ${j.name}`}
                        value={encodings[j.id] || j.encoding}
                        onChange={(e) =>
                          setEncodings((v) => ({
                            ...v,
                            [j.id]: e.target.value,
                          }))
                        }
                      >
                        {[
                          "auto",
                          "utf-8",
                          "utf-16le",
                          "utf-16be",
                          "windows-1252",
                        ].map((enc) => (
                          <option key={enc}>{enc}</option>
                        ))}
                      </select>
                    </label>
                    <button onClick={() => action(j, "retry")}>
                      Retry {j.name}
                    </button>
                  </>
                ) : (
                  !["ready"].includes(j.status) && (
                    <button onClick={() => action(j, "cancel")}>
                      Cancel {j.name}
                    </button>
                  )
                )}
              </div>
            ))}
          </details>
        </>
      )}
      {actionError && (
        <p className="storage-error" role="alert">
          {actionError}
        </p>
      )}
    </section>
  );
}
