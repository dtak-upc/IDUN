import { IntegratedDatasets } from "./integration/IntegratedDatasets";
import { Settings } from "./settings/Settings";
import { publicDemo } from "./mode";
import { LiveDiscovery, LiveEvidence } from "./discovery/LiveDiscovery";
import { LakeProfile } from "./inference/LakeProfile";
import { InferenceReadiness } from "./inference/Readiness";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import "./intake/intake.css";
import { useIntake } from "./intake/useIntake";
import {
  collectDrop,
  folderSelection,
  type FolderCollection,
} from "./intake/folders";
import { Workbench } from "./evidence/Workbench";
import type { WorkbenchView } from "./evidence/example";
import { Discovery } from "./discovery/Discovery";
import { IntakeReview } from "./intake/IntakeReview";

import "./theme.css";
import "./studio/studio.css";
import { LakeScene } from "./studio/LakeScene";
import { Augmentation, History } from "./augmentation/Review";
import { SavedLake } from "./storage/SavedLake";
import type { HistoryEvent } from "./augmentation/model";

type Page =
  | "Data Lake"
  | "Discover"
  | "Evidence"
  | "Integration"
  | "Activity"
  | "Settings";
const pages: Page[] = [
  "Data Lake",
  "Discover",
  "Evidence",
  "Integration",
  "Activity",
  "Settings",
];
function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    evidence: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <path d="M10 6h7v8M6 10v7h8" />
      </>
    ),
    network: (
      <>
        <path d="M6 6h12v12H6z" />
        <rect x="2" y="2" width="8" height="8" fill="#f0a30a" stroke="none" />
        <rect x="14" y="2" width="8" height="8" fill="#1046d5" stroke="none" />
        <rect x="14" y="14" width="8" height="8" fill="#a20025" stroke="none" />
        <rect x="2" y="14" width="8" height="8" fill="#d5e8d4" stroke="none" />
      </>
    ),
    lake: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7" />
      </>
    ),
    discover: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m16 8-2.5 5.5L8 16l2.5-5.5L16 8Z" />
      </>
    ),
    datasets: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v3m0 14v3M2 12h3m14 0h3M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2" />
      </>
    ),
    activity: <path d="M2 13h5l3-8 4 14 3-6h5" />,
    upload: (
      <>
        <path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    file: (
      <>
        <path d="M14 3H5v18h14V8l-5-5ZM14 3v5h5M8 12h8M8 16h6" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    leaf: (
      <>
        <path d="M5 20c0-8 9-9 13-16 3 11-2 17-10 13M5 20l9-9" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] ?? paths.file}
    </svg>
  );
}
function App() {
  const [liveEvidence, setLiveEvidence] = useState<{
    linkId: string;
    companionId?: string;
  }>();
  const [page, setPage] = useState<Page>("Data Lake");
  const intake = useIntake();
  const [savedCount, setSavedCount] = useState(0);
  const [withdrawn, setWithdrawn] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  function applyWithdrawal(ids: string[]) {
    const restored = withdrawn.filter((id) => !ids.includes(id));
    const removed = ids.filter((id) => !withdrawn.includes(id));
    setWithdrawn(ids);
    setHistory((events) => [
      ...events,
      {
        id: events.length + 1,
        kind: "Example re-evaluation",
        message: [
          removed.length ? `Withheld ${removed.join(", ")}.` : "",
          restored.length ? `Restored ${restored.join(", ")}.` : "",
          "Support recalculated from synthetic passages; original values preserved.",
        ]
          .filter(Boolean)
          .join(" "),
        withdrawn: [...ids],
      },
    ]);
  }
  const [discoveryExample, setDiscoveryExample] = useState(false);
  const [workbenchView, setWorkbenchView] =
    useState<WorkbenchView>("treatments");
  const queue = intake.assets;
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const addFiles = intake.add;
  const folderInput = useRef<HTMLInputElement>(null);
  const collection = useRef<AbortController | null>(null);
  const [collecting, setCollecting] = useState(false);
  const [folderNotice, setFolderNotice] = useState("");
  useEffect(() => () => collection.current?.abort(), []);
  function addCollection(result: FolderCollection) {
    intake.add(
      result.sources.map((s) => s.file),
      result.sources.map((s) => s.relativePath),
    );
    setFolderNotice(
      `${result.sources.length} files collected. ${result.skipped ? `${result.skipped} non-CSV/TXT files skipped. ` : ""}${result.errors.length ? result.errors.join(" ") : ""}${!result.sources.length && !result.errors.length ? "Choose folders containing CSV or TXT files." : ""}`,
    );
  }
  function dropFiles(data: DataTransfer) {
    if (collecting) return;
    const controller = new AbortController();
    collection.current = controller;
    setCollecting(true);
    setFolderNotice("Reading folders and subfolders…");
    collectDrop(data, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) addCollection(result);
      })
      .catch(() =>
        setFolderNotice(
          controller.signal.aborted
            ? "Folder collection cancelled."
            : "Could not read dropped files. Try Choose folders.",
        ),
      )
      .finally(() => {
        if (collection.current === controller) {
          collection.current = null;
          setCollecting(false);
        }
      });
  }
  return (
    <div
      className={`app studio-app page-${page.toLowerCase().replace(" ", "-")} ${savedCount ? "has-saved" : ""}`}
    >
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(event) => {
            event.preventDefault();
            setPage("Data Lake");
          }}
          aria-label="IDUN home"
        >
          <span className="brand-mark">
            <img src="/idun.svg" width="34" height="34" alt="" />
          </span>
          <span>
            IDUN
            <span className="brand-caption">
              Integrating Data-lake of Unstructured Nature
            </span>
          </span>
        </a>
        <nav aria-label="Workspace">
          {pages
            .filter((item) => item !== "Settings")
            .map((item, i) => (
              <button
                key={item}
                className={`nav-item ${page === item ? "active" : ""}`}
                aria-current={page === item ? "page" : undefined}
                onClick={() => setPage(item)}
              >
                <Icon
                  name={
                    [
                      "lake",
                      "discover",
                      "evidence",
                      "datasets",
                      "activity",
                      "settings",
                    ][i]
                  }
                />
                {item}
                {item === "Data Lake" && queue.length > 0 && (
                  <span className="nav-count">{queue.length}</span>
                )}
              </button>
            ))}
        </nav>
        <div className="studio-header-actions">
          <div className="studio-session">
            <i /> {publicDemo ? "YOUR DEMO WORKSPACE" : "LOCAL WORKSPACE"}{" "}
            <span>LOKI + THOR</span>
          </div>
          {!publicDemo && (
            <button
              className={`nav-item settings-corner ${page === "Settings" ? "active" : ""}`}
              aria-current={page === "Settings" ? "page" : undefined}
              onClick={() => setPage("Settings")}
              title="Settings"
              aria-label="Settings"
            >
              <Icon name="settings" />
              <span>Settings</span>
            </button>
          )}
        </div>
      </aside>
      <div className="workspace-main">
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {page === "Data Lake"
                  ? "Start with what you have"
                  : "Your workspace"}
              </span>
              <h1>{page}</h1>
            </div>
            <span className="phase">
              04 <span>/</span> Evidence workbench
            </span>
          </div>
          {page === "Data Lake" ? (
            <>
              <LakeScene
                count={queue.length}
                savedCount={savedCount}
                onExplore={() => {
                  setDiscoveryExample(true);
                  setPage("Discover");
                }}
              />
              <section
                className={`intake-section ${queue.length || savedCount ? "intake-compact" : ""}`}
                aria-labelledby="intake-title"
              >
                <div className="section-title">
                  <div>
                    <span className="eyebrow">Your starting point</span>
                    <h3 id="intake-title">Add a raw data lake</h3>
                  </div>
                  <span className="format-tag">CSV + TXT</span>
                </div>
                <div
                  className={`drop-zone ${dragging ? "dragging" : ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node))
                      setDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    dropFiles(e.dataTransfer);
                  }}
                >
                  <div className="upload-icon">
                    <Icon name="upload" size={27} />
                  </div>
                  <h4>Drop files or folders here</h4>
                  <p>
                    Tables and plain text, just as they are.
                    <br />
                    No schema or connections to prepare.
                  </p>
                  <div className="intake-pickers">
                    <button
                      className="primary"
                      disabled={collecting}
                      onClick={() => folderInput.current?.click()}
                    >
                      Choose folders <Icon name="arrow" size={17} />
                    </button>
                    <button
                      className="secondary"
                      disabled={collecting}
                      onClick={() => input.current?.click()}
                    >
                      Choose files
                    </button>
                  </div>
                  <input
                    ref={folderInput}
                    type="file"
                    multiple
                    {...{ webkitdirectory: "" }}
                    aria-label="Choose folders including subfolders"
                    hidden
                    onChange={(e) => {
                      if (e.target.files)
                        addCollection(folderSelection(e.target.files));
                      e.target.value = "";
                    }}
                  />
                  <input
                    ref={input}
                    type="file"
                    accept=".csv,.txt"
                    multiple
                    aria-label="Choose raw CSV and TXT files"
                    onChange={(e) => {
                      if (e.target.files) {
                        setFolderNotice("");
                        addFiles(e.target.files);
                      }
                      e.target.value = "";
                    }}
                    hidden
                  />
                  <small>
                    Files are staged locally. Choose Save to persist them on
                    this machine.
                  </small>
                </div>
                <p className="folder-help">
                  Subfolders are included. Drop several folders together, or add
                  more with Choose folders. Paths are kept for source browsing.
                </p>
                {collecting && (
                  <button
                    className="secondary"
                    onClick={() => collection.current?.abort()}
                  >
                    Cancel folder collection
                  </button>
                )}
                <p className="notice" role="status" aria-live="polite">
                  {(collecting
                    ? folderNotice
                    : [intake.notice, folderNotice]
                        .filter(Boolean)
                        .join(" ")) ||
                    "Choose files, preview them, then save to your local lake. Index the saved lake, then run LOKI in Discover."}
                </p>
              </section>
              {queue.length > 0 && <IntakeReview intake={intake} />}
              <SavedLake onCount={setSavedCount} />
              <LakeProfile />
              <InferenceReadiness />
            </>
          ) : page === "Discover" ? (
            <>
              <LiveDiscovery
                onIntake={() => setPage("Data Lake")}
                onOpenEvidence={(linkId, companionId) => {
                  setLiveEvidence({ linkId, companionId });
                  setPage("Evidence");
                }}
              />
              <details>
                <summary>Interface example · synthetic data</summary>
                <Discovery
                  example={discoveryExample}
                  onExampleChange={setDiscoveryExample}
                  fileCount={queue.length}
                  onIntake={() => setPage("Data Lake")}
                  onOpenEvidence={(id) => {
                    setLiveEvidence(undefined);
                    setWorkbenchView(id as WorkbenchView);
                    setPage("Evidence");
                  }}
                />
              </details>
            </>
          ) : page === "Evidence" ? (
            <>
              <LiveEvidence
                linkId={liveEvidence?.linkId}
                companionId={liveEvidence?.companionId}
                onBack={() => setPage("Discover")}
              />
              <details>
                <summary>Interface example · synthetic data</summary>
                <Workbench
                  view={workbenchView}
                  onViewChange={setWorkbenchView}
                  onDiscover={() => {
                    setDiscoveryExample(true);
                    setPage("Discover");
                  }}
                />
              </details>
            </>
          ) : page === "Settings" ? (
            <Settings />
          ) : page === "Integration" ? (
            <>
              <IntegratedDatasets
                onSettings={() => setPage("Settings")}
                onDiscovery={() => setPage("Discover")}
                onEvidence={(linkId, companionId) => {
                  setLiveEvidence({ linkId, companionId });
                  setPage("Evidence");
                }}
              />
              <details>
                <summary>Augmentation example · synthetic data</summary>
                <Augmentation
                  withdrawn={withdrawn}
                  onApply={applyWithdrawal}
                  onHistory={() => setPage("Activity")}
                />
              </details>
            </>
          ) : (
            <History events={history} onReview={() => setPage("Integration")} />
          )}
          <footer>
            <span>IDUN / Integrating Data-lake of Unstructured Nature</span>
            <span>Research workspace</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
