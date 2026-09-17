import { publicFile } from "./paths";
import type { SemanticPlan } from "../integration/SemanticResults";
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
    } else {
      result = { discovery_ready: true, plans: [{ ...s.plan, stale: false }] };
    }
  } else if (url.pathname === `/integration/${s.plan.id}`) {
    result = s.plan;
  } else if (url.pathname.endsWith("/diff")) {
    result = {
      baseline_id: "",
      current_id: id,
      added: [],
      removed: [],
      unchanged: s.plan.output.length,
    };
  } else if (url.pathname === "/integration/schema/defaults") {
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

