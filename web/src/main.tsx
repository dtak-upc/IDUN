import { LakeSelector, LakeWorkspace, type Lake } from "./storage/LakeWorkspace";
import { publicFile } from "./showcase/paths";
import { IntegratedDatasets } from "./integration/IntegratedDatasets";
import { Settings } from "./settings/Settings";
import { publicDemo, savedDemo } from "./mode";
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
import "./dark.css";
import { useTheme } from "./theme";
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
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
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
    logout: (
      <>
        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        <polyline points="16 17 21 12 16 7" />
        <line x1="21" y1="12" x2="9" y2="12" />
      </>
    ),
    leaf: (
      <>
        <path d="M5 20c0-8 9-9 13-16 3 11-2 17-10 13M5 20l9-9" />
      </>
    ),
    sun: (
      <>
        <circle cx="12" cy="12" r="5" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </>
    ),
    moon: (
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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
function App({ lake, onLakeChange }: {lake?: Lake; onLakeChange?: (lake: Lake) => void}) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [liveEvidence, setLiveEvidence] = useState<{
    linkId: string;
    companionId?: string;
  }>();
  const [page, setPage] = useState<Page>("Data Lake");
  const intake = useIntake();
  const [savedCount, setSavedCount] = useState(0);
  const [withdrawn, setWithdrawn] = useState<string[]>([]);
  const [history, setHistory] = useState<HistoryEvent[]>([]);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [shuttingDown, setShuttingDown] = useState(false);
  const [shutdownError, setShutdownError] = useState("");
  const [isShutDown, setIsShutDown] = useState(false);

  async function handleLogout(force = false) {
    setShuttingDown(true);
    setShutdownError("");
    if (publicDemo) {
      setTimeout(() => {
        setShowLogoutModal(false);
        setIsShutDown(true);
        setShuttingDown(false);
      }, 350);
      return;
    }
    try {
      const response = await fetch("/api/v1/session/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || "Failed to shut down servers");
      }
      setShowLogoutModal(false);
      setIsShutDown(true);
    } catch (err: any) {
      setShutdownError(err?.message || String(err));
      setShuttingDown(false);
    }
  }
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
    if (collecting || savedDemo) return;
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
  if (isShutDown) {
    return (
      <div className="shutdown-screen" role="status" aria-live="polite">
        <div className="shutdown-card">
          <div className="shutdown-icon">
            <Icon name="logout" size={36} />
          </div>
          <h2>IDUN Has Been Shut Down</h2>
          <p className="shutdown-lead">
            All active servers and background terminal processes have stopped cleanly.
          </p>
          <div className="shutdown-badge">
            <span className="shutdown-dot"></span> System Offline
          </div>
          <p className="shutdown-instruction">
            You may now safely close this browser tab.
          </p>
          <div className="shutdown-hint">
            To start IDUN again in the future, run <code>Start_IDUN.bat</code> or <code>npm start</code> in your terminal.
          </div>
          {publicDemo && (
            <button
              type="button"
              className="primary"
              style={{ marginTop: "20px", display: "inline-flex", alignItems: "center", gap: "8px" }}
              onClick={() => {
                setIsShutDown(false);
                setShuttingDown(false);
              }}
            >
              <Icon name="arrow" size={16} /> Return to Demo Workspace
            </button>
          )}
        </div>
      </div>
    );
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
            <img src={publicFile("idun.png")} alt="IDUN logo" />
          </span>
          <span className="brand-text">
            <span className="brand-title">IDUN</span>
            <span className="brand-caption">
              <span className="brand-caption-line">
                <span className="brand-acronym">I</span>ntegrating{" "}
                <span className="brand-acronym">D</span>ata-lake of
              </span>
              <span className="brand-caption-line">
                <span className="brand-acronym">U</span>nstructured{" "}
                <span className="brand-acronym">N</span>ature
              </span>
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
          {lake && onLakeChange && <LakeSelector lake={lake} onChange={onLakeChange} blocked={queue.some(a => a.transfer !== "uploaded")} />}
          <div className="studio-session">
            <span className="session-line session-status"><i /> {publicDemo ? "YOUR DEMO" : "LOCAL"}</span>
            <span className="session-line session-title">WORKSPACE</span>
          </div>
          <button
            className="nav-item theme-toggle"
            onClick={toggleTheme}
            title={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            aria-label={resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
          >
            <Icon name={resolvedTheme === "dark" ? "sun" : "moon"} />
          </button>
          <button
            className={`nav-item settings-corner ${page === "Settings" ? "active" : ""}`}
            aria-current={page === "Settings" ? "page" : undefined}
            onClick={() => setPage("Settings")}
            title="Settings"
            aria-label="Settings"
          >
            <Icon name="settings" />
          </button>
          <button
            className="nav-item logout-corner"
            onClick={() => {
              setShutdownError("");
              setShowLogoutModal(true);
            }}
            title="Logout & shut down IDUN"
            aria-label="Logout"
          >
            <Icon name="logout" />
          </button>
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
                lakeName={lake?.name}
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
                    <h3 id="intake-title">{lake ? `Add files to ${lake.name}` : "Add a raw data lake"}</h3>
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
                      disabled={collecting || savedDemo}
                      onClick={() => folderInput.current?.click()}
                    >
                      Choose folders <Icon name="arrow" size={17} />
                    </button>
                    <button
                      className="secondary"
                      disabled={collecting || savedDemo}
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
              {queue.length > 0 && <IntakeReview intake={intake} lakeName={lake?.name} />}
              <SavedLake onCount={setSavedCount} />
              <LakeProfile />
              {!savedDemo && <InferenceReadiness />}
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
            <Settings activeLake={lake?.name || lake?.id} />
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
      {showLogoutModal && (
        <div
          className="logout-modal-backdrop"
          onClick={() => !shuttingDown && setShowLogoutModal(false)}
        >
          <div
            className="logout-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="logout-modal-header">
              <div className="logout-modal-icon">
                <Icon name="logout" size={22} />
              </div>
              <h3 id="logout-dialog-title">Log out & Shut Down IDUN?</h3>
            </div>
            <div className="logout-modal-body">
              <p>Logging out will stop all local services:</p>
              <ul className="logout-impact-list">
                <li>Stops the Python API server</li>
                <li>Stops the Vite web server</li>
                <li>Closes the background node/npm process and terminal window</li>
                <li>Unloads any active AI models from GPU VRAM</li>
              </ul>
              {shutdownError && (
                <div className="logout-error" role="alert">
                  <p>{shutdownError}</p>
                  <button
                    type="button"
                    className="logout-force-btn"
                    onClick={() => handleLogout(true)}
                    disabled={shuttingDown}
                  >
                    Force Shut Down Anyway
                  </button>
                </div>
              )}
            </div>
            <div className="logout-modal-actions">
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setShowLogoutModal(false)}
                disabled={shuttingDown}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-danger-logout"
                onClick={() => handleLogout(false)}
                disabled={shuttingDown}
              >
                {shuttingDown ? "Shutting down…" : "Log out & Shut Down"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LakeWorkspace>{(lake, onChange) => <App key={lake?.id || "public"} lake={lake} onLakeChange={onChange} />}</LakeWorkspace>
  </React.StrictMode>,
);
