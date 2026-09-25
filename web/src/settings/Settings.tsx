import { useEffect, useState } from "react";
import { api, post } from "../storage/api";
import { useTheme } from "../theme";
import "../storage/lakes.css";
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
    auto_unload?: boolean;
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

type HFModel = {
  repo_id: string;
  name: string;
  params: string;
  vram_estimate: string;
  gated: boolean;
  recommended: boolean;
  description: string;
  downloaded: boolean;
  loaded?: boolean;
  size_str: string;
  size_on_disk: number;
  format?: string;
  compatible?: boolean;
};

type HFLoadedInfo = {
  loaded: boolean;
  repo_id: string;
  vram_mb: number;
};

type HFDownloadStatus = {
  status: "idle" | "downloading" | "completed" | "error";
  repo_id: string;
  message: string;
  percent: number;
  error: string;
  started_at?: number;
};

type ModelBundleVersion = {
  id: string;
  name: string;
  default?: boolean;
};

type ModelBundle = {
  bundle_id: string;
  name: string;
  adapter_id: string;
  retrieval_encoder: string;
  scoring_model: string;
  reranker: string;
  dimensions: number;
  description: string;
  path?: string;
  downloadable?: boolean;
  versions?: ModelBundleVersion[];
  validation?: {
    bundle_id: string;
    valid: boolean;
    status: string;
    real_checkpoint_available: boolean;
    errors: string[];
    fixture_fallback_available?: boolean;
    resolved_path?: string;
    missing_files?: string[];
    versions?: ModelBundleVersion[];
    active_version?: string;
    size_str?: string;
    size_on_disk?: number;
  };
};

type BundleDownloadStatus = {
  status: "idle" | "downloading" | "completed" | "error";
  step?: string;
  bundle_id?: string;
  version?: string;
  message?: string;
  percent?: number;
  downloaded_mb?: number;
  total_mb?: number;
  error?: string;
};

type HubModel = {
  id: string;
  name: string;
  repo_id?: string;
  dimensions?: number;
  token_limit?: number;
  recommended?: boolean;
  description: string;
  estimated_size_mb?: number;
  ready: boolean;
  size_bytes?: number;
  size_str?: string;
  missing_files?: string[];
  builtin?: boolean;
  is_active?: boolean;
  versions?: Array<{
    id: string;
    name: string;
    default?: boolean;
    ready: boolean;
    size_bytes?: number;
    size_str?: string;
    missing_files?: string[];
  }>;
};

type HubStep = {
  title: string;
  description: string;
  default_model: string;
  models: HubModel[];
};

type ModelsHubStatus = {
  hub_root: string;
  steps: {
    step1_profiling: HubStep;
    step2_discovery: HubStep;
    step3_cross_attention: HubStep;
    step4_llm: HubStep;
  };
  download_status: BundleDownloadStatus;
};

type ModelProbeReport = {
  bundle_id: string;
  name: string;
  version?: string;
  dimensions: number;
  strict_load: boolean;
  synthetic_probe: boolean;
  repeatable: boolean;
  rows: number;
  sentences: number;
  device: string;
  device_name: string;
  peak_reserved_gb: number | null;
  seconds: number;
  torch: string;
  dtype: string;
  status: string;
};

type PromptPreset = {
  prompt_id: string;
  name: string;
  description: string;
  mode: "strict" | "hybrid" | "open";
  labels: string[];
  definitions: Record<string, string>;
  template?: string;
  is_default?: boolean;
  revision?: string;
};

type LakeConfig = {
  version: string;
  revision: string;
  updated: number;
  bundle_id: string;
  bundle_version?: string;
  prompt_id: string;
  schema_config: {
    prompt_id?: string;
    mode: "strict" | "hybrid" | "open";
    labels: string[];
    definitions: Record<string, string>;
  };
  candidate_policy: {
    policy_id: string;
    max_candidates: number;
    allow_same_table: boolean;
    context_window_tokens?: number;
    context_window_chars: number;
    profiling_top_k?: number;
    discovery_row_limit?: number | null;
  };
  projection_policy: {
    policy_id: string;
    exclude_identifiers: string[];
    null_tokens: string[];
    mask_identifier_values: boolean;
  };
  context_config: {
    mode: "none" | "sampled_context" | "user_examples";
    sampled_context: any;
    examples: Array<{
      record_a: string;
      record_b: string;
      relationship: string;
      direction: string;
      passage: string;
      quote_a: string;
      quote_b: string;
      reason?: string;
    }>;
  };
};

type ImpactPreview = {
  has_impact: boolean;
  impacts: string[];
  invalidated_stages: string[];
  current_revision?: string;
};

type ResetPreview = {
  lake_id: string;
  db_bytes: number;
  db_size_mb: number;
  vector_bytes: number;
  vector_size_mb: number;
  total_derived_size_mb: number;
  sources_count: number;
  records_count: number;
  derived_counts: Record<string, number>;
  total_derived_rows: number;
};

type ResetResult = {
  status: string;
  lake_id: string;
  db_size_before_mb: number;
  db_size_after_mb: number;
  reclaimed_bytes: number;
  reclaimed_mb: number;
  keep_sources: boolean;
};

type Props = {
  activeLake?: string;
};

export function Settings({ activeLake }: Props = {}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [activeSection, setActiveSection] = useState<"models" | "prompts" | "context" | "policies">("models");

  // Global environment & LLM info
  const [info, setInfo] = useState<Info>();
  const [draft, setDraft] = useState<Config>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [probe, setProbe] = useState<Probe>();
  const [models, setModels] = useState<string[]>([]);
  const [llmTestResult, setLlmTestResult] = useState<{
    status: "idle" | "testing" | "success" | "error";
    message: string;
  }>({ status: "idle", message: "" });

  // Hugging Face models
  const [hfModels, setHfModels] = useState<HFModel[]>([]);
  const [hfLoaded, setHfLoaded] = useState<HFLoadedInfo>({ loaded: false, repo_id: "", vram_mb: 0 });
  const [hfUnloading, setHfUnloading] = useState(false);
  const [hfStatus, setHfStatus] = useState<HFDownloadStatus>({
    status: "idle",
    repo_id: "",
    message: "",
    percent: 0,
    error: "",
  });
  const [customRepo, setCustomRepo] = useState("");
  const [hfLoading, setHfLoading] = useState(false);

  // Model bundles & probe
  const [bundles, setBundles] = useState<ModelBundle[]>([]);
  const [modelProbeReport, setModelProbeReport] = useState<ModelProbeReport | null>(null);
  const [probeLoading, setProbeLoading] = useState(false);
  const [bundleDownloadStatus, setBundleDownloadStatus] = useState<BundleDownloadStatus>({
    status: "idle",
    bundle_id: "",
    version: "",
    message: "",
    percent: 0,
    downloaded_mb: 0,
    total_mb: 0,
    error: "",
  });
  const [selectedBundleVersions, setSelectedBundleVersions] = useState<Record<string, string>>({});
  const [modelsHub, setModelsHub] = useState<ModelsHubStatus | null>(null);
  const [hubLoading, setHubLoading] = useState(false);

  // Lake configuration & catalogs
  const [lakeConfig, setLakeConfig] = useState<LakeConfig | null>(null);
  const [draftLakeConfig, setDraftLakeConfig] = useState<LakeConfig | null>(null);
  const [impactPreview, setImpactPreview] = useState<ImpactPreview | null>(null);
  const [impactLoading, setImpactLoading] = useState(false);
  const [explicitImpactChecked, setExplicitImpactChecked] = useState(false);
  const [promptsCatalog, setPromptsCatalog] = useState<Record<string, PromptPreset>>({});

  // Prompt preview & testing
  const [promptPreview, setPromptPreview] = useState<{
    system_prompt: string;
    sample_user_prompt: string;
    char_counts?: { system_prompt: number; effective_context: number; total_prompt: number };
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Lake context state
  const [contextStaleness, setContextStaleness] = useState<{ stale: boolean; reason: string } | null>(null);
  const [contextSample, setContextSample] = useState<{ tables: any[]; text_units: any[]; total_chars: number; budget_chars: number } | null>(null);
  const [contextSummary, setContextSummary] = useState<{ candidate_domains: string[]; is_mixed_domain: boolean; entity_descriptions: Record<string, string>; suggested_vocabulary: string[] } | null>(null);
  const [contextLoading, setContextLoading] = useState(false);

  // Example editor draft state
  const [newExample, setNewExample] = useState({
    record_a: "",
    record_b: "",
    relationship: "ASSOCIATED_WITH",
    direction: "undirected",
    passage: "",
    quote_a: "",
    quote_b: "",
    reason: "",
  });
  const [exampleValidationNotice, setExampleValidationNotice] = useState("");

  // Lake reset state
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPreview, setResetPreview] = useState<ResetPreview | null>(null);
  const [resetPreviewLoading, setResetPreviewLoading] = useState(false);
  const [resetExecuting, setResetExecuting] = useState(false);

  // Load initial settings, config, bundles, and prompts
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

    api<{ config: LakeConfig; catalogs: any }>("/config")
      .then((r) => {
        if (active && r.config) {
          setLakeConfig(r.config);
          setDraftLakeConfig(JSON.parse(JSON.stringify(r.config)));
          if (r.config.bundle_id && r.config.bundle_version) {
            setSelectedBundleVersions((prev) => ({
              ...prev,
              [r.config.bundle_id]: r.config.bundle_version!,
            }));
          }
        }
      })
      .catch((e) => console.error("Could not fetch lake config:", e));

    api<{ bundles: ModelBundle[] }>("/settings/models/bundles")
      .then((r) => {
        if (active && r.bundles) {
          setBundles(r.bundles);
          initBundleVersions(r.bundles);
        }
      })
      .catch((e) => console.error("Could not fetch bundles:", e));

    fetchModelsHub();

    api<Record<string, PromptPreset>>("/settings/prompts")
      .then((r) => {
        if (active) setPromptsCatalog(r || {});
      })
      .catch((e) => console.error("Could not fetch prompts:", e));

    api<{ context_config: any; staleness: any }>("/context")
      .then((r) => {
        if (active && r.staleness) setContextStaleness(r.staleness);
      })
      .catch((e) => console.error("Could not fetch context:", e));

    return () => {
      active = false;
    };
  }, []);

  const fetchHfModels = async () => {
    try {
      setHfLoading(true);
      const res = await api<{ models: HFModel[]; loaded?: HFLoadedInfo }>("/settings/hf/models");
      setHfModels(res.models || []);
      if (res.loaded) setHfLoaded(res.loaded);
    } catch (e) {
      console.error("Failed to load Hugging Face models:", e);
    } finally {
      setHfLoading(false);
    }
  };

  const handleUnloadModel = async () => {
    try {
      setHfUnloading(true);
      setError("");
      const res = await post<{ unloaded: boolean; repo_id: string }>("/settings/hf/unload");
      setHfLoaded({ loaded: false, repo_id: "", vram_mb: 0 });
      setNotice(
        res.unloaded
          ? `Model ${res.repo_id || ""} was successfully unloaded from VRAM. GPU memory released.`
          : "No model was currently loaded in VRAM."
      );
      await fetchHfModels();
    } catch (e) {
      setError(String(e));
    } finally {
      setHfUnloading(false);
    }
  };

  useEffect(() => {
    if (draft?.llm.provider === "huggingface") {
      fetchHfModels();
    }
  }, [draft?.llm.provider]);

  useEffect(() => {
    let timer: number | null = null;
    if (hfStatus.status === "downloading") {
      timer = window.setInterval(async () => {
        try {
          const s = await api<HFDownloadStatus>("/settings/hf/download/status");
          setHfStatus(s);
          if (s.status === "completed") {
            setNotice(s.message || `Model ${s.repo_id} downloaded successfully.`);
            fetchHfModels();
            if (draft && (!draft.llm.model || draft.llm.model === s.repo_id)) {
              change("llm", { ...draft.llm, model: s.repo_id });
            }
          } else if (s.status === "error") {
            setError(s.error || "Download failed.");
          }
        } catch {}
      }, 1200);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [hfStatus.status, draft]);

  const handleStartDownload = async (repoId: string) => {
    if (!repoId.trim()) return;
    setError("");
    setNotice("");
    try {
      await post("/settings/hf/download", { repo_id: repoId.trim(), key_env: draft?.llm.key_env || "" });
      setHfStatus({
        status: "downloading",
        repo_id: repoId.trim(),
        message: "Starting download...",
        percent: 0,
        error: "",
      });
    } catch (e) {
      setError(`Failed to start download: ${e}`);
    }
  };

  const handleCancelDownload = async () => {
    try {
      await post("/settings/hf/download/cancel");
      setHfStatus({ status: "idle", repo_id: "", message: "", percent: 0, error: "" });
      setNotice("Download cancelled.");
    } catch (e) {
      setError(`Failed to cancel download: ${e}`);
    }
  };

  const handleDeleteModel = async (repoId: string) => {
    if (!confirm(`Delete model ${repoId} from local disk cache?`)) return;
    try {
      await post("/settings/hf/delete", { repo_id: repoId });
      setNotice(`Model ${repoId} deleted from disk.`);
      await fetchHfModels();
    } catch (e) {
      setError(`Failed to delete model: ${e}`);
    }
  };

  const initBundleVersions = (bundlesList: ModelBundle[]) => {
    setSelectedBundleVersions((prev) => {
      const next = { ...prev };
      for (const b of bundlesList) {
        if (!next[b.bundle_id]) {
          const vList = b.versions || b.validation?.versions || [];
          const active = b.validation?.active_version;
          const def = vList.find((v) => v.default)?.id || vList[0]?.id;
          next[b.bundle_id] = active || def || "";
        }
      }
      return next;
    });
  };

  const fetchBundles = async () => {
    try {
      const r = await api<{ bundles: ModelBundle[] }>("/settings/models/bundles");
      if (r.bundles) {
        setBundles(r.bundles);
        initBundleVersions(r.bundles);
      }
    } catch (e) {
      console.error("Could not fetch bundles:", e);
    }
  };

  const fetchModelsHub = async () => {
    try {
      setHubLoading(true);
      const res = await api<ModelsHubStatus>("/settings/models/hub");
      if (res && res.steps) setModelsHub(res);
    } catch (e) {
      console.error("Failed to fetch models hub:", e);
    } finally {
      setHubLoading(false);
    }
  };

  useEffect(() => {
    let timer: number | null = null;
    if (bundleDownloadStatus.status === "downloading") {
      timer = window.setInterval(async () => {
        try {
          const s = await api<BundleDownloadStatus>("/settings/models/hub/status");
          setBundleDownloadStatus(s);
          if (s.status === "completed") {
            setNotice(s.message || "Model downloaded successfully.");
            await fetchModelsHub();
            await fetchBundles();
          } else if (s.status === "error") {
            setError(s.error || s.message || "Model download failed.");
          }
        } catch {}
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [bundleDownloadStatus.status]);

  const handleDownloadHubModel = async (step: string, modelId: string, version?: string) => {
    setError("");
    setNotice("");
    try {
      const res = await post<{ status: string; step: string; model_id: string; message: string }>("/settings/models/hub/download", {
        step,
        model_id: modelId,
        version: version || undefined,
      });
      setBundleDownloadStatus({
        status: "downloading",
        step,
        bundle_id: modelId,
        version: version,
        message: res.message || `Starting download for ${modelId}...`,
        percent: 0,
        downloaded_mb: 0,
        total_mb: 0,
      });
    } catch (e) {
      setError(`Failed to start download: ${e}`);
    }
  };

  const handleCancelHubDownload = async () => {
    try {
      await post("/settings/models/hub/cancel");
      setBundleDownloadStatus({ status: "idle", step: "", bundle_id: "", version: "", message: "", percent: 0 });
      setNotice("Download cancelled.");
    } catch (e) {
      setError(`Failed to cancel download: ${e}`);
    }
  };

  const handleDeleteHubModel = async (step: string, modelId: string, version?: string) => {
    if (!confirm(`Are you sure you want to delete model "${modelId}" from ${step} to free disk space?`)) return;
    setError("");
    setNotice("");
    try {
      const res = await post<{ status: string; message: string }>("/settings/models/hub/delete", {
        step,
        model_id: modelId,
        version: version || undefined,
      });
      setNotice(res.message || `Deleted ${modelId}.`);
      await fetchModelsHub();
      await fetchBundles();
    } catch (e) {
      setError(`Failed to delete model: ${e}`);
    }
  };

  const handleDownloadBundle = async (bundleId: string) => {
    const version = selectedBundleVersions[bundleId] || "";
    handleDownloadHubModel("step3_cross_attention", bundleId, version);
  };

  const handleCancelBundleDownload = handleCancelHubDownload;

  const handleDeleteBundle = async (bundleId: string) => {
    handleDeleteHubModel("step3_cross_attention", bundleId, selectedBundleVersions[bundleId]);
  };

  const change = <K extends keyof Config>(k: K, v: Config[K]) => {
    if (!draft) return;
    setDraft({ ...draft, [k]: v });
  };

  const llm = <K extends keyof Config["llm"]>(k: K, v: Config["llm"][K]) => {
    if (!draft) return;
    setDraft({ ...draft, llm: { ...draft.llm, [k]: v } });
  };

  const action = async (label: string, op: () => Promise<void>) => {
    setError("");
    setNotice("");
    setBusy(label);
    try {
      await op();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy("");
    }
  };

  const saveGlobal = () =>
    action("Saving global settings", async () => {
      if (!draft) return;
      const updated = await post<Info>("/settings", draft);
      setInfo(updated);
      setDraft(updated.settings);
      setNotice("Global settings saved successfully.");
    });

  const handleTestLLM = async () => {
    if (!draft) return;
    setLlmTestResult({ status: "testing", message: "Connecting to LLM provider…" });
    setError("");
    setNotice("");
    try {
      const r = await post<{
        status?: string;
        models?: string[];
        selected_model_available?: boolean;
        notice?: string;
      }>("/settings/llm-test", draft.llm);
      if (r.models) setModels(r.models);
      const msg =
        r.notice ||
        `Connected successfully. ${r.models ? `${r.models.length} models available.` : ""}${
          draft.llm.model ? (r.selected_model_available ? " Selected model is listed." : " Selected model was not in listing.") : ""
        } No lake data sent.`;
      setLlmTestResult({ status: "success", message: msg });
      setNotice(msg);
    } catch (e) {
      const errMsg = String(e);
      setLlmTestResult({ status: "error", message: errMsg });
      setError(errMsg);
    }
  };

  const restart = async () => {
    if (!info || !draft) return;
    await action("Restarting API", async () => {
      await post("/settings", draft);
      await post("/settings/restart");
      let attempts = 0;
      while (attempts < 30) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        try {
          const fresh = await api<Info>("/settings");
          setInfo(fresh);
          setDraft(fresh.settings);
          setNotice("API restarted successfully.");
          return;
        } catch {
          attempts++;
        }
      }
      setError("Restart timed out. Check backend logs.");
    });
  };

  const checkImpact = async (proposed: Partial<LakeConfig>, isExplicit = false) => {
    if (isExplicit) {
      setImpactLoading(true);
      setExplicitImpactChecked(true);
      setError("");
    }
    try {
      const res = await post<ImpactPreview>("/config/preview", proposed);
      setImpactPreview(res);
      if (isExplicit) {
        if (res.has_impact) {
          setNotice(`Rebuild impact evaluated: ${res.invalidated_stages.join(", ")} will be invalidated.`);
        } else {
          setNotice("No rebuild required: your proposed settings will not invalidate any existing data.");
        }
      }
    } catch (e) {
      console.error("Impact check failed:", e);
      if (isExplicit) {
        setError(`Impact check failed: ${e}`);
      }
    } finally {
      if (isExplicit) {
        setImpactLoading(false);
      }
    }
  };

  const saveLakeConfigChanges = async () => {
    if (!draftLakeConfig) return;
    action("Saving lake configuration", async () => {
      const saved = await post<LakeConfig>("/config", {
        ...draftLakeConfig,
        bundle_version: selectedBundleVersions[draftLakeConfig.bundle_id] || draftLakeConfig.bundle_version,
        expected_revision: lakeConfig?.revision,
      });
      setLakeConfig(saved);
      setDraftLakeConfig(JSON.parse(JSON.stringify(saved)));
      setImpactPreview(null);
      setExplicitImpactChecked(false);
      setNotice("Lake configuration saved successfully. Execution snapshots updated.");
    });
  };

  const handleTestBundleProbe = async (bundleId: string) => {
    setProbeLoading(true);
    setError("");
    setNotice("");
    try {
      const rep = await post<ModelProbeReport>("/settings/models/probe", {
        bundle_id: bundleId,
        device: draft?.device === "cpu" ? "cpu" : "auto",
        version: selectedBundleVersions[bundleId] || undefined,
      });
      setModelProbeReport(rep);
      setNotice(`Probe complete for ${rep.name} (${rep.version || "default"}): ${rep.seconds.toFixed(3)}s on ${rep.device_name} (${rep.repeatable ? "deterministic" : "non-deterministic"}).`);
    } catch (e) {
      setError(`Synthetic probe failed: ${e}`);
    } finally {
      setProbeLoading(false);
    }
  };

  const handlePreviewPrompt = async () => {
    if (!draftLakeConfig) return;
    setPreviewLoading(true);
    setError("");
    try {
      const p = await post<any>("/settings/prompts/preview", {
        prompt_id: draftLakeConfig.prompt_id,
        schema_config: draftLakeConfig.schema_config,
        context_config: draftLakeConfig.context_config,
      });
      setPromptPreview(p);
    } catch (e) {
      setError(`Prompt preview failed: ${e}`);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleSampleContext = async () => {
    setContextLoading(true);
    setError("");
    try {
      const s = await post<any>("/context/sample", { budget_chars: 3000 });
      setContextSample(s);
      setNotice(`Sampled ${s.tables.length} tables and ${s.text_units.length} text units (${s.total_chars}/${s.budget_chars} chars).`);
    } catch (e) {
      setError(`Sampling failed: ${e}`);
    } finally {
      setContextLoading(false);
    }
  };

  const handleSummarizeContext = async () => {
    setContextLoading(true);
    setError("");
    try {
      const sum = await post<any>("/context/summarize", { timeout: 20 });
      setContextSummary(sum);
      if (draftLakeConfig) {
        const next = { ...draftLakeConfig, context_config: { ...draftLakeConfig.context_config, sampled_context: sum } };
        setDraftLakeConfig(next);
      }
      setNotice(`Context summarized: ${sum.is_mixed_domain ? "Mixed/Unknown domain detected" : sum.candidate_domains.join(", ")}.`);
    } catch (e) {
      setError(`Context summarization failed: ${e}`);
    } finally {
      setContextLoading(false);
    }
  };

  const handleValidateNewExample = async () => {
    setExampleValidationNotice("");
    setError("");
    try {
      const res = await post<any>("/context/examples/validate", newExample);
      if (res.valid) {
        setExampleValidationNotice("✓ Example verified: grounded in passage, valid direction, no masked identifiers.");
      }
    } catch (e) {
      setError(`Example validation failed: ${e}`);
    }
  };

  const handleAddExample = async () => {
    if (!draftLakeConfig) return;
    try {
      const res = await post<any>("/context/examples/validate", newExample);
      const updatedExamples = [...(draftLakeConfig.context_config.examples || []), res.example || newExample];
      setDraftLakeConfig({
        ...draftLakeConfig,
        context_config: {
          ...draftLakeConfig.context_config,
          examples: updatedExamples,
        },
      });
      setNewExample({
        record_a: "",
        record_b: "",
        relationship: "ASSOCIATED_WITH",
        direction: "undirected",
        passage: "",
        quote_a: "",
        quote_b: "",
        reason: "",
      });
      setExampleValidationNotice("Example added to active configuration.");
    } catch (e) {
      setError(`Cannot add example: ${e}`);
    }
  };

  const handleDeleteExample = (index: number) => {
    if (!draftLakeConfig) return;
    const updated = draftLakeConfig.context_config.examples.filter((_, i) => i !== index);
    setDraftLakeConfig({
      ...draftLakeConfig,
      context_config: {
        ...draftLakeConfig.context_config,
        examples: updated,
      },
    });
  };

  const handleOpenResetModal = async () => {
    setResetModalOpen(true);
    setResetPreview(null);
    setResetPreviewLoading(true);
    setError("");
    try {
      const prev = await api<ResetPreview>("/storage/reset-preview");
      setResetPreview(prev);
    } catch (e) {
      setError(`Failed to fetch reset preview: ${e}`);
    } finally {
      setResetPreviewLoading(false);
    }
  };

  const handleConfirmReset = async () => {
    setResetExecuting(true);
    setError("");
    setNotice("");
    try {
      const res = await post<ResetResult>("/storage/reset", {});
      setNotice(
        `Lake indexes reset successfully for ${activeLakeName}. Reclaimed ${res.reclaimed_mb} MB (DB shrunk from ${res.db_size_before_mb} MB to ${res.db_size_after_mb} MB). Raw datasets and records preserved.`
      );
      setResetModalOpen(false);
      try {
        const c = await api<{ config: LakeConfig }>("/config");
        if (c?.config) {
          setLakeConfig(c.config);
          setDraftLakeConfig(JSON.parse(JSON.stringify(c.config)));
        }
      } catch {}
    } catch (e) {
      setError(`Failed to reset lake storage: ${e}`);
    } finally {
      setResetExecuting(false);
    }
  };

  const activeLakeName = activeLake || "Active Lake";

  return (
    <section className="backend-settings" aria-label="Settings">
      <div className="settings-heading">
        <div>
          <h1>Settings & Configuration</h1>
          <p>
            Configure domain-agnostic model adapters, prompts, context sampling, and input policies.
          </p>
        </div>
        <div className="settings-scope-badge">
          <span className="scope-indicator">●</span>
          <span>Lake Scope: <strong>{activeLakeName}</strong></span>
        </div>
      </div>

      {error && (
        <p className="settings-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="settings-notice" role="status" aria-live="polite">
          {notice}
        </p>
      )}

      {/* Navigation Tabs */}
      <nav className="settings-nav-tabs" aria-label="Settings sections">
        <button
          type="button"
          className={`settings-nav-btn ${activeSection === "models" ? "active" : ""}`}
          onClick={() => setActiveSection("models")}
        >
          01 · Models & Runtime
        </button>
        <button
          type="button"
          className={`settings-nav-btn ${activeSection === "prompts" ? "active" : ""}`}
          onClick={() => setActiveSection("prompts")}
        >
          02 · Prompts & Examples
        </button>
        <button
          type="button"
          className={`settings-nav-btn ${activeSection === "context" ? "active" : ""}`}
          onClick={() => setActiveSection("context")}
        >
          03 · Lake Context
        </button>
        <button
          type="button"
          className={`settings-nav-btn ${activeSection === "policies" ? "active" : ""}`}
          onClick={() => setActiveSection("policies")}
        >
          04 · Input Policies
        </button>
      </nav>

      {/* SECTION 1: MODELS & RUNTIME */}
      {activeSection === "models" && (
        <div className="settings-tab-panel">
          <div className="settings-card">
            <div className="settings-card-title">
              <span>01</span>
              <div>
                <h2>Global Model Hub & Pipeline Steps</h2>
                <p>Unified model storage (<code>models/</code>) organized by execution steps</p>
              </div>
            </div>

            <div className="settings-active-scope-tag">
              Configuration Scope: <strong>Lake-Scoped ({activeLakeName})</strong> · Models Root: <code>models/</code>
            </div>

            {/* Active Bundle Download Banner */}
            {bundleDownloadStatus.status === "downloading" && (
              <div className="bundle-downloading-banner">
                <div className="bundle-download-header">
                  <div className="bundle-download-info">
                    <span className="bundle-download-spinner" />
                    <strong>
                      Downloading Model: {bundleDownloadStatus.bundle_id}
                      {bundleDownloadStatus.version ? ` (${bundleDownloadStatus.version})` : ""}
                      {bundleDownloadStatus.step ? ` · [${bundleDownloadStatus.step}]` : ""}
                    </strong>
                  </div>
                  <button
                    type="button"
                    className="bundle-cancel-btn"
                    onClick={handleCancelHubDownload}
                  >
                    Cancel Download
                  </button>
                </div>
                <div className="bundle-progress-bar-container">
                  <div
                    className="bundle-progress-bar-fill"
                    style={{ width: `${Math.min(100, Math.max(0, bundleDownloadStatus.percent || 0))}%` }}
                  />
                </div>
                <div className="bundle-download-meta">
                  <span>{bundleDownloadStatus.message || "Downloading model files from Hugging Face..."}</span>
                  <span>
                    {bundleDownloadStatus.downloaded_mb !== undefined && bundleDownloadStatus.total_mb !== undefined && bundleDownloadStatus.total_mb > 0
                      ? `${bundleDownloadStatus.downloaded_mb.toFixed(1)} MB / ${bundleDownloadStatus.total_mb.toFixed(1)} MB (${(bundleDownloadStatus.percent || 0).toFixed(0)}%)`
                      : bundleDownloadStatus.downloaded_mb
                        ? `${bundleDownloadStatus.downloaded_mb.toFixed(1)} MB downloaded`
                        : `${(bundleDownloadStatus.percent || 0).toFixed(0)}%`}
                  </span>
                </div>
              </div>
            )}

            {/* STEP 1: PROFILING & PASSAGE EMBEDDINGS */}
            <div className="hub-step-section">
              <div className="hub-step-header">
                <span className="hub-step-num">Step 1</span>
                <div className="hub-step-header-text">
                  <h3>Dataset Profiling & Passage Embeddings</h3>
                  <p>Dense embedding models used by <code>scripts/embed-profile.py</code> to index CSV tables and text passages into vector storage.</p>
                </div>
              </div>

              <div className="bundle-cards-grid">
                {(modelsHub?.steps?.step1_profiling?.models || [
                  {
                    id: "all-minilm",
                    name: "all-MiniLM-L6-v2 (Domain-Agnostic · Recommended)",
                    dimensions: 384,
                    token_limit: 512,
                    description: "Fast 384d embedding model with minimal VRAM/CPU footprint. Ideal for domain-agnostic tabular data.",
                    ready: false,
                    size_str: "",
                  },
                  {
                    id: "medembed",
                    name: "MedEmbed-large-v0.1 (Clinical / LOKI)",
                    dimensions: 1024,
                    token_limit: 512,
                    description: "High-accuracy biomedical and clinical passage embedding model (1024d) for MIMIC and EHR datasets.",
                    ready: false,
                    size_str: "",
                  },
                  {
                    id: "bge-small",
                    name: "bge-small-en-v1.5 (High-Accuracy 384d)",
                    dimensions: 384,
                    token_limit: 512,
                    description: "High-accuracy English retrieval embedding model by BAAI with 384 dimensions.",
                    ready: false,
                    size_str: "",
                  },
                ]).map((m) => {
                  const isDownloadingThis = bundleDownloadStatus.status === "downloading" && bundleDownloadStatus.bundle_id === m.id;
                  return (
                    <div key={m.id} className={`bundle-card ${m.ready ? "ready-card" : ""}`}>
                      <div className="bundle-card-top">
                        <div>
                          <h4>{m.name}</h4>
                          <span className="bundle-id">models/step1_profiling/{m.id}</span>
                        </div>
                        <div className="bundle-badges-row">
                          {m.size_str && (
                            <span className="bundle-disk-badge" title="Size on disk">
                              💾 {m.size_str}
                            </span>
                          )}
                          <span className={`bundle-val-badge ${m.ready ? "valid" : "invalid"}`}>
                            {m.ready ? "✓ Ready on Disk" : "⚠️ Download Required"}
                          </span>
                        </div>
                      </div>

                      <p className="bundle-desc">{m.description}</p>

                      <div className="bundle-roles-grid">
                        <div>
                          <small>Dimensions</small>
                          <code>{m.dimensions}d</code>
                        </div>
                        <div>
                          <small>Token Limit</small>
                          <code>{m.token_limit || 512} tokens</code>
                        </div>
                      </div>

                      <div className="bundle-card-actions">
                        <button
                          type="button"
                          className="bundle-download-btn"
                          disabled={bundleDownloadStatus.status === "downloading"}
                          onClick={() => handleDownloadHubModel("step1_profiling", m.id)}
                        >
                          {isDownloadingThis
                            ? "⏳ Downloading…"
                            : m.ready
                              ? "↻ Re-download Model"
                              : "⬇ Download Model"}
                        </button>

                        {m.ready && (
                          <button
                            type="button"
                            className="bundle-delete-btn"
                            disabled={bundleDownloadStatus.status === "downloading"}
                            onClick={() => handleDeleteHubModel("step1_profiling", m.id)}
                          >
                            🗑 Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 2: CANDIDATE DISCOVERY & RERANKERS */}
            <div className="hub-step-section">
              <div className="hub-step-header">
                <span className="hub-step-num">Step 2</span>
                <div className="hub-step-header-text">
                  <h3>Candidate Discovery & Reranking</h3>
                  <p>Cross-encoder neural rerankers for scoring and ranking candidate table-to-text pairs.</p>
                </div>
              </div>

              <div className="bundle-cards-grid">
                {(modelsHub?.steps?.step2_discovery?.models || [
                  {
                    id: "heuristic",
                    name: "Heuristic Lexical + Cosine (Built-in)",
                    description: "High-speed BM25 FTS5 + cosine similarity ranking. No additional neural reranker weights required.",
                    ready: true,
                    builtin: true,
                  },
                  {
                    id: "bge-reranker-base",
                    name: "BAAI/bge-reranker-base (Neural Cross-Encoder)",
                    description: "Cross-encoder scoring for table-text relevance ranking.",
                    ready: false,
                    size_str: "",
                  },
                ]).map((m) => {
                  const isDownloadingThis = bundleDownloadStatus.status === "downloading" && bundleDownloadStatus.bundle_id === m.id;
                  return (
                    <div key={m.id} className="bundle-card">
                      <div className="bundle-card-top">
                        <div>
                          <h4>{m.name}</h4>
                          <span className="bundle-id">models/step2_discovery/{m.id}</span>
                        </div>
                        <div className="bundle-badges-row">
                          {m.size_str && (
                            <span className="bundle-disk-badge" title="Size on disk">
                              💾 {m.size_str}
                            </span>
                          )}
                          <span className={`bundle-val-badge ${m.ready ? "valid" : "invalid"}`}>
                            {m.builtin ? "✓ Built-in (Always Ready)" : m.ready ? "✓ Ready on Disk" : "⚠️ Not Downloaded"}
                          </span>
                        </div>
                      </div>

                      <p className="bundle-desc">{m.description}</p>

                      {!m.builtin && (
                        <div className="bundle-card-actions">
                          <button
                            type="button"
                            className="bundle-download-btn"
                            disabled={bundleDownloadStatus.status === "downloading"}
                            onClick={() => handleDownloadHubModel("step2_discovery", m.id)}
                          >
                            {isDownloadingThis
                              ? "⏳ Downloading…"
                              : m.ready
                                ? "↻ Re-download"
                                : "⬇ Download Model"}
                          </button>

                          {m.ready && (
                            <button
                              type="button"
                              className="bundle-delete-btn"
                              disabled={bundleDownloadStatus.status === "downloading"}
                              onClick={() => handleDeleteHubModel("step2_discovery", m.id)}
                            >
                              🗑 Delete
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* STEP 3: RELATIONSHIP SCORING & CROSS-ATTENTION ADAPTERS */}
            <div className="hub-step-section">
              <div className="hub-step-header">
                <span className="hub-step-num">Step 3</span>
                <div className="hub-step-header-text">
                  <h3>Relationship Scoring & Cross-Attention Adapters</h3>
                  <p>Strict tensor contract cross-attention models matching table records to text passages (Lake-Configurable).</p>
                </div>
              </div>

            {/* Model Bundles Selection */}
            <div className="bundle-cards-grid">
              {bundles.map((b) => {
                const isSelected = draftLakeConfig?.bundle_id === b.bundle_id;
                const v = b.validation;
                const versionsList = b.versions || v?.versions || [];
                const isDownloadingThis = bundleDownloadStatus.status === "downloading" && bundleDownloadStatus.bundle_id === b.bundle_id;
                return (
                  <div
                    key={b.bundle_id}
                    className={`bundle-card ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      if (draftLakeConfig) {
                        const next = { ...draftLakeConfig, bundle_id: b.bundle_id };
                        setDraftLakeConfig(next);
                        checkImpact(next);
                      }
                    }}
                  >
                    <div className="bundle-card-top">
                      <div>
                        <h4>{b.name}</h4>
                        <span className="bundle-id">{b.bundle_id}</span>
                      </div>
                      <div className="bundle-badges-row">
                        {v?.size_str && (
                          <span className="bundle-disk-badge" title="Weights size on disk">
                            💾 {v.size_str}
                          </span>
                        )}
                        <span className={`bundle-val-badge ${v?.valid ? "valid" : "invalid"}`}>
                          {v?.status === "ready"
                            ? "✓ Ready on Disk"
                            : v?.status === "fixture_ready" || v?.fixture_fallback_available
                              ? "⚡ Fixture Ready"
                              : v?.status === "missing"
                                ? "⚠️ Checkpoint Missing"
                                : "❌ Incompatible"}
                        </span>
                      </div>
                    </div>

                    <p className="bundle-desc">{b.description}</p>

                    {/* Version / Checkpoint Selection */}
                    {versionsList.length > 0 && (
                      <div className="bundle-version-select-row" onClick={(e) => e.stopPropagation()}>
                        <label htmlFor={`version-${b.bundle_id}`}>
                          <strong>Checkpoint / Version:</strong>
                        </label>
                        <select
                          id={`version-${b.bundle_id}`}
                          value={selectedBundleVersions[b.bundle_id] || v?.active_version || ""}
                          onChange={(e) => {
                            setSelectedBundleVersions((prev) => ({
                              ...prev,
                              [b.bundle_id]: e.target.value,
                            }));
                          }}
                        >
                          {versionsList.map((ver) => (
                            <option key={ver.id} value={ver.id}>
                              {ver.name} {ver.default ? "(Default)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="bundle-roles-grid">
                      <div>
                        <small>Retrieval Encoder</small>
                        <code>{b.retrieval_encoder}</code>
                      </div>
                      <div>
                        <small>Scoring Model</small>
                        <code>{b.scoring_model}</code>
                      </div>
                      <div>
                        <small>Reranker</small>
                        <code>{b.reranker}</code>
                      </div>
                      <div>
                        <small>Dimensions & Adapter</small>
                        <code>{b.dimensions}d · {b.adapter_id}</code>
                      </div>
                    </div>

                    <div className="bundle-card-actions" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        className="bundle-download-btn"
                        disabled={bundleDownloadStatus.status === "downloading"}
                        onClick={() => handleDownloadBundle(b.bundle_id)}
                        title={v?.status === "ready" ? "Re-download checkpoint files from Hugging Face" : "Download model checkpoint files from Hugging Face"}
                      >
                        {isDownloadingThis
                          ? "⏳ Downloading…"
                          : v?.status === "ready"
                            ? "↻ Re-download Checkpoint"
                            : "⬇ Download Model Checkpoint"}
                      </button>

                      {v?.status === "ready" && (v.size_on_disk || 0) > 0 && (
                        <button
                          type="button"
                          className="bundle-delete-btn"
                          disabled={bundleDownloadStatus.status === "downloading"}
                          onClick={() => handleDeleteBundle(b.bundle_id)}
                          title="Delete downloaded weights from disk to free space"
                        >
                          🗑 Delete
                        </button>
                      )}

                      <button
                        type="button"
                        className="probe-btn"
                        disabled={probeLoading}
                        onClick={() => handleTestBundleProbe(b.bundle_id)}
                      >
                        {probeLoading ? "Testing Probe…" : "Test Model Compatibility (Probe)"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Rebuild Impact Warning */}
            {impactPreview && impactPreview.has_impact && (
              <div className="impact-alert" role="alert">
                <strong>Rebuild Impact Before Activation:</strong>
                <ul>
                  {impactPreview.impacts.map((imp, idx) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
                <p>Affected stages: <strong>{impactPreview.invalidated_stages.join(", ")}</strong>.</p>
              </div>
            )}
            {impactPreview && !impactPreview.has_impact && explicitImpactChecked && (
              <div className="impact-safe" role="status" style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "var(--text-success, #22c55e)", margin: "16px 0" }}>
                <strong>✓ No Rebuild Required</strong>
                <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                  Your proposed settings match the active configuration or take effect immediately without invalidating existing data.
                </p>
              </div>
            )}

            {/* Synthetic Probe Report Display */}
            {modelProbeReport && (
              <div className="probe-report-card">
                <h4>Synthetic Compatibility Probe Report</h4>
                <div className="probe-stats-grid">
                  <div>
                    <small>Active Device</small>
                    <strong>{modelProbeReport.device_name} ({modelProbeReport.device})</strong>
                  </div>
                  <div>
                    <small>Latency</small>
                    <strong>{(modelProbeReport.seconds * 1000).toFixed(1)} ms</strong>
                  </div>
                  <div>
                    <small>Tensor Dimension</small>
                    <strong>{modelProbeReport.dimensions}d (exact)</strong>
                  </div>
                  <div>
                    <small>Repeatability</small>
                    <strong>{modelProbeReport.repeatable ? "Deterministic" : "Non-deterministic"}</strong>
                  </div>
                </div>
                <small className="probe-note">
                  Strict state-dict loading verified. Checkpoint dimensions match adapter contract.
                </small>
              </div>
            )}

            <div className="settings-card-actions-bar">
              <button
                type="button"
                className="settings-save-btn"
                disabled={draftLakeConfig?.bundle_id === lakeConfig?.bundle_id}
                onClick={saveLakeConfigChanges}
              >
                Apply Model Bundle to Lake
              </button>
            </div>
            </div>
          </div>

          {/* Python & Inference Environment */}
          {info && draft && (
            <div className="settings-card" style={{ marginTop: "20px" }}>
              <div className="settings-card-title">
                <span>02</span>
                <div>
                  <h2>Inference Environment & GPU</h2>
                  <p>Python runtime, CUDA drivers, and VRAM budget</p>
                </div>
              </div>

              <div className="settings-active-scope-tag">
                Configuration Scope: <strong>Global Catalog / Installation Default</strong>
              </div>

              <div className="settings-row">
                <label>
                  Model inference Python
                  <input
                    aria-label="Model Python"
                    list="python-environments"
                    value={draft.model_python}
                    placeholder="Automatic"
                    onChange={(e) => change("model_python", e.target.value)}
                  />
                  <datalist id="python-environments">
                    {info.environments.map((e) => (
                      <option key={e.path} value={e.path}>
                        {e.name}
                      </option>
                    ))}
                  </datalist>
                </label>

                <label>
                  Device
                  <select
                    aria-label="Inference device"
                    value={draft.device}
                    onChange={(e) => change("device", e.target.value)}
                  >
                    <option value="auto">Automatic (CUDA if available)</option>
                    <option value="cuda">CUDA GPU</option>
                    <option value="cpu">CPU</option>
                  </select>
                </label>

                <label>
                  VRAM budget (GiB; 0 = unlimited)
                  <input
                    aria-label="VRAM budget"
                    type="number"
                    min="0"
                    step="0.5"
                    value={draft.vram_gib}
                    onChange={(e) => change("vram_gib", Number(e.target.value))}
                  />
                </label>
              </div>

              <button
                type="button"
                className="secondary"
                disabled={busy === "Testing Python"}
                onClick={() =>
                  action("Testing Python", async () => {
                    const pythonToTest = draft.model_python || info?.runtime.python || "";
                    const r = await post<Probe>("/settings/runtime-probe", { python: pythonToTest });
                    setProbe(r);
                    setNotice(
                      r.python_supported
                        ? `Python ${r.version} verified.${r.cuda_available ? " CUDA available." : " Running on CPU."}`
                        : `Python ${r.version} is not recommended.`
                    );
                  })
                }
              >
                {busy === "Testing Python" ? "Inspecting environment…" : "Test inference environment"}
              </button>

              {probe && (
                <div className="settings-probe" role="status">
                  <strong>
                    Python {probe.version} ·{" "}
                    {probe.cuda_available ? "CUDA available" : "CUDA unavailable"}
                  </strong>
                  <p>
                    {probe.gpus.map((g) => `${g.name} · ${g.total_gib.toFixed(1)} GiB`).join(", ") ||
                      "No CUDA GPU reported by this environment."}
                  </p>
                  <p>
                    {probe.loki_dependencies_present
                      ? "Core LOKI packages detected. Model checkpoint compatibility is verified when inference runs."
                      : "Required dependencies are missing or cannot load."}
                  </p>
                  <details>
                    <summary>Package versions and executable</summary>
                    <code>{probe.python}</code>
                    {probe.packages &&
                      Object.entries(probe.packages).map(([name, version]) => (
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
                <button
                  type="button"
                  disabled={!info.restart_available || busy === "Restarting API"}
                  onClick={restart}
                >
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

              <div className="settings-card-actions-bar">
                <button type="button" className="settings-save-btn" onClick={saveGlobal}>
                  Save Global Runtime Settings
                </button>
              </div>
            </div>
          )}

          {/* LLM Connection Section */}
          {draft && (
            <div className="settings-card" style={{ marginTop: "20px" }}>
              <div className="settings-card-title">
                <span>03</span>
                <div>
                  <h2>LLM Connection & Providers</h2>
                  <p>In-process Hugging Face runtime or local/remote API endpoints</p>
                </div>
              </div>

              <div className="settings-active-scope-tag">
                Configuration Scope: <strong>Global Catalog / Installation Default</strong>
              </div>

              <label>
                Provider
                <select
                  aria-label="LLM provider"
                  value={draft.llm.provider}
                  onChange={(e) => {
                    const p = e.target.value;
                    const defaultHfModel = "Qwen/Qwen2.5-3B-Instruct";
                    change("llm", {
                      ...draft.llm,
                      provider: p,
                      base_url:
                        p === "ollama"
                          ? "http://127.0.0.1:11434"
                          : p === "lm-studio"
                            ? "http://127.0.0.1:1234/v1"
                            : p === "unsloth"
                              ? "http://127.0.0.1:8888/v1"
                              : p === "openai-compatible"
                                ? "https://api.openai.com/v1"
                                : p === "huggingface"
                                  ? ""
                                  : draft.llm.base_url,
                      model:
                        p === "huggingface" && (!draft.llm.model || !draft.llm.model.includes("/"))
                          ? defaultHfModel
                          : draft.llm.model,
                      key_env: p === "openai-compatible" ? "OPENAI_API_KEY" : "",
                    });
                    setModels([]);
                  }}
                >
                  <option value="disabled">Not configured</option>
                  <option value="huggingface">Hugging Face (Direct in-process)</option>
                  <option value="ollama">Ollama</option>
                  <option value="lm-studio">LM Studio · local / LAN</option>
                  <option value="unsloth">Unsloth LAN</option>
                  <option value="openai-compatible">OpenAI-compatible API / local server</option>
                </select>
              </label>

              {draft.llm.provider === "huggingface" ? (
                <div className="hf-section-container">
                  <div className="hf-info-banner">
                    <strong>Direct In-Process Hugging Face Runtime</strong>
                    <p>
                      Models execute locally inside IDUN using Hugging Face Transformers with PyTorch CUDA acceleration. No external server (LM Studio / Ollama) is required.
                    </p>
                  </div>

                  {hfLoaded.loaded && (
                    <div className="hf-loaded-banner">
                      <div className="hf-loaded-left">
                        <span className="hf-loaded-indicator" />
                        <div>
                          <strong>Active in VRAM: {hfLoaded.repo_id}</strong>
                          {hfLoaded.vram_mb > 0 && (
                            <span className="hf-vram-usage"> (~{hfLoaded.vram_mb} MB VRAM)</span>
                          )}
                          <p>Model is resident in memory for immediate inference response.</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="hf-unload-btn"
                        onClick={handleUnloadModel}
                        disabled={hfUnloading}
                      >
                        {hfUnloading ? "Unloading…" : "Unload from VRAM"}
                      </button>
                    </div>
                  )}

                  <div className="hf-catalog-section">
                    <div className="hf-catalog-header">
                      <div>
                        <h3>Curated Local Models & Disk Cache</h3>
                        <small>Select a model to use for relationship probing and integration proposals</small>
                      </div>
                      <button
                        type="button"
                        className="hf-refresh-btn"
                        onClick={fetchHfModels}
                        disabled={hfLoading}
                      >
                        {hfLoading ? "Refreshing…" : "↻ Refresh Cache"}
                      </button>
                    </div>

                    {hfStatus.status === "downloading" && (
                      <div className="hf-downloading-banner">
                        <div className="hf-downloading-top">
                          <strong>
                            Downloading {hfStatus.repo_id} ({hfStatus.percent}%)
                          </strong>
                          <button
                            type="button"
                            className="hf-cancel-btn"
                            onClick={handleCancelDownload}
                          >
                            Cancel Download
                          </button>
                        </div>
                        <p>{hfStatus.message}</p>
                        <div className="hf-progress-bar-wrap">
                          <div
                            className="hf-progress-bar-fill"
                            style={{ width: `${Math.max(5, hfStatus.percent)}%` }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="hf-cards-grid">
                      {hfModels.map((m) => {
                        const isSelected = draft.llm.model === m.repo_id;
                        const isDownloadingThis =
                          hfStatus.status === "downloading" &&
                          hfStatus.repo_id === m.repo_id;
                        const isGguf = m.format === "gguf" || m.compatible === false;
                        const isLoaded = Boolean(m.loaded || (hfLoaded.loaded && hfLoaded.repo_id === m.repo_id));
                        return (
                          <div
                            key={m.repo_id}
                            className={`hf-card ${isSelected ? "hf-card-selected" : ""} ${m.downloaded ? "hf-card-ready" : ""}`}
                          >
                            <div className="hf-card-top">
                              <div className="hf-card-title-wrap">
                                <h4>{m.name}</h4>
                                <span className="hf-repo-id">{m.repo_id}</span>
                              </div>
                              <div className="hf-badges">
                                {isLoaded && (
                                  <span className="hf-badge hf-badge-loaded">⚡ In VRAM</span>
                                )}
                                {m.recommended && (
                                  <span className="hf-badge hf-badge-rec">★ Recommended</span>
                                )}
                                {m.gated && (
                                  <span className="hf-badge hf-badge-gated">🔒 Gated (HF_TOKEN)</span>
                                )}
                                {isGguf && (
                                  <span className="hf-badge hf-badge-gated">📦 GGUF format</span>
                                )}
                                <span className="hf-badge hf-badge-vram">
                                  {m.params} · {m.vram_estimate}
                                </span>
                              </div>
                            </div>
                            <p className="hf-card-desc">{m.description}</p>
                            <div className="hf-card-footer">
                              {m.downloaded ? (
                                <div className="hf-card-ready-actions">
                                  <span className={`hf-status-tag ${isGguf ? "not-downloaded" : "ready"}`}>
                                    {isGguf ? `GGUF in Cache (${m.size_str})` : `✓ Ready in Cache (${m.size_str})`}
                                  </span>
                                  <div className="hf-btn-group">
                                    {isGguf ? (
                                      <button
                                        type="button"
                                        className="hf-select-btn"
                                        style={{ background: "#d97706" }}
                                        title="GGUF models run through LM Studio"
                                        onClick={() => {
                                          change("llm", {
                                            ...draft.llm,
                                            provider: "lm-studio",
                                            base_url: "http://127.0.0.1:1234/v1",
                                            model: m.repo_id,
                                          });
                                          setNotice(`Switched Provider to LM Studio for GGUF model ${m.repo_id}.`);
                                        }}
                                      >
                                        Use with LM Studio
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className={`hf-select-btn ${isSelected ? "active" : ""}`}
                                        onClick={() => llm("model", m.repo_id)}
                                      >
                                        {isSelected ? "✓ Active Model" : "Select for Inference"}
                                      </button>
                                    )}
                                    {isLoaded && (
                                      <button
                                        type="button"
                                        className="hf-card-unload-btn"
                                        title="Release model from VRAM"
                                        disabled={hfUnloading}
                                        onClick={handleUnloadModel}
                                      >
                                        {hfUnloading ? "Unloading…" : "Unload"}
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      className="hf-delete-btn"
                                      title="Delete model from disk"
                                      onClick={() => handleDeleteModel(m.repo_id)}
                                    >
                                      Delete
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="hf-card-download-actions">
                                  <span className="hf-status-tag not-downloaded">
                                    Not cached locally
                                  </span>
                                  <button
                                    type="button"
                                    className="hf-download-btn"
                                    disabled={hfStatus.status === "downloading"}
                                    onClick={() => handleStartDownload(m.repo_id)}
                                  >
                                    {isDownloadingThis ? "Downloading…" : "Download"}
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="hf-custom-repo-row">
                      <label>
                        Download custom Hugging Face repository
                        <div className="hf-custom-repo-input-group">
                          <input
                            type="text"
                            placeholder="e.g. meta-llama/Llama-3.2-1B-Instruct or any Hugging Face repo ID"
                            value={customRepo}
                            onChange={(e) => setCustomRepo(e.target.value)}
                          />
                          <button
                            type="button"
                            className="hf-custom-dl-btn"
                            disabled={!customRepo.trim() || hfStatus.status === "downloading"}
                            onClick={() => {
                              handleStartDownload(customRepo.trim());
                              setCustomRepo("");
                            }}
                          >
                            Download Custom Model
                          </button>
                        </div>
                      </label>
                    </div>

                    <div className="hf-auto-unload-option">
                      <label className="hf-checkbox-label">
                        <input
                          type="checkbox"
                          checked={draft.llm.auto_unload ?? true}
                          onChange={(e) => llm("auto_unload", e.target.checked)}
                        />
                        <span>Automatically unload model from VRAM after inference</span>
                      </label>
                      <small>
                        Frees GPU/host memory immediately after relationship probing or semantic integration finishes. If unchecked, the model stays resident in VRAM for faster subsequent responses.
                      </small>
                    </div>
                  </div>

                  <label>
                    Hugging Face token environment variable (optional)
                    <input
                      aria-label="Hugging Face token environment variable"
                      autoComplete="off"
                      value={draft.llm.key_env}
                      placeholder="Leave blank for public models · e.g. HF_TOKEN only for gated models"
                      onChange={(e) => llm("key_env", e.target.value)}
                    />
                  </label>
                  <small>
                    Gated models require accepting license terms on Hugging Face and entering the environment variable name containing your Hugging Face User Access Token (e.g. HF_TOKEN). Public models (Qwen, Phi) can run with this blank.
                  </small>
                </div>
              ) : (
                <>
                  <label>
                    Server base URL
                    <input
                      aria-label="LLM base URL"
                      value={draft.llm.base_url}
                      onChange={(e) => llm("base_url", e.target.value)}
                    />
                  </label>
                  <small>
                    LM Studio, Unsloth LAN and compatible APIs automatically add /v1 to a bare
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
                    Enter the environment variable name, not the raw secret. Keys remain on the server and are never sent to the browser.
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
                  </div>
                </>
              )}

              <div className="settings-row" style={{ marginTop: draft.llm.provider === "huggingface" ? "12px" : "0" }}>
                <label>
                  Output token allowance
                  <input
                    aria-label="Output token allowance"
                    type="number"
                    min={256}
                    max={65536}
                    step={256}
                    value={draft.llm.max_output_tokens}
                    onChange={(e) => llm("max_output_tokens", Number(e.target.value))}
                  />
                </label>
                <label>
                  Timeout (seconds; 0 = unlimited)
                  <input
                    aria-label="LLM timeout"
                    type="number"
                    min={0}
                    value={draft.llm.timeout_seconds}
                    onChange={(e) => llm("timeout_seconds", Number(e.target.value))}
                  />
                </label>
              </div>

              {llmTestResult.message && (
                <div
                  className={`llm-test-status-banner ${llmTestResult.status === "error" ? "error" : llmTestResult.status === "testing" ? "testing" : "success"}`}
                  role="status"
                >
                  <span className="llm-status-icon">
                    {llmTestResult.status === "error" ? "❌" : llmTestResult.status === "testing" ? "⏳" : "✓"}
                  </span>
                  <div className="llm-status-text">
                    <strong>
                      {llmTestResult.status === "error"
                        ? "Connection Failed"
                        : llmTestResult.status === "testing"
                          ? "Testing Connection…"
                          : "Connection Successful"}
                    </strong>
                    <p>{llmTestResult.message}</p>
                  </div>
                </div>
              )}

              <div className="settings-card-actions-bar">
                <button
                  type="button"
                  className="secondary"
                  disabled={draft.llm.provider === "disabled" || llmTestResult.status === "testing"}
                  onClick={handleTestLLM}
                >
                  {llmTestResult.status === "testing"
                    ? "Connecting…"
                    : draft.llm.provider === "huggingface"
                      ? "Verify Model Availability"
                      : "Test Connection & List Models"}
                </button>
                <button type="button" className="settings-save-btn" onClick={saveGlobal}>
                  Save Global LLM Settings
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: PROMPTS & EXAMPLES */}
      {activeSection === "prompts" && draftLakeConfig && (
        <div className="settings-tab-panel">
          <div className="settings-card">
            <div className="settings-card-title">
              <span>02</span>
              <div>
                <h2>Prompts & Schema Presets</h2>
                <p>Configure relationship extraction schema, prompt presets, and preview effective prompt text</p>
              </div>
            </div>

            <div className="settings-active-scope-tag">
              Configuration Scope: <strong>Lake-Scoped ({activeLakeName})</strong>
            </div>

            {/* Preset Selector */}
            <label>
              Relationship Prompt Preset
              <select
                value={draftLakeConfig.prompt_id}
                onChange={(e) => {
                  const pid = e.target.value;
                  const preset = promptsCatalog[pid];
                  if (preset) {
                    const next = {
                      ...draftLakeConfig,
                      prompt_id: pid,
                      schema_config: {
                        prompt_id: pid,
                        mode: preset.mode,
                        labels: [...preset.labels],
                        definitions: { ...preset.definitions },
                      },
                    };
                    setDraftLakeConfig(next);
                    checkImpact(next);
                  }
                }}
              >
                <option value="generic-evidence-v1">Generic Evidence-Backed Integration (Domain-Agnostic)</option>
                <option value="open-discovery-v1">Open-Ended Relationship Discovery (Emergent)</option>
                <option value="clinical-preset-v1">Clinical Diagnosis–Medication Preset (Legacy Clinical)</option>
              </select>
            </label>

            {/* Schema Mode */}
            <label>
              Extraction Schema Mode
              <select
                value={draftLakeConfig.schema_config.mode}
                onChange={(e) => {
                  const m = e.target.value as "strict" | "hybrid" | "open";
                  setDraftLakeConfig({
                    ...draftLakeConfig,
                    schema_config: {
                      ...draftLakeConfig.schema_config,
                      mode: m,
                    },
                  });
                }}
              >
                <option value="strict">Strict · Model must strictly output predefined relationship labels</option>
                <option value="hybrid">Hybrid · Model may propose emergent labels if no predefined fits</option>
                <option value="open">Open · Model derives canonical UPPER_SNAKE_CASE labels freely</option>
              </select>
            </label>

            {/* Label Definitions Editor */}
            <div className="schema-labels-editor">
              <h4>Relationship Labels & Definitions</h4>
              <div className="labels-list">
                {draftLakeConfig.schema_config.labels.map((lbl) => (
                  <div key={lbl} className="label-def-row">
                    <span className="label-name-badge">{lbl}</span>
                    <input
                      type="text"
                      className="label-def-input"
                      value={draftLakeConfig.schema_config.definitions[lbl] || ""}
                      placeholder="Definition for this relationship label"
                      onChange={(e) => {
                        const newDefs = { ...draftLakeConfig.schema_config.definitions, [lbl]: e.target.value };
                        setDraftLakeConfig({
                          ...draftLakeConfig,
                          schema_config: { ...draftLakeConfig.schema_config, definitions: newDefs },
                        });
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Prompt Preview Controls */}
            <div className="prompt-preview-controls">
              <button
                type="button"
                className="secondary"
                disabled={previewLoading}
                onClick={handlePreviewPrompt}
              >
                {previewLoading ? "Generating Preview…" : "Generate Effective Prompt Preview"}
              </button>
            </div>

            {/* Effective Prompt Preview */}
            {promptPreview && (
              <div className="prompt-preview-box">
                <h4>Effective Compiled System Prompt</h4>
                {promptPreview.char_counts && (
                  <small className="budget-tag">
                    Prompt length: {promptPreview.char_counts.system_prompt} chars · Effective context: {promptPreview.char_counts.effective_context} chars
                  </small>
                )}
                <pre className="prompt-preview-text">{promptPreview.system_prompt}</pre>
                <h4>Sample Formatted User Prompt</h4>
                <pre className="prompt-preview-text">{promptPreview.sample_user_prompt}</pre>
                <small className="safe-secret-tag">
                  ✓ Secret safety: API keys, tokens, and file system paths are never exposed in prompt previews.
                </small>
              </div>
            )}

            <div className="settings-card-actions-bar">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  const defaultPreset = promptsCatalog[draftLakeConfig.prompt_id] || promptsCatalog["generic-evidence-v1"];
                  if (defaultPreset) {
                    setDraftLakeConfig({
                      ...draftLakeConfig,
                      schema_config: {
                        prompt_id: draftLakeConfig.prompt_id,
                        mode: defaultPreset.mode,
                        labels: [...defaultPreset.labels],
                        definitions: { ...defaultPreset.definitions },
                      },
                    });
                    setNotice("Restored preset default schema definitions.");
                  }
                }}
              >
                Restore Preset Defaults
              </button>
              <button type="button" className="settings-save-btn" onClick={saveLakeConfigChanges}>
                Save Prompt & Schema to Lake
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: LAKE CONTEXT */}
      {activeSection === "context" && draftLakeConfig && (
        <div className="settings-tab-panel">
          <div className="settings-card">
            <div className="settings-card-title">
              <span>03</span>
              <div>
                <h2>Lake Context & Examples</h2>
                <p>Sample projected lake content, generate heuristic summaries, and manage user-reviewed few-shot examples</p>
              </div>
            </div>

            <div className="settings-active-scope-tag">
              Configuration Scope: <strong>Lake-Scoped ({activeLakeName})</strong>
            </div>

            {/* Staleness Banner */}
            {contextStaleness && contextStaleness.stale && (
              <div className="staleness-banner" role="alert">
                ⚠️ <strong>Context Staleness Detected:</strong> {contextStaleness.reason}. Refresh samples or clear outdated context.
              </div>
            )}

            {/* Context Mode Selector */}
            <label>
              Prompt Context Mode
              <select
                value={draftLakeConfig.context_config.mode}
                onChange={(e) => {
                  const m = e.target.value as "none" | "sampled_context" | "user_examples";
                  setDraftLakeConfig({
                    ...draftLakeConfig,
                    context_config: {
                      ...draftLakeConfig.context_config,
                      mode: m,
                    },
                  });
                }}
              >
                <option value="none">None · Only the system prompt and candidate evidence are sent</option>
                <option value="sampled_context">Sampled Context · Inject content-derived pre-discovery domain and entity summary</option>
                <option value="user_examples">User Examples · Inject explicit, user-reviewed few-shot examples</option>
              </select>
            </label>

            {/* Sampling and Heuristic Summarization Controls */}
            <div className="context-tools-row">
              <button
                type="button"
                className="secondary"
                disabled={contextLoading}
                onClick={handleSampleContext}
              >
                {contextLoading ? "Sampling…" : "Sample Projected Lake Content"}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={contextLoading}
                onClick={handleSummarizeContext}
              >
                {contextLoading ? "Summarizing…" : "Generate Heuristic Summary"}
              </button>
            </div>

            {/* Sampled Content Preview */}
            {contextSample && (
              <div className="context-sample-card">
                <h4>Sampled Content ({contextSample.total_chars} / {contextSample.budget_chars} chars)</h4>
                <p>Sampled {contextSample.tables.length} tables and {contextSample.text_units.length} text units with reproducible source diversity.</p>
                <div className="sample-sources-chips">
                  {contextSample.tables.map((t) => (
                    <span key={t.asset_id} className="sample-chip">📊 {t.name} ({t.rows} rows)</span>
                  ))}
                  {contextSample.text_units.map((t) => (
                    <span key={t.asset_id} className="sample-chip">📄 {t.name} ({t.length} chars)</span>
                  ))}
                </div>
              </div>
            )}

            {/* Heuristic Summary Preview */}
            {contextSummary && (
              <div className="context-summary-card">
                <h4>Pre-Discovery Heuristic Summary</h4>
                <p>
                  Domain: <strong>{contextSummary.is_mixed_domain ? "Mixed / Unknown Domain" : contextSummary.candidate_domains.join(", ") || "General"}</strong>
                </p>
                {contextSummary.suggested_vocabulary.length > 0 && (
                  <div>
                    <small>Suggested Vocabulary Hints:</small>
                    <div className="sample-sources-chips">
                      {contextSummary.suggested_vocabulary.map((v) => (
                        <span key={v} className="sample-chip">🏷️ {v}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Few-Shot Example Manager */}
            <div className="examples-manager-section">
              <h4>Few-Shot Examples ({draftLakeConfig.context_config.examples.length})</h4>
              <p className="examples-help">
                Examples provide concrete relationship demonstrations. Quotes must match passage text exactly, and excluded identifiers are rejected.
              </p>

              {draftLakeConfig.context_config.examples.map((ex, idx) => (
                <div key={idx} className="example-item-card">
                  <div className="example-item-header">
                    <div>
                      <strong>{ex.record_a}</strong> ↔ <strong>{ex.record_b}</strong>
                      <span className="example-rel-badge">{ex.relationship} ({ex.direction})</span>
                    </div>
                    <button
                      type="button"
                      className="example-delete-btn"
                      onClick={() => handleDeleteExample(idx)}
                    >
                      Delete
                    </button>
                  </div>
                  <blockquote className="example-passage">{ex.passage}</blockquote>
                  <small className="example-quotes">
                    A quote: <em>"{ex.quote_a}"</em> · B quote: <em>"{ex.quote_b}"</em>
                  </small>
                </div>
              ))}

              {/* Add New Example Form */}
              <div className="add-example-form">
                <h5>Add New Few-Shot Example</h5>
                <div className="form-grid-2">
                  <label>
                    Record A Mention
                    <input
                      value={newExample.record_a}
                      placeholder="e.g. Acme Corp"
                      onChange={(e) => setNewExample({ ...newExample, record_a: e.target.value })}
                    />
                  </label>
                  <label>
                    Record B Mention
                    <input
                      value={newExample.record_b}
                      placeholder="e.g. California"
                      onChange={(e) => setNewExample({ ...newExample, record_b: e.target.value })}
                    />
                  </label>
                </div>

                <div className="form-grid-2">
                  <label>
                    Relationship
                    <input
                      value={newExample.relationship}
                      placeholder="e.g. HEADQUARTERED_IN"
                      onChange={(e) => setNewExample({ ...newExample, relationship: e.target.value })}
                    />
                  </label>
                  <label>
                    Direction
                    <select
                      value={newExample.direction}
                      onChange={(e) => setNewExample({ ...newExample, direction: e.target.value })}
                    >
                      <option value="undirected">Undirected</option>
                      <option value="a_to_b">A → B</option>
                      <option value="b_to_a">B → A</option>
                      <option value="bidirectional">A ↔ B</option>
                    </select>
                  </label>
                </div>

                <label>
                  Evidence Passage
                  <textarea
                    rows={3}
                    value={newExample.passage}
                    placeholder="Exact text passage containing both entity mentions"
                    onChange={(e) => setNewExample({ ...newExample, passage: e.target.value })}
                  />
                </label>

                <div className="form-grid-2">
                  <label>
                    Record A Grounding Quote
                    <input
                      value={newExample.quote_a}
                      placeholder="Substring matching Record A"
                      onChange={(e) => setNewExample({ ...newExample, quote_a: e.target.value })}
                    />
                  </label>
                  <label>
                    Record B Grounding Quote
                    <input
                      value={newExample.quote_b}
                      placeholder="Substring matching Record B"
                      onChange={(e) => setNewExample({ ...newExample, quote_b: e.target.value })}
                    />
                  </label>
                </div>

                {exampleValidationNotice && (
                  <p className="example-val-notice">{exampleValidationNotice}</p>
                )}

                <div className="add-example-actions">
                  <button type="button" className="secondary" onClick={handleValidateNewExample}>
                    Validate Example
                  </button>
                  <button
                    type="button"
                    className="primary"
                    disabled={!newExample.record_a || !newExample.record_b || !newExample.passage}
                    onClick={handleAddExample}
                  >
                    Add to Examples List
                  </button>
                </div>
              </div>
            </div>

            <div className="settings-card-actions-bar">
              <button type="button" className="settings-save-btn" onClick={saveLakeConfigChanges}>
                Save Context Configuration to Lake
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: INPUT POLICIES */}
      {activeSection === "policies" && draftLakeConfig && (
        <div className="settings-tab-panel">
          <div className="settings-card">
            <div className="settings-card-title">
              <span>04</span>
              <div>
                <h2>Input & Candidate Policies</h2>
                <p>Configure candidate generation bounds, identifier exclusion, and null token rules</p>
              </div>
            </div>

            <div className="settings-active-scope-tag">
              Configuration Scope: <strong>Lake-Scoped ({activeLakeName})</strong>
            </div>

            {/* Candidate Policy */}
            <div className="policy-section">
              <h4>Candidate Pair Generation Policy</h4>
              <div className="settings-row">
                <label>
                  Minimum integration candidate pool
                  <input
                    type="number"
                    min={10}
                    max={5000}
                    step={10}
                    value={draftLakeConfig.candidate_policy.max_candidates}
                    onChange={(e) => {
                      const next = {
                        ...draftLakeConfig,
                        candidate_policy: {
                          ...draftLakeConfig.candidate_policy,
                          max_candidates: Number(e.target.value),
                        },
                      };
                      setDraftLakeConfig(next);
                      checkImpact(next);
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted, #888)", display: "block", marginTop: "4px" }}>
                    Candidate pool size; a larger run budget expands this pool automatically, up to 5,000.
                  </span>
                </label>

                <label>
                  Discovery rows per table (0 = all)
                  <input type="number" min={0} max={1000000}
                    value={draftLakeConfig.candidate_policy.discovery_row_limit ?? 0}
                    onChange={e => {
                      const next = {...draftLakeConfig, candidate_policy: {...draftLakeConfig.candidate_policy,
                        discovery_row_limit: Number(e.target.value) || null}};
                      setDraftLakeConfig(next); checkImpact(next);
                    }} />
                </label>
                <label>
                  Context window length (tokens)
                  <input
                    type="number"
                    min={50}
                    max={2048}
                    step={25}
                    value={draftLakeConfig.candidate_policy.context_window_tokens ?? Math.round(draftLakeConfig.candidate_policy.context_window_chars / 4)}
                    onChange={(e) => {
                      const tokens = Number(e.target.value);
                      const next = {
                        ...draftLakeConfig,
                        candidate_policy: {
                          ...draftLakeConfig.candidate_policy,
                          context_window_tokens: tokens,
                          context_window_chars: tokens * 4,
                        },
                      };
                      setDraftLakeConfig(next);
                      checkImpact(next);
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted, #888)", display: "block", marginTop: "4px" }}>
                    Maximum token distance between table mentions in narrative text (default: 300 tokens ≈ 1,200 chars).
                  </span>
                </label>

                <label>
                  Profiling Top-K documents per table
                  <input
                    type="number"
                    min={0}
                    max={50}
                    step={1}
                    value={draftLakeConfig.candidate_policy.profiling_top_k ?? 0}
                    onChange={(e) => {
                      const next = {
                        ...draftLakeConfig,
                        candidate_policy: {
                          ...draftLakeConfig.candidate_policy,
                          profiling_top_k: Number(e.target.value),
                        },
                      };
                      setDraftLakeConfig(next);
                      checkImpact(next);
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted, #888)", display: "block", marginTop: "4px" }}>
                    0 for Auto (dynamically scaled 5–25 based on data lake size), or set 1–50. Changing this marks the profile as needing re-indexing.
                  </span>
                </label>
              </div>

              <label className="hf-checkbox-label" style={{ marginTop: "12px" }}>
                <input
                  type="checkbox"
                  checked={draftLakeConfig.candidate_policy.allow_same_table}
                  onChange={(e) => {
                    const next = {
                      ...draftLakeConfig,
                      candidate_policy: {
                        ...draftLakeConfig.candidate_policy,
                        allow_same_table: e.target.checked,
                      },
                    };
                    setDraftLakeConfig(next);
                    checkImpact(next);
                  }}
                />
                <span>Allow same-table relationship candidates (default: cross-table only)</span>
              </label>
            </div>

            {/* Projection Policy */}
            <div className="policy-section" style={{ marginTop: "24px" }}>
              <h4>Projection & Masking Policy</h4>
              <label>
                Excluded Identifier Column Names (comma-separated)
                <input
                  type="text"
                  value={draftLakeConfig.projection_policy.exclude_identifiers.join(", ")}
                  onChange={(e) => {
                    const ids = e.target.value
                      .split(",")
                      .map((s) => s.trim().toLowerCase())
                      .filter(Boolean);
                    const next = {
                      ...draftLakeConfig,
                      projection_policy: {
                        ...draftLakeConfig.projection_policy,
                        exclude_identifiers: ids,
                      },
                    };
                    setDraftLakeConfig(next);
                    checkImpact(next);
                  }}
                />
                <small>Excluded columns are omitted from text representations and cannot supply model associations.</small>
              </label>

              <label>
                Null Literal Tokens (comma-separated)
                <input
                  type="text"
                  value={draftLakeConfig.projection_policy.null_tokens.join(", ")}
                  onChange={(e) => {
                    const tokens = e.target.value.split(",").map((s) => s.trim());
                    const next = {
                      ...draftLakeConfig,
                      projection_policy: {
                        ...draftLakeConfig.projection_policy,
                        null_tokens: tokens,
                      },
                    };
                    setDraftLakeConfig(next);
                    checkImpact(next);
                  }}
                />
                <small>Values matching these strings are treated as null/empty during tabular projection.</small>
              </label>

              <label className="hf-checkbox-label" style={{ marginTop: "12px" }}>
                <input
                  type="checkbox"
                  checked={draftLakeConfig.projection_policy.mask_identifier_values}
                  onChange={(e) => {
                    const next = {
                      ...draftLakeConfig,
                      projection_policy: {
                        ...draftLakeConfig.projection_policy,
                        mask_identifier_values: e.target.checked,
                      },
                    };
                    setDraftLakeConfig(next);
                    checkImpact(next);
                  }}
                />
                <span>Mask raw numeric identifiers in evidence context</span>
              </label>
            </div>

            {/* Storage & Index Maintenance */}
            <div className="policy-section" style={{ marginTop: "24px", borderTop: "1px solid var(--border, #e2e8f0)", paddingTop: "18px" }}>
              <h4>Lake Storage & Index Maintenance</h4>
              <p style={{ fontSize: "12.5px", color: "var(--text-muted, #64748b)", margin: "4px 0 14px", lineHeight: "1.5" }}>
                When profiling or input policy configurations change, previous vector indexes, candidate join paths, and semantic discovery links become obsolete.
                Resetting clears all derived indexes, vector caches, and runs a physical database vacuum (<code>VACUUM</code>) to reclaim disk space.
                <strong> Original datasets, files, and raw records are completely preserved.</strong>
              </p>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="reset-lake-btn"
                  onClick={handleOpenResetModal}
                  style={{
                    fontWeight: 600,
                    padding: "9px 16px",
                    borderRadius: "6px",
                    cursor: "pointer",
                  }}
                >
                  🗑️ Reset Lake Indexes & Free Disk Space
                </button>
                <span style={{ fontSize: "11.5px", color: "var(--text-muted, #888)" }}>
                  Scope: {activeLakeName} · Preserves all raw ingested data.
                </span>
              </div>
            </div>

            {/* Impact Preview Display */}
            {impactPreview && impactPreview.has_impact && (
              <div className="impact-alert" role="alert">
                <strong>Rebuild Impact Before Activation:</strong>
                <ul>
                  {impactPreview.impacts.map((imp, idx) => (
                    <li key={idx}>{imp}</li>
                  ))}
                </ul>
                <p>Affected stages: <strong>{impactPreview.invalidated_stages.join(", ")}</strong>.</p>
              </div>
            )}
            {impactPreview && !impactPreview.has_impact && explicitImpactChecked && (
              <div className="impact-safe" role="status" style={{ padding: "12px 16px", borderRadius: "8px", background: "rgba(34, 197, 94, 0.1)", border: "1px solid rgba(34, 197, 94, 0.3)", color: "var(--text-success, #22c55e)", margin: "16px 0" }}>
                <strong>✓ No Rebuild Required</strong>
                <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                  Your proposed settings match the active configuration or take effect immediately without invalidating existing data.
                </p>
              </div>
            )}

            <div className="settings-card-actions-bar">
              <button
                type="button"
                className="secondary"
                disabled={impactLoading}
                onClick={() => checkImpact(draftLakeConfig, true)}
              >
                {impactLoading ? "Evaluating Impact…" : "Preview Rebuild Impact"}
              </button>
              <button
                type="button"
                className="secondary reset-lake-btn"
                onClick={handleOpenResetModal}
                style={{ marginRight: "auto" }}
              >
                Reset Indexes…
              </button>
              <button type="button" className="settings-save-btn" onClick={saveLakeConfigChanges}>
                Save Input Policies to Lake
              </button>
            </div>
          </div>
        </div>
      )}

      <p className="settings-footer">
        Lake configurations are saved locally in <code>{activeLakeName}/lake_config.json</code>. Global settings in <code>settings.json</code>.
        {busy && <span role="status"> {busy}…</span>}
      </p>

      {/* Reset Lake Modal */}
      {resetModalOpen && (
        <div className="lake-modal-overlay" onClick={() => !resetExecuting && setResetModalOpen(false)}>
          <div
            className="lake-modal-card"
            style={{ maxWidth: "560px", width: "95vw" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="reset-modal-title"
          >
            <div className="lake-modal-header">
              <div className="lake-danger-icon">⚠️</div>
              <h3 id="reset-modal-title">Reset Lake Derived Indexes ({activeLakeName})</h3>
              <p className="lake-modal-desc">
                Clear all derived profiles, vector indexes, discovery links, candidate join paths, and integration runs to reclaim disk space.
              </p>
            </div>

            <div className="lake-modal-body" style={{ gap: "14px" }}>
              <div
                style={{
                  padding: "10px 14px",
                  borderRadius: "8px",
                  background: "rgba(34, 197, 94, 0.1)",
                  border: "1px solid rgba(34, 197, 94, 0.3)",
                  color: "var(--text-success, #15803d)",
                  fontSize: "12.5px",
                  lineHeight: "1.4",
                }}
              >
                <strong>✓ Raw Data Safe:</strong> All original uploaded datasets, blobs, and raw table records ({resetPreview?.records_count ?? "..."} records across {resetPreview?.sources_count ?? "..."} sources) are preserved and will not be touched.
              </div>

              {resetPreviewLoading && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "var(--text-muted, #64748b)" }}>
                  Analyzing lake storage and derived tables…
                </div>
              )}

              {resetPreview && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr 1fr",
                      gap: "10px",
                      textAlign: "center",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: "var(--bg-muted, #f1f5f9)",
                        border: "1px solid var(--border, #e2e8f0)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Database Size</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main, #1e293b)", marginTop: "2px" }}>
                        {resetPreview.db_size_mb} MB
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: "var(--bg-muted, #f1f5f9)",
                        border: "1px solid var(--border, #e2e8f0)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "var(--text-muted, #64748b)" }}>Vector Index</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-main, #1e293b)", marginTop: "2px" }}>
                        {resetPreview.vector_size_mb} MB
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "8px",
                        background: "rgba(239, 68, 68, 0.08)",
                        border: "1px solid rgba(239, 68, 68, 0.2)",
                      }}
                    >
                      <div style={{ fontSize: "11px", color: "#b91c1c" }}>Reclaimable Space</div>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "#dc2626", marginTop: "2px" }}>
                        ~{resetPreview.total_derived_size_mb} MB
                      </div>
                    </div>
                  </div>

                  <div style={{ fontSize: "12px", color: "var(--text-muted, #64748b)" }}>
                    <strong>Derived artifacts to be purged ({resetPreview.total_derived_rows.toLocaleString()} rows):</strong>
                    <ul style={{ margin: "6px 0 0 16px", padding: 0, lineHeight: "1.5" }}>
                      <li>Discovery links & join paths: <strong>{resetPreview.derived_counts.discovery_links?.toLocaleString() ?? 0}</strong></li>
                      <li>Retrieval & vector units: <strong>{resetPreview.derived_counts.retrieval_units?.toLocaleString() ?? 0}</strong></li>
                      <li>Cross-table bridges: <strong>{resetPreview.derived_counts.discovery_bridges?.toLocaleString() ?? 0}</strong></li>
                      <li>Semantic rank cache & checkpoints: <strong>{((resetPreview.derived_counts.semantic_rank_cache ?? 0) + (resetPreview.derived_counts.semantic_checkpoint ?? 0)).toLocaleString()}</strong></li>
                      <li>Integration runs & evidence: <strong>{resetPreview.derived_counts.integration_plans?.toLocaleString() ?? 0}</strong></li>
                    </ul>
                  </div>

                  <p style={{ margin: "0", fontSize: "11.5px", color: "var(--text-muted, #888)", lineHeight: "1.4" }}>
                    Physical disk space will be immediately recovered using SQLite <code>PRAGMA wal_checkpoint(TRUNCATE)</code>, <code>VACUUM</code>, and LanceDB directory deletion.
                  </p>
                </>
              )}
            </div>

            <div className="lake-modal-footer">
              <button
                type="button"
                className="lake-modal-btn-cancel"
                disabled={resetExecuting}
                onClick={() => setResetModalOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="lake-modal-btn-danger"
                disabled={resetExecuting || resetPreviewLoading}
                onClick={handleConfirmReset}
              >
                {resetExecuting ? "Resetting & Vacuuming…" : "Confirm Reset & Vacuum"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
