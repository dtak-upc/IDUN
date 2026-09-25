import { useState } from "react";
import { api } from "../storage/api";
type Report = {
  memory: { measured_peak_vram_gb: number | null };
  ready_sources: number;
  unfinished_sources: number;
  engines: { name: string; status: string }[];
  input_policy: string;
};
type Prepared = {
  payload: unknown;
  excluded_columns: number;
  total: number;
  offset: number;
  header_policy: string | null;
  notice: string;
  payload_sha256: string;
};
export function InferenceReadiness() {
  const [report, setReport] = useState<Report>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function check() {
    setBusy(true);
    setError("");
    try {
      setReport(await api<Report>("/inference/readiness"));
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="inference-readiness">
      <details>
        <summary>Inference readiness</summary>
        <p>
          Check saved sources and engine setup. This does not import data or run
          a model.
        </p>
        <button disabled={busy} onClick={check}>
          {busy ? "Checking…" : "Check readiness"}
        </button>
        {error && <p role="alert">{error}</p>}
        {report && (
          <div role="status">
            <p>
              {report.ready_sources} saved sources · {report.unfinished_sources}{" "}
              sources not ready
            </p>
            <ul>
              {report.engines.map((e) => (
                <li key={e.name}>
                  <strong>{e.name}</strong>: {e.status}
                </li>
              ))}
            </ul>
            <p>{report.input_policy}</p>
            <small>
              {report.memory.measured_peak_vram_gb === null
                ? "6 GB VRAM target · Model memory not measured yet."
                : `6 GB VRAM target · Synthetic LOKI probe reserved ${report.memory.measured_peak_vram_gb.toFixed(2)} GiB. Full-lake usage not measured.`}
            </small>
          </div>
        )}
      </details>
    </section>
  );
}
export function ModelInputPreview({ assetId }: { assetId: string }) {
  const [result, setResult] = useState<Prepared>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function load(offset = 0) {
    setBusy(true);
    setError("");
    setResult(undefined);
    try {
      setResult(
        await api<Prepared>(`/inference/inputs/${assetId}?offset=${offset}`),
      );
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="model-input-preview">
      <summary>Inspect prepared model input</summary>
      <p>
        Read-only preview. Source paths, dataset groups and provenance are
        excluded from the payload.
      </p>
      <button disabled={busy} onClick={() => load()}>
        {busy ? "Preparing…" : "Prepare input preview"}
      </button>
      {error && <p role="alert">{error}</p>}
      {result && (
        <>
          <p>
            {result.excluded_columns} identifier columns excluded.{" "}
            {result.header_policy}
          </p>
          <p>{result.notice}</p>
          <pre aria-label="Prepared model payload">
            {JSON.stringify(result.payload, null, 2)}
          </pre>
          <div>
            <button
              disabled={busy || result.offset === 0}
              onClick={() => load(Math.max(0, result.offset - 20))}
            >
              Previous input records
            </button>
            <span>
              {" "}
              {result.total} records · starting at {result.offset + 1}{" "}
            </span>
            <button
              disabled={busy || result.offset + 20 >= result.total}
              onClick={() => load(result.offset + 20)}
            >
              Next input records
            </button>
          </div>
        </>
      )}
    </details>
  );
}
