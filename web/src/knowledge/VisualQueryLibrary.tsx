import { useEffect, useRef, useState, type ReactNode } from "react";
export type QueryRecipe = {
  id: string;
  title: string;
  version: string;
  updated: number;
  query: Record<string, unknown>;
};
type Post = <T>(path: string, body: unknown) => Promise<T>;
export function downloadAnswers(
  format: "json" | "csv",
  result: unknown,
  query: unknown,
) {
  const data = result as {
    items: {
      shared_intervals?: { start: string; end: string }[];
      start: { label: string };
      steps: {
        relation: string;
        target: { id: string; label: string; source: string; row: number };
        kind?: string;
        contributions?: unknown[];
      }[];
    }[];
  };
  const cell = (v: unknown) => {
    let s = String(v ?? "");
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const content =
    format === "json"
      ? JSON.stringify(
          { exported_at: new Date().toISOString(), query, result },
          null,
          2,
        )
      : [
          [
            "answer",
            "step",
            "start",
            "relationship",
            "target",
            "source",
            "row",
            "status",
            "provenance",
            "query_context",
            "shared_validity",
          ]
            .map(cell)
            .join(","),
          ...data.items.flatMap((w, i) =>
            w.steps.map((s, j) =>
              [
                i + 1,
                j + 1,
                w.start.label,
                s.relation,
                s.target.label,
                s.target.source,
                s.target.id ? s.target.row : "",
                s.kind === "optional_missing"
                  ? "optional unmatched"
                  : "matched",
                JSON.stringify(s.contributions ?? []),
                JSON.stringify({
                  query,
                  result: { ...(result as object), items: undefined },
                }),
                JSON.stringify(w.shared_intervals ?? []),
              ]
                .map(cell)
                .join(","),
            ),
          ),
        ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([content], {
      type: format === "json" ? "application/json" : "text/csv;charset=utf-8",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `idun-query-answers.${format}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function VisualQueryLibrary({
  children,
  selectedRecipe,
  post,
  draft,
  token,
  disabled,
  onLoad,
}: {
  children?: ReactNode;
  selectedRecipe?: QueryRecipe;
  post: Post;
  draft: Record<string, unknown>;
  token?: string;
  disabled: boolean;
  onLoad: (
    r: QueryRecipe & { graph: unknown; runs: string[]; stale: boolean },
  ) => void;
}) {
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(""),
    [offset, setOffset] = useState(0),
    [refresh, setRefresh] = useState(0),
    [catalog, setCatalog] = useState<{ items: QueryRecipe[]; total: number }>(),
    [title, setTitle] = useState(""),
    [selected, setSelected] = useState<QueryRecipe>(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => {
      void post<{ items: QueryRecipe[]; total: number }>(
        "saved-visual-queries",
        { search, offset },
      )
        .then((r) => {
          if (alive) setCatalog(r);
        })
        .catch((e) => {
          if (alive) setError(String(e));
        });
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [post, open, search, offset, refresh]);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    if (selectedRecipe) {
      setSelected(selectedRecipe);
      setTitle(selectedRecipe.title);
    }
  }, [selectedRecipe]);
  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true);
    setError("");
    try {
      const r = await post<
        QueryRecipe & { graph: unknown; runs: string[]; stale: boolean }
      >(action, {
        id: selected?.id,
        version: selected?.version,
        title,
        ...extra,
      });
      if (!alive.current) return;
      if (action === "get-saved-visual-query") {
        setSelected(r);
        setTitle(r.title);
        onLoad(r);
      } else if (action === "remove-saved-visual-query") {
        setSelected(undefined);
        setTitle("");
      } else {
        setSelected(r);
        setTitle(r.title);
      }
      setRefresh((v) => v + 1);
    } catch (e) {
      if (alive.current) setError(String(e));
    } finally {
      if (alive.current) setBusy(false);
    }
  }
  return (
    <section className="kg-query-library">
      <div className="kg-query-toolbar">
        {children}
        <button aria-expanded={open} onClick={() => setOpen(!open)}>
          Save / Find query
        </button>
      </div>
      {open && (
        <div className="kg-query-library-body">
          <div>
            <label>
              Find a saved query
              <input
                aria-label="Find saved queries"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOffset(0);
                }}
              />
            </label>
            <div className="kg-query-recipe-list">
              {catalog?.items?.map((r) => (
                <button
                  key={r.id}
                  disabled={disabled || busy}
                  aria-pressed={selected?.id === r.id}
                  onClick={() =>
                    void act("get-saved-visual-query", { id: r.id })
                  }
                >
                  <strong>{r.title}</strong>
                  <small>
                    {new Date(r.updated * 1000).toLocaleString()} · Load draft
                  </small>
                </button>
              ))}
            </div>
            {catalog && (
              <div className="kg-auto-actions">
                <button
                  disabled={!offset || busy}
                  onClick={() => setOffset(Math.max(0, offset - 10))}
                >
                  Previous
                </button>
                <span>
                  Page {Math.floor(offset / 10) + 1} /{" "}
                  {Math.max(1, Math.ceil(catalog.total / 10))}
                </span>
                <button
                  disabled={offset + 10 >= catalog.total || busy}
                  onClick={() => setOffset(offset + 10)}
                >
                  Next
                </button>
              </div>
            )}
          </div>
          <div>
            <label>
              Query name
              <input
                aria-label="Saved query name"
                value={title}
                maxLength={100}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <div className="kg-auto-actions">
              <button
                disabled={disabled || busy || !token || !title.trim()}
                onClick={() =>
                  void act("save-visual-query", {
                    id: undefined,
                    query: draft,
                    preview_token: token,
                  })
                }
              >
                Save as new
              </button>
              {selected && (
                <>
                  <button
                    disabled={disabled || busy || !token || !title.trim()}
                    onClick={() =>
                      void act("save-visual-query", {
                        query: draft,
                        preview_token: token,
                      })
                    }
                  >
                    Update saved query
                  </button>
                  <button
                    disabled={disabled || busy || !title.trim()}
                    onClick={() => void act("rename-saved-visual-query")}
                  >
                    Rename
                  </button>
                  <button
                    disabled={disabled || busy}
                    onClick={() => void act("remove-saved-visual-query")}
                  >
                    Delete query
                  </button>
                </>
              )}
            </div>
            <p>
              Loading never runs inference or a query. Deleted runs and
              unavailable saved views cannot be substituted.
            </p>
            {error && <p role="alert">{error}</p>}
          </div>
        </div>
      )}
    </section>
  );
}
