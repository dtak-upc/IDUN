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
  if (url.pathname === "/discovery") result = s.state;
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
