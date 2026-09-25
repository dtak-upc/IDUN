import { publicBase, publicFile } from "./paths";
import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { snapshot, type Snapshot } from "./snapshot";
import { RealWorkbench } from "../discovery/RealWorkbench";
import { SemanticResults } from "../integration/SemanticResults";
import "../styles.css";
import "../theme.css";
import "../studio/studio.css";
import "../integration/integration.css";
import "./showcase.css";

function Showcase() {
  const [data, setData] = useState<Snapshot>(),
    [error, setError] = useState("");
  const [page, setPage] = useState("Overview"),
    [evidence, setEvidence] = useState<{ left?: string; right?: string }>({});
  useEffect(() => {
    void snapshot()
      .then(setData)
      .catch((e) => setError(String(e)));
  }, []);
  const openEvidence = (left: string, right: string) => {
    setEvidence({ left, right });
    setPage("Evidence");
  };
  return (
    <div className="showcase">
      <header className="showcase-header">
        <a className="showcase-brand" href={publicBase}>
          <img src={publicFile("idun.png")} alt="IDUN logo" />
          <span>
            <b>IDUN</b>
            <small>Integrating Data-lake of Unstructured Nature</small>
          </span>
        </a>
        <nav aria-label="Demo navigation">
          {["Overview", "Evidence", "Integration", "Live access"].map((p) => (
            <button
              key={p}
              aria-current={page === p ? "page" : undefined}
              onClick={() => {
                setPage(p);
                if (p === "Evidence") setEvidence({});
              }}
            >
              {p}
            </button>
          ))}
        </nav>
        <span className="showcase-saved">SAVED RESEARCH DEMO</span>
      </header>
      <main>
        <div className="showcase-notice">
          Independently authored synthetic data · Saved model results ·
          Exploring this example does not run inference.
        </div>
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p role="status">Loading the saved example…</p>
        ) : page === "Overview" ? (
          <>
            <section className="showcase-intro">
              <span className="live-kicker">
                FROM RAW SOURCES TO EXPLAINABLE RELATIONSHIPS
              </span>
              <h1>
                Follow the evidence.
                <br />
                See the connections.
              </h1>
              <p>
                Explore tables and documents discovered by LOKI, then inspect
                how supporting passages connect their records into separate
                relationship tables.
              </p>
              <button onClick={() => setPage("Evidence")}>
                Explore row-sentence atomic links →
              </button>
              <button onClick={() => setPage("Integration")}>
                View integrated tables →
              </button>
            </section>
            <div className="showcase-metrics">
              <span>
                <b>{Object.keys(data.sources).length}</b> raw sources
              </span>
              <span>
                <b>{data.links.length}</b> saved row-sentence atomic links
              </span>
              <span>
                <b>{data.plan.output.length}</b> joined rows
              </span>
              <span>
                <b>{new Set(data.plan.output.map((r) => r.relation)).size}</b>{" "}
                relationship tables
              </span>
            </div>
            <section>
              <h2>The example data lake</h2>
              <p>
                These sources were supplied as independent CSV and TXT files.
                The demo preserves the resulting source rows, text passages and
                relationship evidence.
              </p>
              <div className="showcase-sources">
                {Object.values(data.sources).map((s) => (
                  <article key={s.id}>
                    <small>{s.kind.toUpperCase()}</small>
                    <h3>{s.name}</h3>
                    <p>
                      {s.kind === "csv"
                        ? `${s.rows.length} records · ${s.columns.join(", ")}`
                        : "Narrative text with evidence passages"}
                    </p>
                  </article>
                ))}
              </div>
            </section>
          </>
        ) : page === "Evidence" ? (
          <RealWorkbench
            linkId={evidence.left}
            companionId={evidence.right}
            onBack={() => setPage("Integration")}
          />
        ) : page === "Integration" ? (
          <SemanticResults
            plan={data.plan}
            busy={false}
            onMaterialize={() => {}}
            onEvidence={openEvidence}
            csvHref={(relation) => publicFile(`demo/${relation || "all"}.csv`)}
          />
        ) : (
          <section className="showcase-access">
            <span className="live-kicker">LIVE INTEGRATION</span>
            <h1>Run an experiment of your own.</h1>
            <p>
              Live integration uses the researcher's model server. Access must
              be approved before a request can enter the inference queue.
            </p>
            <p>
              The public example above stays available when the model server is
              offline. No account or API key is required to explore it.
            </p>
            <p role="status">
              Live access is not open yet. The request channel and protected
              endpoint will be enabled after deployment setup.
            </p>
          </section>
        )}
        <footer>
          Built on LOKI + THOR · This release demonstrates LOKI discovery and
          integration. Augmentation is under development.
        </footer>
      </main>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<Showcase />);
