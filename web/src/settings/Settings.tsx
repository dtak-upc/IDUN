import { useEffect, useState } from "react";
import { api, post } from "../storage/api";
import "./settings.css";
type Config = {
  api_python: string;
  model_python: string;
  device: string;
  vram_gib: number;
  llm: {
    provider: string;
    base_url: string;
    model: string;
    key_env: string;
    timeout_seconds: number;
    max_output_tokens: number;
    temperature: number | null;
    top_p: number | null;
  };
};
type Info = {
  settings: Config;
  active_api_python: string;
  next_api_python: string;
  api_restart_required: boolean;
  restart_available: boolean;
  process_id: number;
  restart_error: string;
  runtime: { python: string; device: string; vram_gib: number };
  environments: { path: string; name: string }[];
  overrides: { api: boolean; model: boolean };
  key_available: boolean;
  last_discovery?: {
    device?: string;
    seconds?: number;
    peak_reserved_gib?: number;
    scored_contexts?: number;
    reused_contexts?: number;
  };
  storage: string;
};
type Probe = {
  python: string;
  version: string;
  python_supported: boolean;
  packages: Record<string, string | null>;
  cuda_available: boolean;
  cuda_build?: string;
  gpus: { name: string; total_gib: number }[];
  loki_dependencies_present: boolean;
  torch_error?: string;
};
export function Settings() {
  const [info, setInfo] = useState<Info>();
  const [draft, setDraft] = useState<Config>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [probe, setProbe] = useState<Probe>();
  const [models, setModels] = useState<string[]>([]);
  useEffect(() => {
    let active = true;
    api<Info>("/settings")
      .then((r) => {
        if (active) {
          setInfo(r);
          setDraft(r.settings);
        }
      })
      .catch((e) => {
        if (active) setError(String(e));
      });
    return () => {
      active = false;
    };
  }, []);
  async function action(label: string, fn: () => Promise<void>) {
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  }
  async function restart() {
    if (!info || !draft) return;
    await action("Restarting API", async () => {
      const previous = info.process_id;
      await post("/settings", draft);
      await post("/settings/restart");
      const deadline = Date.now() + 45000;
      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 700));
        try {
          const response = await fetch("/api/v1/settings", {
            signal: AbortSignal.timeout(1500),
          });
          if (!response.ok) continue;
          const fresh: Info = await response.json();
          if (fresh.process_id === previous) continue;
          setInfo(fresh);
          setDraft(fresh.settings);
          setProbe(undefined);
          if (fresh.restart_error) setError(fresh.restart_error);
          else
            setNotice(
              "API restarted successfully with " +
                fresh.active_api_python +
                ". Your browser session and saved lake are preserved.",
            );
          return;
        } catch {
          /* The API is expected to be briefly offline. */
        }
      }
      throw Error(
        "The API has not reconnected yet. Check the launcher terminal; you can refresh this page when it is ready.",
      );
    });
  }
  function change<K extends keyof Config>(key: K, value: Config[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setNotice("");
    if (key === "model_python") setProbe(undefined);
  }
  function llm(key: keyof Config["llm"], value: string | number | null) {
    if (draft) change("llm", { ...draft.llm, [key]: value });
    if (key !== "model") setModels([]);
  }
  const last = info?.last_discovery;
  return (
    <section className="backend-settings" aria-label="Backend settings">
      <div className="settings-heading">
        <div>
          <span className="live-kicker">YOUR LOCAL WORKSPACE</span>
          <h1>Settings</h1>
          <p>Choose how IDUN runs, and where it connects.</p>
        </div>
        {draft && (
          <button
            className="settings-save"
            disabled={!!busy}
            onClick={() =>
              action("Saving settings", async () => {
                const r = await post<Info>("/settings", draft);
                setInfo(r);
                setDraft(r.settings);
                setNotice(
                  "Settings saved. Inference settings apply to new workers; cached evidence is reused. Use Save & restart API below to apply API Python changes.",
                );
              })
            }
          >
            {busy === "Saving settings" ? "Saving…" : "Save settings"}
          </button>
        )}
      </div>
      {draft &&
        info &&
        JSON.stringify(draft) !== JSON.stringify(info.settings) && (
          <p className="settings-dirty">
            Unsaved changes · Save to apply these preferences.
          </p>
        )}
      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="settings-notice" role="status">
          {notice}
        </p>
      )}
      {!info || !draft ? (
        <p>Loading backend settings…</p>
      ) : (
        <>
          <div className="settings-runtime-summary">
            <span>
              <small>LAST RECORDED SCORING DEVICE</small>
              <strong>
                {last?.device === "cuda"
                  ? "GPU · CUDA"
                  : last?.device === "cpu"
                    ? "CPU"
                    : "No recorded run"}
              </strong>
            </span>
            <span>
              <small>PEAK RESERVED GPU MEMORY</small>
              <strong>
                {last?.peak_reserved_gib != null
                  ? `${last.peak_reserved_gib.toFixed(2)} GiB`
                  : "—"}
              </strong>
            </span>
            <span>
              <small>SCORING TIME</small>
              <strong>
                {last?.seconds != null
                  ? `${last.seconds.toFixed(2)} seconds`
                  : "—"}
              </strong>
            </span>
            <p>
              Historical model work, not live GPU utilization.
              {last?.scored_contexts === 0
                ? " The latest request reused cached evidence; it did not rescore on the GPU."
                : ""}
            </p>
          </div>
          <fieldset disabled={!!busy}>
            <div className="settings-grid">
              <section className="settings-card">
                <div className="settings-card-title">
                  <span>01</span>
                  <div>
                    <h2>Inference runtime</h2>
                    <p>LOKI discovery and the lake encoder</p>
                  </div>
                </div>
                <label>
                  Inference Python
                  <input
                    aria-label="Inference Python"
                    list="python-environments"
                    placeholder={`Automatic · ${info.runtime.python}`}
                    value={draft.model_python}
                    onChange={(e) => change("model_python", e.target.value)}
                  />
                </label>
                <datalist id="python-environments">
                  {info.environments.map((e) => (
                    <option key={e.path} value={e.path}>
                      {e.name}
                    </option>
                  ))}
                </datalist>
                <small>
                  Choose a detected environment or paste the full Python
                  executable path. Leave blank for the default model runtime.
                </small>
                {info.overrides.model && (
                  <p className="settings-warning">
                    IDUN_MODEL_PYTHON overrides the saved inference path. Remove
                    that environment override and restart to use this selection.
                  </p>
                )}
                <div className="settings-row">
                  <label>
                    Execution device
                    <select
                      aria-label="Execution device"
                      value={draft.device}
                      onChange={(e) => change("device", e.target.value)}
                    >
                      <option value="auto">
                        Automatic · CUDA if available
                      </option>
                      <option value="cuda">GPU · require CUDA</option>
                      <option value="cpu">CPU only</option>
                    </select>
                  </label>
                  <label>
                    VRAM reference (GiB)
                    <input
                      aria-label="VRAM reference"
                      type="number"
                      min="1"
                      step="0.5"
                      value={draft.vram_gib}
                      onChange={(e) =>
                        change("vram_gib", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <small>
                  Informational reference only. Inference can use the available
                  device memory; IDUN does not enforce a VRAM allocation cap.
                  Requiring CUDA fails explicitly if unavailable.
                </small>
                <button
                  onClick={() =>
                    action("Testing Python", async () => {
                      setProbe(undefined);
                      const r = await post<Probe>("/settings/runtime-probe", {
                        python: draft.model_python || info.runtime.python,
                      });
                      setProbe(r);
                    })
                  }
                >
                  {busy === "Testing Python"
                    ? "Inspecting environment…"
                    : "Test inference environment"}
                </button>
                {probe && (
                  <div className="settings-probe" role="status">
                    <strong>
                      Python {probe.version} ·{" "}
                      {probe.cuda_available
                        ? "CUDA available"
                        : "CUDA unavailable"}
                    </strong>
                    <p>
                      {probe.gpus
                        .map((g) => `${g.name} · ${g.total_gib.toFixed(1)} GiB`)
                        .join(", ") ||
                        "No CUDA GPU reported by this environment."}
                    </p>
                    <p>
                      {probe.loki_dependencies_present
                        ? "Core LOKI packages detected. Model checkpoint compatibility is verified when inference runs."
                        : "Required LOKI dependencies are missing or cannot load."}
                    </p>
                    <details>
                      <summary>Package versions and executable</summary>
                      <code>{probe.python}</code>
                      {Object.entries(probe.packages).map(([name, version]) => (
                        <p key={name}>
                          {name}: {version || "not installed"}
                        </p>
                      ))}
                    </details>
                  </div>
                )}
                <details className="settings-advanced">
                  <summary>API server Python · restart required</summary>
                  <p>
                    Currently running: <code>{info.active_api_python}</code>
                  </p>
                  <label>
                    API Python for next startup
                    <input
                      aria-label="API Python"
                      list="python-environments"
                      value={draft.api_python}
                      placeholder="Automatic"
                      onChange={(e) => change("api_python", e.target.value)}
                    />
                  </label>
                  <p>
                    Save and restart the API here. The web server stays running,
                    so your browser session is preserved.
                  </p>
                  <button disabled={!info.restart_available} onClick={restart}>
                    {busy === "Restarting API"
                      ? "Restarting and reconnecting…"
                      : "Save & restart API"}
                  </button>
                  {!info.restart_available && (
                    <p>
                      In-app restart requires the combined npm start launcher.
                      Start it once to enable this button.
                    </p>
                  )}
                  {info.api_restart_required && (
                    <p>
                      Saved API environment differs from the running process.
                      Restart pending.
                    </p>
                  )}
                  {info.overrides.api && (
                    <p>IDUN_PYTHON overrides this saved value.</p>
                  )}
                </details>
              </section>
              <section className="settings-card">
                <div className="settings-card-title">
                  <span>02</span>
                  <div>
                    <h2>LLM connection</h2>
                    <p>Local servers and compatible API providers</p>
                  </div>
                </div>
                <label>
                  Provider
                  <select
                    aria-label="LLM provider"
                    value={draft.llm.provider}
                    onChange={(e) => {
                      change("llm", {
                        ...draft.llm,
                        provider: e.target.value,
                        base_url:
                          e.target.value === "ollama"
                            ? "http://127.0.0.1:11434"
                            : e.target.value === "lm-studio"
                              ? "http://127.0.0.1:1234/v1"
                              : e.target.value === "openai-compatible"
                                ? "https://api.openai.com/v1"
                                : draft.llm.base_url,
                        key_env:
                          e.target.value === "openai-compatible"
                            ? "OPENAI_API_KEY"
                            : "",
                      });
                      setModels([]);
                    }}
                  >
                    <option value="disabled">Not configured</option>
                    <option value="ollama">Ollama</option>
                    <option value="lm-studio">LM Studio · local / LAN</option>
                    <option value="openai-compatible">
                      OpenAI-compatible API / local server
                    </option>
                  </select>
                </label>
                <label>
                  Server base URL
                  <input
                    aria-label="LLM base URL"
                    value={draft.llm.base_url}
                    onChange={(e) => llm("base_url", e.target.value)}
                  />
                </label>
                <small>
                  LM Studio and compatible APIs automatically add /v1 to a bare
                  server URL. Loopback and private LAN IPs support HTTP; public
                  servers require HTTPS. Ollama uses the server root.
                </small>
                <label>
                  API key environment variable
                  <input
                    aria-label="API key environment variable"
                    autoComplete="off"
                    value={draft.llm.key_env}
                    placeholder="e.g. OPENAI_API_KEY · blank for no authentication"
                    onChange={(e) => llm("key_env", e.target.value)}
                  />
                </label>
                <small>
                  Enter the variable’s name, not the secret. Set its value in
                  Windows user environment variables to refresh it without restarting
                  IDUN. Each connection test and LLM request reads the current value.
                  Other platforms use the backend process environment. The key stays
                  on the server and is never returned to the browser.
                </small>
                <div className="settings-row">
                  <label>
                    Model
                    <input
                      aria-label="LLM model"
                      list="llm-models"
                      value={draft.llm.model}
                      placeholder="Choose after testing, or enter a model ID"
                      onChange={(e) => llm("model", e.target.value)}
                    />
                    <datalist id="llm-models">
                      {models.map((m) => (
                        <option key={m} value={m} />
                      ))}
                    </datalist>
                  </label>
                  <label>
                    Temperature (blank = server default)
                    <input
                      aria-label="LLM temperature"
                      type="number"
                      min={0}
                      max={2}
                      step={0.05}
                      placeholder="Server default"
                      value={draft.llm.temperature ?? ""}
                      onChange={(e) =>
                        llm(
                          "temperature",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Top-p (blank = server default)
                    <input
                      aria-label="LLM top-p"
                      type="number"
                      min={0.001}
                      max={1}
                      step={0.05}
                      placeholder="Server default"
                      value={draft.llm.top_p ?? ""}
                      onChange={(e) =>
                        llm(
                          "top_p",
                          e.target.value === "" ? null : Number(e.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    Output token allowance
                    <input
                      aria-label="Output token allowance"
                      type="number"
                      min={256}
                      max={65536}
                      step={256}
                      value={draft.llm.max_output_tokens}
                      onChange={(e) =>
                        llm("max_output_tokens", Number(e.target.value))
                      }
                    />
                  </label>
                  <label>
                    Timeout (seconds)
                    <input
                      aria-label="LLM timeout"
                      type="number"
                      min="1"
                      max="60"
                      value={draft.llm.timeout_seconds}
                      onChange={(e) =>
                        llm("timeout_seconds", Number(e.target.value))
                      }
                    />
                  </label>
                </div>
                <button
                  disabled={draft.llm.provider === "disabled"}
                  onClick={() =>
                    action("Testing LLM", async () => {
                      const r = await post<{
                        models: string[];
                        selected_model_available: boolean;
                      }>("/settings/llm-test", draft.llm);
                      setModels(r.models);
                      setNotice(
                        `Connected. ${r.models.length} models listed.${draft.llm.model ? (r.selected_model_available ? " Selected model is listed." : " Selected model was not in this listing.") : ""} No lake data or inference prompt was sent.`,
                      );
                    })
                  }
                >
                  {busy === "Testing LLM"
                    ? "Connecting…"
                    : "Test connection & list models"}
                </button>
                <p className="settings-connection-note">
                  This configures the connection for the upcoming integration
                  stage. LLM-based dataset construction is not active yet.
                  Testing fetches model metadata only.
                </p>
              </section>
            </div>
          </fieldset>
          <p className="settings-footer">
            Saved locally in <code>{info.storage}/settings.json</code>. Model
            files and raw sources are unchanged.{" "}
            {busy && <span role="status">{busy}…</span>}
          </p>
        </>
      )}
    </section>
  );
}
