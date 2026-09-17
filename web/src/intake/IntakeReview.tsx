import { useEffect, useMemo, useState } from "react";
import type { Intake } from "./useIntake";
import type { Asset, Encoding } from "./types";
import { sizeLabel, statusLabel } from "./types";
const PAGE_SIZE = 25;
const eligible = (a: Asset) =>
  a.inspection === "ready" &&
  !["queued", "uploading", "uploaded"].includes(a.transfer);
export function IntakeReview({ intake, lakeName }: { intake: Intake; lakeName?: string }) {
  const { assets, remove, retry, start, cancel } = intake;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<string[]>([]);
  const [focused, setFocused] = useState<string>();

  useEffect(() => {
    setSelected((current) =>
      current.filter((id) => assets.some((a) => a.id === id)),
    );
  }, [assets.length]);
  const filtered = assets.filter(
    (a) =>
      a.sourcePath.toLocaleLowerCase().includes(query.toLocaleLowerCase()) &&
      (filter === "all" ||
        (filter === "csv" && /\.csv$/i.test(a.file.name)) ||
        (filter === "text" && /\.txt$/i.test(a.file.name)) ||
        (filter === "attention" &&
          (a.inspection === "failed" || a.transfer === "failed"))),
  );
  const maxPage = Math.max(0, Math.ceil(filtered.length / PAGE_SIZE) - 1);
  const currentPage = Math.min(page, maxPage);
  const visible = filtered.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE,
  );
  const active = visible.find((a) => a.id === focused) ?? visible[0];
  const digestCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((a) => {
      if (a.preview?.digest)
        counts.set(a.preview.digest, (counts.get(a.preview.digest) ?? 0) + 1);
    });
    return counts;
  }, [assets]);
  const nameCounts = useMemo(() => {
    const counts = new Map<string, number>();
    assets.forEach((a) =>
      counts.set(a.file.name, (counts.get(a.file.name) ?? 0) + 1),
    );
    return counts;
  }, [assets]);
  const selectedAssets = assets.filter((a) => selected.includes(a.id));
  const candidates = selected.length
    ? selectedAssets.filter(eligible)
    : assets.filter(eligible);
  const errors = assets.filter(
    (a) => a.inspection === "failed" || a.transfer === "failed",
  ).length;
  const inspected = assets.filter((a) => a.inspection === "ready").length;
  const running = assets.filter((a) =>
    ["queued", "uploading"].includes(a.transfer),
  );
  function run() {
    start(candidates.map((a) => a.id));
  }
  return (
    <section className="intake-review" aria-labelledby="inventory-title">
      <div className="inventory-heading">
        <div>
          <span className="eyebrow">Know your sources</span>
          <h2 id="inventory-title">
            Review your lake <span>{assets.length} files</span>
          </h2>
          <p>
            {inspected} previews ready
            {errors > 0 ? ` · ${errors} need attention` : ""} ·{" "}
            {sizeLabel(assets.reduce((n, a) => n + a.file.size, 0))} selected
          </p>
        </div>
        <button
          className="text-button"
          onClick={() => {
            remove(assets.map((a) => a.id));
            setSelected([]);
          }}
        >
          Clear all files
        </button>
      </div>
      <div className="review-toolbar">
        <label className="search-field">
          <span>Search files</span>
          <input
            type="search"
            placeholder="Find a source by filename or path…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label className="filter-field">
          <span>Show</span>
          <select
            aria-label="Filter files"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setPage(0);
            }}
          >
            <option value="all">All files</option>
            <option value="csv">CSV tables</option>
            <option value="text">Text documents</option>
            <option value="attention">Needs attention</option>
          </select>
        </label>
      </div>
      <div className="review-layout">
        <div className="inventory-panel">
          <div className="selection-toolbar">
            <label>
              <input
                type="checkbox"
                checked={
                  visible.length > 0 &&
                  visible.every((a) => selected.includes(a.id))
                }
                disabled={!visible.length}
                onChange={(e) =>
                  setSelected((current) =>
                    e.target.checked
                      ? [...new Set([...current, ...visible.map((a) => a.id)])]
                      : current.filter(
                          (id) => !visible.some((a) => a.id === id),
                        ),
                  )
                }
              />{" "}
              Select this page
            </label>
            <span>{selected.length} selected</span>
            {selected.length > 0 && (
              <button
                className="text-button"
                onClick={() => {
                  remove(selected);
                  setSelected([]);
                }}
              >
                Remove selected
              </button>
            )}
          </div>
          <ul className="asset-list" aria-label="Raw files">
            {visible.map((asset) => {
              const exact =
                asset.preview?.digest &&
                (digestCounts.get(asset.preview.digest) ?? 0) > 1;
              return (
                <li
                  key={asset.id}
                  className={
                    active?.id === asset.id
                      ? "asset-row selected-row"
                      : "asset-row"
                  }
                >
                  <input
                    type="checkbox"
                    aria-label={`Select ${asset.file.name}`}
                    checked={selected.includes(asset.id)}
                    onChange={(e) =>
                      setSelected((current) =>
                        e.target.checked
                          ? [...current, asset.id]
                          : current.filter((id) => id !== asset.id),
                      )
                    }
                  />
                  <button
                    className="asset-open"
                    aria-label={`Preview ${asset.file.name}`}
                    aria-pressed={active?.id === asset.id}
                    onClick={() => setFocused(asset.id)}
                  >
                    <span className="asset-type">
                      {/\.csv$/i.test(asset.file.name)
                        ? "CSV"
                        : /\.txt$/i.test(asset.file.name)
                          ? "TXT"
                          : "FILE"}
                    </span>
                    <span className="asset-info">
                      <strong>{asset.file.name}</strong>
                      {asset.sourcePath !== asset.file.name && (
                        <span className="asset-path">{asset.sourcePath}</span>
                      )}
                      <span className="asset-meta">
                        {sizeLabel(asset.file.size)}
                        {(nameCounts.get(asset.file.name) ?? 0) > 1
                          ? " · Shared filename"
                          : ""}
                        {exact ? " · Identical content" : ""}
                      </span>
                      <span
                        className={`asset-state ${asset.inspection === "failed" || asset.transfer === "failed" ? "state-error" : ""}`}
                      >
                        {statusLabel(asset)}
                      </span>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`Remove ${asset.file.name}`}
                    onClick={() => remove([asset.id])}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
          {!visible.length && (
            <div className="no-results">
              <h3>No matching files</h3>
              <p>Try a different filename or filter.</p>
              <button
                className="text-button"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Reset filters
              </button>
            </div>
          )}
          <div className="pagination">
            <span>
              {filtered.length
                ? `${currentPage * PAGE_SIZE + 1}–${Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} of ${filtered.length}`
                : "0 files"}
            </span>
            <div>
              <button
                aria-label="Previous page"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                ←
              </button>
              <span>
                Page {currentPage + 1} of {maxPage + 1}
              </span>
              <button
                aria-label="Next page"
                disabled={currentPage >= maxPage}
                onClick={() => setPage(currentPage + 1)}
              >
                →
              </button>
            </div>
          </div>
        </div>
        {active ? (
          <AssetPreview
            key={active.id}
            asset={active}
            sameContent={
              !!active.preview?.digest &&
              (digestCounts.get(active.preview.digest) ?? 0) > 1
            }
            sameName={(nameCounts.get(active.file.name) ?? 0) > 1}
            retry={retry}
            start={start}
            cancel={cancel}
          />
        ) : (
          <aside className="source-preview no-preview">
            Choose a source to inspect its contents.
          </aside>
        )}
      </div>
      <section className="transfer-preview" aria-labelledby="simulation-title">
        <div>
          <span className="eyebrow">Local storage</span>
          <h3 id="simulation-title">{lakeName ? `Save to ${lakeName}` : "Save to your data lake"}</h3>
          <label className="dataset-name-input">
            Dataset name{" "}
            <input
              aria-label="Dataset name"
              maxLength={120}
              value={intake.datasetName}
              disabled={intake.datasetLocked}
              onChange={(e) => intake.setDatasetName(e.target.value)}
            />
          </label>
          <p>
            Upload original bytes to the local Python service and index records.
            Saved files survive browser and service restarts.
          </p>
        </div>
        <div className="transfer-actions">
          <button
            className="primary"
            disabled={!candidates.length || !intake.datasetName.trim()}
            onClick={run}
          >
            {selected.length ? "Save selected files" : "Save ready files"}
            {candidates.length > 0 ? ` (${candidates.length})` : ""}
          </button>
          {running.length > 0 && (
            <button
              className="text-button"
              onClick={() => running.forEach((a) => cancel(a.id))}
            >
              Cancel pending saves
            </button>
          )}
          <span>
            {assets.filter((a) => a.transfer === "uploaded").length} saved files
            · Persisted on this machine
          </span>
        </div>
      </section>
    </section>
  );
}
function AssetPreview({
  asset,
  sameContent,
  sameName,
  retry,
  start,
  cancel,
}: {
  asset: Asset;
  sameContent: boolean;
  sameName: boolean;
  retry: Intake["retry"];
  start: Intake["start"];
  cancel: Intake["cancel"];
}) {
  const [encoding, setEncoding] = useState<Encoding>(asset.encoding);
  const preview = asset.preview;
  return (
    <aside
      className="source-preview"
      aria-label={`Source preview: ${asset.file.name}`}
    >
      <div className="preview-heading">
        <span className="eyebrow">Source preview</span>
        <h3>{asset.file.name}</h3>
        {asset.sourcePath !== asset.file.name && (
          <p className="source-path">{asset.sourcePath}</p>
        )}
        <div className="preview-meta">
          <span>{sizeLabel(asset.file.size)}</span>
          {preview && (
            <>
              <span>{preview.encoding.toUpperCase()}</span>
              <span>{preview.sampled ? "Sampled file" : "Local preview"}</span>
            </>
          )}
        </div>
      </div>
      {sameName && (
        <p className="source-note">
          This filename is shared by another entry. Each file is kept
          separately.
        </p>
      )}
      {sameContent && (
        <p className="source-note">
          Another file has identical content. Both are retained; a duplicate is
          not independent evidence.
        </p>
      )}
      {asset.inspection === "failed" ? (
        <div className="file-error" role="alert">
          <strong>We couldn’t preview this file</strong>
          <p>{asset.error}</p>
        </div>
      ) : !preview ? (
        <div className="reading-state" role="status">
          {asset.inspection === "queued"
            ? "Waiting to inspect this file…"
            : "Reading a bounded preview…"}
        </div>
      ) : (
        <>
          <div className="preview-caption">
            {preview.kind === "csv"
              ? `Raw records · ${preview.delimiter === "\t" ? "tab" : preview.delimiter === ";" ? "semicolon" : preview.delimiter === "," ? "comma" : preview.delimiter} delimiter · No header assumed`
              : "Original text excerpt"}
          </div>
          {preview.kind === "csv" ? (
            <div
              className="raw-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Scrollable raw CSV records"
            >
              <table className="raw-table">
                <thead>
                  <tr>
                    <th scope="col">Record</th>
                    {Array.from(
                      { length: Math.min(preview.columns, 12) },
                      (_, i) => (
                        <th key={i} scope="col">
                          Field {i + 1}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {preview.records.map((row, i) => (
                    <tr key={i}>
                      <th scope="row">{i + 1}</th>
                      {Array.from(
                        { length: Math.min(preview.columns, 12) },
                        (_, j) => (
                          <td key={j}>
                            {row[j] ?? (
                              <span className="missing-field">Absent</span>
                            )}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre
              className="raw-text"
              tabIndex={0}
              aria-label="Raw text excerpt"
            >
              {preview.text}
            </pre>
          )}
          <p className="preview-footnote">
            {preview.kind === "csv"
              ? `${preview.records.length} records displayed. Original values are preserved; no type conversion.`
              : `${preview.text.length.toLocaleString()} characters displayed.`}{" "}
            {sizeLabel(preview.bytesRead)} read for preview.
          </p>
          {preview.warnings.length > 0 && (
            <ul className="preview-warnings">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </>
      )}
      <div className="encoding-control">
        <label htmlFor={`encoding-${asset.id}`}>Preview encoding</label>
        <div>
          <select
            id={`encoding-${asset.id}`}
            value={encoding}
            onChange={(e) => setEncoding(e.target.value as Encoding)}
            disabled={asset.transfer !== "idle"}
          >
            <option value="auto">Auto (UTF-8 / UTF-16 BOM)</option>
            <option value="utf-8">UTF-8</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="utf-16be">UTF-16 BE</option>
            <option value="windows-1252">Windows-1252</option>
          </select>
          <button
            className="secondary"
            disabled={
              asset.transfer !== "idle" || asset.inspection === "inspecting"
            }
            onClick={() => retry(asset.id, encoding)}
          >
            {asset.inspection === "failed" ? "Retry preview" : "Reinspect"}
          </button>
        </div>
      </div>
      {preview && (
        <div className="file-transfer">
          <span className="eyebrow">Local ingestion</span>
          <p role="status">{statusLabel(asset)}</p>
          {asset.transfer === "uploading" && (
            <progress
              aria-label={`Upload progress for ${asset.file.name}`}
              max={100}
              value={asset.progress}
            />
          )}{" "}
          {asset.transferError && (
            <p className="error-text" role="alert">
              {asset.transferError}
            </p>
          )}
          {["uploading", "queued"].includes(asset.transfer) ? (
            <button className="secondary" onClick={() => cancel(asset.id)}>
              Cancel save
            </button>
          ) : asset.transfer === "uploaded" ? (
            <small>
              Original bytes and indexed records are saved on this machine.
            </small>
          ) : (
            <button className="secondary" onClick={() => start([asset.id])}>
              {asset.transfer === "idle" ? "Save this file" : "Retry save"}
            </button>
          )}
        </div>
      )}
    </aside>
  );
}
