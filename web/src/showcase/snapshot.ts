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
export async function savedApi<T>(path: string): Promise<T> {
  const s = await snapshot(),
    url = new URL(path, "https://snapshot.invalid");
  const id = url.pathname.split("/").at(-1)!;
  const source = url.searchParams.get("source") || "",
    candidate = url.searchParams.get("candidate") || "";
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));
  const revision = s.state.revision;
  let result: unknown;
  if (url.pathname === "/assets") {
    const query = (url.searchParams.get("q") || "").toLowerCase();
    const dataset = url.searchParams.get("dataset");
    const assets = s.assets.filter(a => a.name.toLowerCase().includes(query) && (!dataset || dataset === a.dataset_id)).map(a => ({...a, path:a.name}));
    result = {total:s.assets.length, matched:assets.length, offset, assets:assets.slice(offset, offset+25)};
  } else if (url.pathname === "/integration") {
    result = {discovery_ready:true, plans:[{...s.plan, stale:false}]};
  } else if (url.pathname === `/integration/${s.plan.id}`) {
    result = s.plan;
  } else if (url.pathname === "/lakes") {
    result = {
      lakes: [{ id: "demo", name: "Demo", files: s.assets.length }],
      default_id: "demo",
    };
  } else if (url.pathname === "/settings/hf/loaded") {
    result = { loaded: false, repo_id: "", vram_mb: 0 };
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
    const links = url.pathname.endsWith("/links") ? s.links.filter(l => !source || l.table === source || l.text === source) : s.bridges;
    result = {total:links.length, offset, items:links.slice(offset, offset+20)};
  } else if (s.routes[url.pathname]) {
    result = s.routes[url.pathname];
  } else if (url.pathname === "/discovery") result = s.state;
  else if (url.pathname.startsWith("/discovery/links/")) {
    result = s.links.find((l) => l.id === id);
  } else if (url.pathname === "/discovery/workbench") {
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
        name: s.sources[other].name,
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
  } else if (url.pathname === "/discovery/workbench-links") {
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
