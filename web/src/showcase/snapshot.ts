import { publicFile } from "./paths";
import type { SemanticPlan, DiffData } from "../integration/SemanticResults";
export type Link = {
  id: string;
  table: string;
  text: string;
  row_index: number;
  row_version: string;
  text_version: string;
  context: string;
  start: number;
  end: number;
  score: number;
  text_preview: string;
};
type Row = { index: number; record_id: string; cells: string[] };
export type Source = {
  id: string;
  name: string;
  kind: string;
  columns: string[];
  rows: Row[];
  text: string;
  total: number;
  excluded_columns: number;
};
export type Snapshot = {
  assets: import("../storage/api").Job[];
  routes: Record<string, unknown>;
  bridges: (Link & {left: string; right: string})[];
  version: number;
  state: {
    revision: string;
    status: string;
    sources: { id: string; name: string }[];
  };
  sources: Record<string, Source>;
  links: Link[];
  plan: SemanticPlan;
};
let loaded: Promise<Snapshot> | undefined;
export function snapshot() {
  return (loaded ||= fetch(publicFile("demo/snapshot.json")).then(async (response) => {
    if (!response.ok) throw Error("The saved example is unavailable.");
    return response.json() as Promise<Snapshot>;
  }));
}

let mockLakes: { id: string; name: string; files: number }[] = [
  { id: "demo", name: "Demo", files: 4 },
  { id: "secondary-demo", name: "Secondary Demo Lake", files: 0 },
];

let mockPlans: (SemanticPlan & { created?: number; stale?: boolean })[] | null = null;

function ensureMockPlans(s: Snapshot) {
  if (mockPlans) return mockPlans;

  // Run 1: Baseline Schema Extraction (earlier, strict rule pass, 7 rows)
  const baselineOutput = [
    s.plan.output[0], // Nausea - Metformin (ADVERSE_EFFECT)
    s.plan.output[2], // Confusion - Zolpidem (ADVERSE_EFFECT)
    s.plan.output[3], // Confusion - Zolpidem (DISCONTINUED)
    s.plan.output[4], // Insomnia - Zolpidem (DISCONTINUED)
    s.plan.output[5], // Insomnia - Zolpidem (TREATS)
    s.plan.output[6], // Asthma - Albuterol (TREATS)
    {
      ...s.plan.output[8],
      relation: "NEGATIVE",
      evidence_quote: "Patient reported past history of diabetes without active continuation note in initial intake summary.",
    },
  ];

  const baselinePlan: SemanticPlan & { created?: number; stale?: boolean } = {
    ...s.plan,
    id: "7a9f12d8e05c4b31a89c6298517240fa",
    title: "Baseline Schema Extraction",
    description: "Initial rule-grounded schema extraction on synthetic clinic notes prior to cross-encoder refinement.",
    materialized: false,
    stale: true,
    model: "meta-llama/Llama-3.2-3B-Instruct",
    seconds: 2.8,
    counts: { include: 4, abstain: 8, conflict: 0 },
    coverage: {
      ...s.plan.coverage,
      reviewed: 10,
      available_pairs: 12,
    },
    pipeline: {
      model: "meta-llama/Llama-3.2-3B-Instruct",
      device: "cuda",
      clustering: "hdbscan",
    },
    cases: s.plan.cases.slice(0, 4),
    decisions: s.plan.decisions.slice(0, 4),
    output: baselineOutput,
    created: 1726000000,
  };

  // Run 2: Refined Clinical Relation Synthesis (current, 9 rows)
  const refinedPlan: SemanticPlan & { created?: number; stale?: boolean } = {
    ...s.plan,
    id: s.plan.id,
    title: s.plan.title || "Refined Clinical Relation Synthesis",
    materialized: true,
    stale: false,
    created: 1726086400,
    model: s.plan.model || "ISTA-DASLab/Qwen3.8-27B-GSQ-RCO-GGUF",
  };

  mockPlans = [refinedPlan, baselinePlan];
  return mockPlans;
}

function getMockDiff(targetId: string, s: Snapshot): DiffData {
  const plans = ensureMockPlans(s);
  const targetIndex = plans.findIndex(p => p.id === targetId);
  const currentPlan = targetIndex >= 0 ? plans[targetIndex] : plans[0];
  const previousPlan = targetIndex >= 0 && targetIndex + 1 < plans.length ? plans[targetIndex + 1] : null;

  if (!previousPlan) {
    return {
      has_previous: false,
      current: {
        id: currentPlan.id,
        title: currentPlan.title,
        created: currentPlan.created || 1726000000,
        model: currentPlan.model,
      },
      previous: null,
      counts: {
        added: 0,
        changed: 0,
        withdrawn: 0,
        unchanged: currentPlan.output.length,
        total_current: currentPlan.output.length,
        total_previous: 0,
      },
      rows: currentPlan.output.map(r => ({ ...r, diff_status: "unchanged" })),
    };
  }

  // Comparing Run 2 vs Run 1
  if (currentPlan.id === s.plan.id && previousPlan.id === "7a9f12d8e05c4b31a89c6298517240fa") {
    return {
      has_previous: true,
      current: {
        id: currentPlan.id,
        title: currentPlan.title,
        created: currentPlan.created || 1726086400,
        model: currentPlan.model,
      },
      previous: {
        id: previousPlan.id,
        title: previousPlan.title,
        created: previousPlan.created || 1726000000,
        model: previousPlan.model,
      },
      counts: {
        added: 2,
        changed: 1,
        withdrawn: 0,
        unchanged: 6,
        total_current: 9,
        total_previous: 7,
      },
      rows: [
        { ...s.plan.output[0], diff_status: "unchanged" },
        {
          ...s.plan.output[1],
          diff_status: "added",
          diff_notes: "Newly synthesized from follow-up note narrative passage.",
        },
        { ...s.plan.output[2], diff_status: "unchanged" },
        { ...s.plan.output[3], diff_status: "unchanged" },
        { ...s.plan.output[4], diff_status: "unchanged" },
        { ...s.plan.output[5], diff_status: "unchanged" },
        { ...s.plan.output[6], diff_status: "unchanged" },
        {
          ...s.plan.output[7],
          diff_status: "added",
          diff_notes: "Extracted after multi-hop context resolution from provider instructions.",
        },
        {
          ...s.plan.output[8],
          diff_status: "changed",
          previous_relation: "NEGATIVE",
          diff_notes: "Refined prompt and threshold confirmed maintenance therapy from clinical note narrative.",
        },
      ],
    };
  }

  return {
    has_previous: true,
    current: {
      id: currentPlan.id,
      title: currentPlan.title,
      created: currentPlan.created || Math.floor(Date.now() / 1000),
      model: currentPlan.model,
    },
    previous: {
      id: previousPlan.id,
      title: previousPlan.title,
      created: previousPlan.created || Math.floor(Date.now() / 1000) - 3600,
      model: previousPlan.model,
    },
    counts: {
      added: 0,
      changed: 0,
      withdrawn: 0,
      unchanged: currentPlan.output.length,
      total_current: currentPlan.output.length,
      total_previous: previousPlan.output.length,
    },
    rows: currentPlan.output.map(r => ({ ...r, diff_status: "unchanged" })),
  };
}

let mockConfig = {
  api_python: "C:\\Users\\IDUN\\miniconda3\\envs\\THOR\\python.exe",
  model_python: "C:\\Users\\IDUN\\miniconda3\\envs\\THOR\\python.exe",
  device: "auto",
  vram_gib: 16,
  llm: {
    provider: "huggingface",
    base_url: "http://127.0.0.1:11434/v1",
    model: "meta-llama/Llama-3.2-3B-Instruct",
    key_env: "",
    timeout_seconds: 60,
    max_output_tokens: 2048,
    temperature: 0.1,
    top_p: 0.95,
    auto_unload: true,
  },
};

let mockHfLoaded = {
  loaded: false,
  repo_id: "",
  vram_mb: 0,
};

const mockHfModels = [
  {
    repo_id: "meta-llama/Llama-3.2-3B-Instruct",
    name: "Llama 3.2 3B Instruct",
    params: "3.21B",
    vram_estimate: "~3.8 GiB (4-bit)",
    gated: false,
    recommended: true,
    description: "Compact multimodal/reasoning model optimized for local clinical entity synthesis.",
    downloaded: true,
    loaded: false,
    size_str: "2.4 GB",
    size_on_disk: 2576980377,
    format: "safetensors",
    compatible: true,
  },
  {
    repo_id: "meta-llama/Llama-3.1-8B-Instruct",
    name: "Llama 3.1 8B Instruct",
    params: "8.03B",
    vram_estimate: "~6.2 GiB (4-bit)",
    gated: false,
    recommended: true,
    description: "High-accuracy open instruction model with 128k context window.",
    downloaded: false,
    loaded: false,
    size_str: "5.7 GB",
    size_on_disk: 0,
    format: "safetensors",
    compatible: true,
  },
  {
    repo_id: "Qwen/Qwen2.5-7B-Instruct",
    name: "Qwen 2.5 7B Instruct",
    params: "7.61B",
    vram_estimate: "~5.8 GiB (4-bit)",
    gated: false,
    recommended: false,
    description: "Exceptional multilingual structured extraction and biomedical schema following.",
    downloaded: false,
    loaded: false,
    size_str: "4.9 GB",
    size_on_disk: 0,
    format: "safetensors",
    compatible: true,
  },
  {
    repo_id: "mistralai/Mistral-7B-Instruct-v0.3",
    name: "Mistral 7B Instruct v0.3",
    params: "7.25B",
    vram_estimate: "~5.4 GiB (4-bit)",
    gated: false,
    recommended: false,
    description: "Fast inference instruction model with function calling and sliding window attention.",
    downloaded: false,
    loaded: false,
    size_str: "4.5 GB",
    size_on_disk: 0,
    format: "safetensors",
    compatible: true,
  },
];

function getMockSettingsInfo() {
  return {
    settings: { ...mockConfig, llm: { ...mockConfig.llm } },
    active_api_python: mockConfig.api_python,
    next_api_python: mockConfig.api_python,
    api_restart_required: false,
    restart_available: true,
    process_id: 10452,
    restart_error: "",
    runtime: {
      python: "3.11.9 (main, Apr 19 2024) [MSC v.1929 64 bit (AMD64)]",
      device: "cuda",
      vram_gib: 16,
    },
    environments: [
      { path: "C:\\Users\\IDUN\\miniconda3\\envs\\THOR\\python.exe", name: "THOR (Python 3.11 · Conda)" },
      { path: "C:\\Users\\IDUN\\miniconda3\\envs\\LOKI\\python.exe", name: "LOKI (Python 3.10 · Conda)" },
      { path: "C:\\Python311\\python.exe", name: "System Python 3.11" },
    ],
    overrides: { api: false, model: false },
    key_available: true,
    last_discovery: {
      device: "cuda",
      seconds: 1.42,
      peak_reserved_gib: 3.85,
      scored_contexts: 4,
      reused_contexts: 0,
    },
    storage: "Local SQLite + Chroma Vector Store",
  };
}

export async function savedApi<T>(path: string, init?: RequestInit, lake = ""): Promise<T> {
  const s = await snapshot(),
    url = new URL(path, "https://snapshot.invalid");
  const id = url.pathname.split("/").at(-1)!;
  const source = url.searchParams.get("source") || "",
    candidate = url.searchParams.get("candidate") || "";
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const revision = s.state.revision;
  const method = (init?.method || "GET").toUpperCase();
  let body: any = {};
  if (init?.body && typeof init.body === "string") {
    try { body = JSON.parse(init.body); } catch {}
  }

  let result: unknown;

  // Lake management endpoints
  if (url.pathname === "/lakes") {
    if (method === "POST") {
      const lakeName = (body.name || "New Lake").trim();
      const newId = lakeName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || ("lake-" + Date.now());
      const created = { id: newId, name: lakeName, files: 0 };
      mockLakes.push(created);
      result = created;
    } else {
      result = {
        lakes: [...mockLakes],
        default_id: mockLakes[0]?.id || "demo",
      };
    }
  } else if (url.pathname.startsWith("/lakes/")) {
    const targetId = url.pathname.split("/")[2];
    if (url.pathname.endsWith("/removal-preview")) {
      const target = mockLakes.find(l => l.id === targetId);
      result = {
        id: targetId,
        name: target?.name || targetId,
        files: target?.files || 0,
        runs: 0,
        token: "mock-token-" + Date.now(),
      };
    } else if (url.pathname.endsWith("/remove")) {
      mockLakes = mockLakes.filter(l => l.id !== targetId);
      if (mockLakes.length === 0) {
        mockLakes = [{ id: "demo", name: "Demo", files: s.assets?.length || 4 }];
      }
      result = {
        next_lake: mockLakes[0],
        cleanup_pending: false,
      };
    } else if (method === "POST") {
      const target = mockLakes.find(l => l.id === targetId);
      if (target) {
        target.name = (body.name || target.name).trim();
        result = target;
      } else {
        result = { id: targetId, name: body.name || targetId, files: 0 };
      }
    }
  } else if (url.pathname === "/settings") {
    if (method === "POST") {
      if (body && typeof body === "object") {
        mockConfig = {
          ...mockConfig,
          ...body,
          llm: { ...mockConfig.llm, ...(body.llm || {}) },
        };
      }
      result = getMockSettingsInfo();
    } else {
      result = getMockSettingsInfo();
    }
  } else if (url.pathname === "/settings/restart") {
    result = { ok: true, message: "API restarted successfully." };
  } else if (url.pathname === "/settings/runtime-probe") {
    result = {
      python: "3.11.9 (tags/v3.11.9:de5405b, Apr 2 2024, 14:12:22) [MSC v.1938 64 bit (AMD64)]",
      version: "3.11.9",
      python_supported: true,
      packages: {
        torch: "2.5.1+cu124",
        transformers: "4.46.2",
        accelerate: "1.1.1",
        bitsandbytes: "0.44.1",
        sentence_transformers: "3.3.0",
      },
      cuda_available: true,
      cuda_build: "12.4",
      gpus: [
        { name: "NVIDIA GeForce RTX 4090", total_gib: 24.0 },
      ],
      loki_dependencies_present: true,
    };
  } else if (url.pathname === "/settings/hf/models") {
    result = {
      models: mockHfModels,
      loaded: mockHfLoaded,
    };
  } else if (url.pathname === "/settings/hf/loaded") {
    result = mockHfLoaded;
  } else if (url.pathname === "/settings/hf/unload") {
    const prevRepo = mockHfLoaded.repo_id || "meta-llama/Llama-3.2-3B-Instruct";
    mockHfLoaded = { loaded: false, repo_id: "", vram_mb: 0 };
    result = { unloaded: true, repo_id: prevRepo };
  } else if (url.pathname === "/settings/hf/download") {
    const target = mockHfModels.find(m => m.repo_id === body.repo_id);
    if (target) target.downloaded = true;
    result = { ok: true, message: `Model download initialized for ${body.repo_id || ""}` };
  } else if (url.pathname === "/settings/hf/download/status") {
    result = {
      status: "idle",
      repo_id: "",
      message: "",
      percent: 0,
      error: "",
    };
  } else if (url.pathname === "/settings/hf/download/cancel") {
    result = { ok: true };
  } else if (url.pathname === "/settings/hf/delete") {
    const target = mockHfModels.find(m => m.repo_id === body.repo_id);
    if (target) target.downloaded = false;
    result = { ok: true };
  } else if (url.pathname === "/settings/llm-test") {
    result = {
      ok: true,
      message: "Model response verified. Structured extraction engine functional.",
    };
  } else if (url.pathname === "/session/logout") {
    result = { ok: true };
  } else if (url.pathname === "/health") {
    result = { status: "ok" };
  } else if (url.pathname === "/datasets") {
    result = { datasets: [] };
  } else if (url.pathname === "/jobs") {
    result = { jobs: (lake === "demo" || !lake) ? s.assets : [] };
  } else if (url.pathname.startsWith("/assets/") && url.pathname.endsWith("/preview")) {
    const assetId = url.pathname.split("/")[2];
    const src = s.sources[assetId];
    if (src) {
      result = {
        version: "1",
        total: src.total || src.rows?.length || 1,
        offset,
        offsetUnit: src.kind === "csv" ? "records" : "bytes",
        records: src.rows?.length
          ? src.rows.map(r => ({ id: r.record_id, index: r.index, start: null, end: null, value: r.cells, clipped: false }))
          : [{ id: assetId, index: 1, start: 0, end: src.text?.length || 0, value: src.text, clipped: false }],
      };
    } else {
      result = { version: "1", total: 0, offset: 0, offsetUnit: "records", records: [] };
    }
  } else if (url.pathname === "/assets") {
    if (lake && lake !== "demo") {
      result = { total: 0, matched: 0, offset, assets: [] };
    } else {
      const query = (url.searchParams.get("q") || "").toLowerCase();
      const dataset = url.searchParams.get("dataset");
      const assets = s.assets.filter(a => a.name.toLowerCase().includes(query) && (!dataset || dataset === a.dataset_id)).map(a => ({...a, path:a.name}));
      result = { total: s.assets.length, matched: assets.length, offset, assets: assets.slice(offset, offset + 25) };
    }
  } else if (url.pathname === "/integration") {
    if (lake && lake !== "demo") {
      result = { discovery_ready: false, plans: [] };
    } else if (method === "POST") {
      const plans = ensureMockPlans(s);
      const timeStr = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const newId = "run-" + Date.now().toString(16).slice(-8);
      const newPlan: SemanticPlan & { created?: number; stale?: boolean } = {
        ...s.plan,
        id: newId,
        title: `Proposed Synthesis (${timeStr})`,
        description: `Interactive candidate batch proposed with ${mockConfig.llm.model || "Llama-3.2-3B"}.`,
        created: Math.floor(Date.now() / 1000),
        materialized: false,
        stale: false,
        model: mockConfig.llm.model || "meta-llama/Llama-3.2-3B-Instruct",
        counts: { include: 6, abstain: 6, conflict: 0 },
      };
      plans.unshift(newPlan);
      result = {
        discovery_ready: true,
        plans: plans.map(p => ({
          id: p.id,
          title: p.title,
          model: p.model,
          created: p.created,
          materialized: p.materialized,
          stale: p.stale ?? false,
          counts: p.counts,
        })),
      };
    } else {
      const plans = ensureMockPlans(s);
      result = {
        discovery_ready: true,
        plans: plans.map(p => ({
          id: p.id,
          title: p.title,
          model: p.model,
          created: p.created,
          materialized: p.materialized,
          stale: p.stale ?? false,
          counts: p.counts,
        })),
      };
    }
  } else if (url.pathname === "/integration/cancel") {
    const plans = ensureMockPlans(s);
    result = {
      discovery_ready: true,
      plans: plans.map(p => ({
        id: p.id,
        title: p.title,
        model: p.model,
        created: p.created,
        materialized: p.materialized,
        stale: p.stale ?? false,
        counts: p.counts,
      })),
    };
  } else if (url.pathname.startsWith("/integration/")) {
    const segments = url.pathname.split("/");
    const targetId = segments[2];
    const action = segments[3];
    if (url.pathname === "/integration/schema/defaults") {
      result = {
        modes: ["strict", "hybrid", "open"],
        default_mode: "strict",
        defaults: [
          { label: "TREATS", definition: "Medication prescribed, started or continued to manage diagnosis.", enabled: true },
          { label: "ADVERSE_EFFECT", definition: "Medication caused, worsened or suspected to cause symptom.", enabled: true },
          { label: "DISCONTINUED", definition: "Medication stopped, held or switched away from.", enabled: true },
          { label: "CONTRAINDICATED", definition: "Medication unsafe/inappropriate for this diagnosis/context.", enabled: true },
          { label: "NEGATIVE", definition: "Evidence indicates medication is for a different diagnosis.", enabled: true },
          { label: "UNRESOLVED", definition: "Insufficient evidence in narrative to determine relationship.", enabled: true },
        ],
      };
    } else if (url.pathname === "/integration/schema/probe") {
      result = {
        probed_count: 4,
        available_pairs: 12,
        defaults: [
          { label: "TREATS", definition: "Medication prescribed, started or continued to manage diagnosis.", enabled: true },
          { label: "ADVERSE_EFFECT", definition: "Medication caused, worsened or suspected to cause symptom.", enabled: true },
          { label: "DISCONTINUED", definition: "Medication stopped, held or switched away from.", enabled: true },
          { label: "CONTRAINDICATED", definition: "Medication unsafe/inappropriate for this diagnosis/context.", enabled: true },
          { label: "NEGATIVE", definition: "Evidence indicates medication is for a different diagnosis.", enabled: true },
          { label: "UNRESOLVED", definition: "Insufficient evidence in narrative to determine relationship.", enabled: true },
        ],
        suggestions: [
          {
            label: "TREATS",
            definition: "Medication prescribed, started or continued to manage diagnosis.",
            occurrences: 3,
            is_default: true,
            sample_quotes: [
              { diagnosis: "Hypertension", medication: "Lisinopril", quote: "Initiated lisinopril 10 mg daily for blood pressure control." },
            ],
          },
          {
            label: "ADVERSE_EFFECT",
            definition: "Medication caused, worsened or suspected to cause symptom.",
            occurrences: 2,
            is_default: true,
            sample_quotes: [
              { diagnosis: "Dry cough", medication: "Lisinopril", quote: "Patient developed persistent non-productive dry cough after starting ACE inhibitor." },
            ],
          },
          {
            label: "DISCONTINUED",
            definition: "Medication stopped, held or switched away from.",
            occurrences: 4,
            is_default: true,
            sample_quotes: [
              { diagnosis: "Cough", medication: "Lisinopril", quote: "Discontinued lisinopril due to intolerable cough." },
            ],
          },
        ],
      };
    } else if (action === "diff") {
      result = getMockDiff(targetId, s);
    } else if (action === "rename") {
      const plans = ensureMockPlans(s);
      const target = plans.find(p => p.id === targetId);
      if (target) target.title = (body.title || target.title).trim();
      result = { ok: true, id: targetId, title: target?.title || body.title };
    } else if (action === "remove") {
      const plans = ensureMockPlans(s);
      mockPlans = plans.filter(p => p.id !== targetId);
      if (mockPlans.length === 0) {
        mockPlans = null;
        ensureMockPlans(s);
      }
      result = { removed: targetId };
    } else if (action === "materialize") {
      const plans = ensureMockPlans(s);
      const target = plans.find(p => p.id === targetId);
      if (target) target.materialized = true;
      result = { ok: true, id: targetId };
    } else {
      const plans = ensureMockPlans(s);
      const target = plans.find(p => p.id === targetId);
      result = target || s.plan;
    }
  } else if (url.pathname === "/discovery/links" || url.pathname === "/discovery/bridges") {
    if (lake && lake !== "demo") {
      result = { total: 0, offset, items: [] };
    } else {
      const links = url.pathname.endsWith("/links") ? s.links.filter(l => !source || l.table === source || l.text === source) : s.bridges;
      result = { total: links.length, offset, items: links.slice(offset, offset + 20) };
    }
  } else if (s.routes && s.routes[url.pathname]) {
    result = s.routes[url.pathname];
  } else if (url.pathname === "/discovery") {
    if (lake && lake !== "demo") {
      result = { status: "idle", revision: "0", sources: [] };
    } else {
      result = s.state;
    }
  } else if (url.pathname.startsWith("/discovery/links/")) {
    result = s.links.find((l) => l.id === id);
  } else if (url.pathname === "/discovery/workbench") {
    if (lake && lake !== "demo") {
      result = { revision: "0", source, kind: "table", total: 0, k: 5, candidates: [] };
    } else {
      const k = Math.min(20, Math.max(1, Number(url.searchParams.get("k") || 5)));
      const groups = new Map<
        string,
        { id: string; name: string; score: number; links: number }
      >();
      for (const link of s.links) {
        const other =
          link.table === source
            ? link.text
            : link.text === source
              ? link.table
              : "";
        if (!other) continue;
        const group = groups.get(other) || {
          id: other,
          name: s.sources[other]?.name || other,
          score: 0,
          links: 0,
        };
        group.score = Math.max(group.score, link.score);
        group.links++;
        groups.set(other, group);
      }
      result = {
        revision,
        source,
        kind: s.sources[source]?.kind,
        total: groups.size,
        k,
        candidates: [...groups.values()]
          .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
          .slice(0, k),
      };
    }
  } else if (url.pathname === "/discovery/workbench-links") {
    if (lake && lake !== "demo") {
      result = { revision: "0", total: 0, offset, items: [] };
    } else {
      const links = s.links.filter(
        (l) =>
          (l.table === source && l.text === candidate) ||
          (l.text === source && l.table === candidate),
      );
      result = {
        revision,
        total: links.length,
        offset,
        items: links.slice(offset, offset + 20),
      };
    }
  } else if (url.pathname.startsWith("/discovery/evidence/")) {
    const first = s.links.find((l) => l.id === id);
    if (!first) throw Error("Saved evidence not found");
    const companion = url.searchParams.get("companion");
    const second = companion
      ? s.links.find((l) => l.id === companion)
      : undefined;
    if (
      companion &&
      (!second ||
        second.table === first.table ||
        second.context !== first.context ||
        second.text !== first.text ||
        second.start !== first.start ||
        second.end !== first.end)
    )
      throw Error("Invalid saved bridge");
    const links = second ? [first, second] : [first];
    const text = Array.from(s.sources[first.text].text),
      start = Math.max(0, first.start - 1200),
      end = Math.min(text.length, first.end + 1200);
    if (text.slice(first.start, first.end).join("") !== first.text_preview)
      throw Error("Saved evidence offsets do not match");
    result = {
      revision,
      links,
      tables: links.map((l) => {
        const source = s.sources[l.table];
        return {
          ...source,
          selected: l.row_index,
          rows: source.rows.slice(
            Math.max(0, l.row_index - 6),
            Math.max(0, l.row_index - 6) + 11,
          ),
        };
      }),
      document: {
        id: first.text,
        name: s.sources[first.text].name,
        text: text.slice(start, end).join(""),
        start,
        end,
        highlight_start: first.start,
        highlight_end: first.end,
        version: first.text_version,
      },
    };
  }

  if (result === undefined)
    throw Error(
      "This action is not part of the saved demo. Live inference requires access.",
    );
  return result as T;
}

