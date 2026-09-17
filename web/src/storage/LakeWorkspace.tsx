import { useEffect, useState, type ReactNode } from "react";
import { api, post, selectApiLake } from "./api";
import { publicDemo } from "../mode";
import "./lakes.css";

export type Lake = {id: string; name: string; files?: number};
type Listing = {lakes: Lake[]; default_id: string};
export function LakeWorkspace({children}: {children: (lake?: Lake, onChange?: (lake: Lake) => void) => ReactNode}) {
  const [lake, setLake] = useState<Lake>();
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  function choose(next: Lake) {
    selectApiLake(next.id);
    localStorage.setItem("idun.selectedLake", next.id);
    setLake(next);
  }
  useEffect(() => {
    let active = true;
    api<Listing>("/lakes").then(r => {
      const id = localStorage.getItem("idun.selectedLake") || r.default_id;
      if (active) choose(r.lakes.find(l => l.id === id) || r.lakes[0]);
    }).catch(e => {if (active) setError(e.message);});
    return () => {active = false;};
  }, [retry]);
  if (!lake) return <main className="lake-loading"><h1>IDUN</h1>{error ? <><p role="alert">{error}</p><button onClick={() => {setError(""); setRetry(r => r+1);}}>Reconnect</button></> : <p>Opening your lakes…</p>}</main>;
  return children(lake, choose);
}

export function LakeSelector({lake, onChange, blocked}: {lake: Lake; onChange: (lake: Lake) => void; blocked: boolean}) {
  const [lakes, setLakes] = useState<Lake[]>([lake]);
  const [removal, setRemoval] = useState<{id:string;name:string;files:number;runs:number;token:string}>();
  const [confirmName,setConfirmName] = useState("");
  const [editing, setEditing] = useState<"new" | "rename">();
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuEl, setMenuEl] = useState<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    api<Listing>("/lakes").then(r => {if(active) setLakes(r.lakes);}).catch(e => {if(active) setError(e.message);});
    return () => {active = false;};
  }, [lake]);

  useEffect(() => {
    if (!menuOpen) return;
    function handleDocClick(e: MouseEvent) {
      if (menuEl && !menuEl.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", handleDocClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen, menuEl]);

  async function save() {
    setBusy(true); setError("");
    try {
      const next = await post<Lake>(editing === "new" ? "/lakes" : `/lakes/${lake.id}`, {name: name.trim()});
      setEditing(undefined); onChange(next);
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  }

  return (
    <div className="lake-switcher" ref={setMenuEl}>
      {/* Lake pill with icon & custom select */}
      <div className="lake-pill" title={`Active data lake: ${lake.name}`}>
        <span className="lake-icon" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <ellipse cx="12" cy="5" rx="9" ry="3" />
            <path d="M3 5v6c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
            <path d="M3 11v6c0 1.66 4.03 3 9 3s9-1.34 9-3v-6" />
          </svg>
        </span>
        <div className="lake-select-wrap">
          <select
            aria-label="Active data lake"
            value={lake.id}
            disabled={blocked || busy}
            onChange={e => onChange(lakes.find(l => l.id === e.target.value)!)}
          >
            {lakes.map(l => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
          <span className="lake-select-chevron" aria-hidden="true">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </span>
        </div>
      </div>

      <div className="lake-divider" aria-hidden="true" />

      {/* Action buttons: New lake + Options menu */}
      <div className="lake-actions">
        <button
          type="button"
          className="lake-btn lake-btn-new"
          disabled={blocked || busy}
          aria-label="New lake"
          title="Create new lake"
          onClick={() => { setName(""); setEditing("new"); setMenuOpen(false); }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          <span>New lake</span>
        </button>

        <button
          type="button"
          className={`lake-btn lake-btn-menu ${menuOpen ? "active" : ""}`}
          disabled={busy}
          aria-label="Lake actions"
          aria-haspopup="true"
          aria-expanded={menuOpen}
          title="Lake options (Rename, Delete)"
          onClick={() => setMenuOpen(prev => !prev)}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="19" cy="12" r="1.5" />
            <circle cx="5" cy="12" r="1.5" />
          </svg>
        </button>
      </div>

      {/* Options dropdown menu */}
      {menuOpen && (
        <div className="lake-dropdown-menu" role="menu">
          <div className="lake-dropdown-header">
            <span className="lake-dropdown-kicker">DATA LAKE</span>
            <span className="lake-dropdown-current" title={lake.name}>{lake.name}</span>
          </div>
          <button
            type="button"
            role="menuitem"
            className="lake-dropdown-item"
            aria-label="Rename data lake"
            onClick={() => {
              setName(lake.name);
              setEditing("rename");
              setMenuOpen(false);
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
              <path d="m15 5 4 4" />
            </svg>
            <span>Rename lake</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="lake-dropdown-item lake-dropdown-danger"
            disabled={blocked || busy}
            aria-label="Remove data lake"
            onClick={async () => {
              setMenuOpen(false);
              setBusy(true);
              setError("");
              setEditing(undefined);
              try {
                setRemoval(await post(`/lakes/${lake.id}/removal-preview`));
                setConfirmName("");
              } catch (e) {
                setError((e as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
            <span>Remove lake</span>
          </button>
        </div>
      )}

      {/* Blocked state indicator */}
      {blocked && (
        <span className="lake-blocked-tag" title="Save or remove staged files before switching lakes">
          Locked
        </span>
      )}

      {/* Create / Rename modal */}
      {editing && (
        <div className="lake-modal-overlay" role="presentation" onClick={() => !busy && setEditing(undefined)}>
          <div className="lake-modal-card" role="dialog" aria-modal="true" aria-labelledby="lake-modal-title" onClick={e => e.stopPropagation()}>
            <div className="lake-modal-header">
              <h3 id="lake-modal-title">{editing === "new" ? "Create isolated lake" : "Rename data lake"}</h3>
              <p className="lake-modal-desc">
                {editing === "new"
                  ? "Create an isolated workspace with its own sources, indexes, and discovery results."
                  : `Update the display name for "${lake.name}". Stored files and results remain unchanged.`}
              </p>
            </div>
            <form onSubmit={e => { e.preventDefault(); void save(); }}>
              <div className="lake-modal-body">
                <label htmlFor="lake-name-input">Lake name</label>
                <input
                  id="lake-name-input"
                  aria-label="Lake name"
                  autoFocus
                  maxLength={120}
                  required
                  placeholder="e.g. Clinical Cohort B"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div className="lake-modal-footer">
                <button type="button" className="lake-modal-btn-cancel" disabled={busy} onClick={() => setEditing(undefined)}>
                  Cancel
                </button>
                <button type="submit" className="lake-modal-btn-primary" disabled={busy || !name.trim()}>
                  {editing === "new" ? "Create lake" : "Save name"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Removal confirmation modal */}
      {removal && (
        <div className="lake-modal-overlay" role="presentation" onClick={() => !busy && setRemoval(undefined)}>
          <div className="lake-modal-card lake-modal-card-danger" role="alertdialog" aria-modal="true" aria-labelledby="lake-remove-title" onClick={e => e.stopPropagation()}>
            <div className="lake-modal-header">
              <div className="lake-danger-icon" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <h3 id="lake-remove-title">Permanently remove lake?</h3>
              <p className="lake-modal-desc">
                Permanently delete <strong>{removal.name}</strong>, including its {removal.files} file{removal.files === 1 ? "" : "s"}, {removal.runs} integration run{removal.runs === 1 ? "" : "s"}, indexes, and lake backups?
              </p>
              <p className="lake-modal-note">Original raw files on your disk will not be deleted.</p>
            </div>
            <form onSubmit={async e => {
              e.preventDefault(); setBusy(true); setError("");
              try {
                const result = await post<{next_lake:Lake;cleanup_pending:boolean}>(`/lakes/${removal.id}/remove`, {token: removal.token, name: confirmName});
                if (result.cleanup_pending) window.alert("Lake removed. Some files are locked; cleanup remains in .idun/removed-lakes.");
                setRemoval(undefined);
                onChange(result.next_lake);
              } catch(e) { setError((e as Error).message); }
              finally { setBusy(false); }
            }}>
              <div className="lake-modal-body">
                <label htmlFor="confirm-lake-name">
                  Type <strong>{removal.name}</strong> to confirm:
                </label>
                <input
                  id="confirm-lake-name"
                  aria-label="Confirm lake name"
                  autoFocus
                  placeholder={removal.name}
                  value={confirmName}
                  onChange={e => setConfirmName(e.target.value)}
                />
              </div>
              <div className="lake-modal-footer">
                <button type="button" className="lake-modal-btn-cancel" disabled={busy} onClick={() => setRemoval(undefined)}>
                  Keep lake
                </button>
                <button type="submit" className="lake-modal-btn-danger" disabled={busy || confirmName !== removal.name}>
                  Permanently remove lake
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {error && (
        <div className="lake-error-toast" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setError("")} aria-label="Dismiss error">×</button>
        </div>
      )}
    </div>
  );
}
