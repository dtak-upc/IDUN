import { useState, useEffect } from "react";
import { api, post } from "../storage/api";
import "./integration.css";

export type SchemaMode = "strict" | "hybrid" | "open";

export type SchemaPredicate = {
  label: string;
  definition: string;
  enabled?: boolean;
  occurrences?: number;
  is_default?: boolean;
  sample_quotes?: {
    diagnosis: string;
    medication: string;
    quote: string;
    reason?: string;
    document?: string;
    text?: string;
  }[];
};

export type SchemaConfig = {
  mode: SchemaMode;
  labels: string[];
  definitions: Record<string, string>;
};

export type ProbeResponse = {
  probed_count: number;
  available_pairs: number;
  defaults: { label: string; definition: string; enabled: boolean }[];
  suggestions: SchemaPredicate[];
  negative_count?: number;
  unresolved_count?: number;
  message?: string;
};

export const DEFAULT_LABELS = [
  "TREATS",
  "ADVERSE_EFFECT",
  "DISCONTINUED",
  "CONTRAINDICATED",
  "NEGATIVE",
  "UNRESOLVED",
];

export function RelationshipSchemaStudio({
  isOpen,
  onClose,
  config,
  onSave,
  disabled,
}: {
  isOpen: boolean;
  onClose: () => void;
  config: SchemaConfig;
  onSave: (newConfig: SchemaConfig) => void;
  disabled?: boolean;
}) {
  const [localConfig, setLocalConfig] = useState<SchemaConfig>(config);
  const [customTag, setCustomTag] = useState("");
  const [customDef, setCustomDef] = useState("");
  const [probeResult, setProbeResult] = useState<ProbeResponse | null>(null);
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState("");
  const [expandedQuote, setExpandedQuote] = useState<string | null>(null);
  const [sampleSize, setSampleSize] = useState<number>(6);

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const activeLabels = new Set(localConfig.labels);

  const toggleLabel = (label: string, defaultDef?: string) => {
    const updated = new Set(localConfig.labels);
    const updatedDefs = { ...localConfig.definitions };

    if (updated.has(label)) {
      // Keep NEGATIVE and UNRESOLVED always
      if (label === "NEGATIVE" || label === "UNRESOLVED") return;
      updated.delete(label);
    } else {
      updated.add(label);
      if (defaultDef && !updatedDefs[label]) {
        updatedDefs[label] = defaultDef;
      }
    }
    setLocalConfig({
      ...localConfig,
      labels: Array.from(updated),
      definitions: updatedDefs,
    });
  };

  const addCustomPredicate = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customTag.trim().toUpperCase().replace(/[^A-Z0-9_]/g, "_");
    if (!clean || clean.length < 2) return;

    const updated = new Set(localConfig.labels);
    updated.add(clean);
    const updatedDefs = { ...localConfig.definitions };
    if (customDef.trim()) {
      updatedDefs[clean] = customDef.trim();
    }
    setLocalConfig({
      ...localConfig,
      labels: Array.from(updated),
      definitions: updatedDefs,
    });
    setCustomTag("");
    setCustomDef("");
  };

  const removeCustomPredicate = (label: string) => {
    if (label === "NEGATIVE" || label === "UNRESOLVED") return;
    const updated = localConfig.labels.filter((l) => l !== label);
    const updatedDefs = { ...localConfig.definitions };
    delete updatedDefs[label];
    setLocalConfig({
      ...localConfig,
      labels: updated,
      definitions: updatedDefs,
    });
  };

  const handleProbe = async () => {
    setProbing(true);
    setProbeError("");
    try {
      const res = await post<ProbeResponse>("/integration/schema/probe", {
        sample_size: sampleSize,
      });
      setProbeResult(res);
    } catch (err: any) {
      setProbeError(err?.message || String(err));
    } finally {
      setProbing(false);
    }
  };

  const resetToDefaults = () => {
    setLocalConfig({
      mode: "strict",
      labels: [...DEFAULT_LABELS],
      definitions: {},
    });
  };

  return (
    <div
      className="lake-modal-overlay"
      role="presentation"
      onClick={() => !probing && onClose()}
    >
      <div
        className="schema-studio-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="schema-studio-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="schema-studio-header">
          <div className="schema-header-title-wrap">
            <div className="schema-header-icon" aria-hidden="true">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
            </div>
            <div>
              <h3 id="schema-studio-title">Relationship Schema Studio</h3>
              <p className="schema-header-desc">
                Probe discovered join paths for emergent relationships, customize clinical predicates, or enable open-ended typing.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="schema-close-btn"
            aria-label="Close schema studio"
            disabled={probing}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="schema-studio-body">
          {/* Mode Selector */}
          <section className="schema-section">
            <span className="schema-section-title">Execution Mode</span>
            <div className="schema-mode-grid" role="radiogroup" aria-label="Schema Execution Mode">
              <label className={`schema-mode-card ${localConfig.mode === "strict" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="schema-mode"
                  value="strict"
                  checked={localConfig.mode === "strict"}
                  onChange={() => setLocalConfig({ ...localConfig, mode: "strict" })}
                />
                <div className="schema-mode-content">
                  <strong>Strict Schema (Recommended)</strong>
                  <p>Model strictly maps evidence to your selected predicates via JSON schema.</p>
                </div>
              </label>

              <label className={`schema-mode-card ${localConfig.mode === "hybrid" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="schema-mode"
                  value="hybrid"
                  checked={localConfig.mode === "hybrid"}
                  onChange={() => setLocalConfig({ ...localConfig, mode: "hybrid" })}
                />
                <div className="schema-mode-content">
                  <strong>Hybrid Mode (Emergent Typing)</strong>
                  <p>Prefers selected schema, but allows LLM to return novel grounded relationships.</p>
                </div>
              </label>

              <label className={`schema-mode-card ${localConfig.mode === "open" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="schema-mode"
                  value="open"
                  checked={localConfig.mode === "open"}
                  onChange={() => setLocalConfig({ ...localConfig, mode: "open" })}
                />
                <div className="schema-mode-content">
                  <strong>Fully Open</strong>
                  <p>Unconstrained open-ended predicate extraction without predefined label list.</p>
                </div>
              </label>
            </div>
          </section>

          {/* Dataset Probe Card */}
          <section className="schema-section schema-probe-box">
            <div className="schema-probe-header">
              <div>
                <span className="schema-section-title">Discover Lake Relationships</span>
                <p className="schema-probe-desc">
                  Run a fast zero-shot probe across diverse clinical documents and table rows to suggest emergent relationship types.
                </p>
              </div>
              <div className="schema-probe-controls">
                <div className="schema-probe-size-selector" aria-label="Candidates sample size">
                  <span className="schema-size-label">Candidates:</span>
                  {[6, 12, 20, 30].map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={`schema-size-btn ${sampleSize === size ? "active" : ""}`}
                      disabled={probing}
                      onClick={() => setSampleSize(size)}
                    >
                      {size} {size === 6 ? "(fast)" : ""}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="schema-probe-btn"
                  disabled={probing || disabled}
                  onClick={handleProbe}
                >
                  {probing ? (
                    <>
                      <span className="schema-spinner" aria-hidden="true" />
                      Probing {sampleSize} paths...
                    </>
                  ) : (
                    <>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="11" cy="11" r="8" />
                        <path d="m21 21-4.3-4.3" />
                      </svg>
                      Probe Dataset
                    </>
                  )}
                </button>
              </div>
            </div>

            {probeError && (
              <div role="alert" className="schema-error">
                {probeError}
              </div>
            )}

            {probeResult && (
              <div className="schema-probe-results">
                <div className="schema-probe-meta">
                  <span>Probed {probeResult.probed_count} candidate paths across lake</span>
                  {probeResult.suggestions.length > 0 ? (
                    <span className="schema-badge-green">
                      {probeResult.suggestions.length} relationship types found
                    </span>
                  ) : (
                    <span>No novel relationships found beyond baseline</span>
                  )}
                </div>

                <div className="schema-suggestions-list">
                  {probeResult.suggestions.map((s) => {
                    const isSelected = activeLabels.has(s.label);
                    const isExpanded = expandedQuote === s.label;
                    return (
                      <div
                        key={s.label}
                        className={`schema-suggestion-card ${isSelected ? "in-schema" : ""}`}
                      >
                        <div className="suggestion-card-main">
                          <div className="suggestion-badge-row">
                            <span className="suggestion-label-badge">{s.label}</span>
                            <span className="suggestion-count-badge">
                              {s.occurrences} {s.occurrences === 1 ? "pair" : "pairs"}
                            </span>
                            {s.is_default && (
                              <span className="suggestion-default-badge">Domain default</span>
                            )}
                          </div>
                          <p className="suggestion-def-text">{s.definition}</p>
                          {s.sample_quotes && s.sample_quotes.length > 0 && (
                            <button
                              type="button"
                              className="suggestion-quote-toggle"
                              onClick={() => setExpandedQuote(isExpanded ? null : s.label)}
                            >
                              {isExpanded ? "Hide sample quote ▴" : "View evidence quote ▾"}
                            </button>
                          )}
                        </div>

                        <div className="suggestion-action-col">
                          <button
                            type="button"
                            className={`suggestion-toggle-btn ${isSelected ? "active" : ""}`}
                            onClick={() => toggleLabel(s.label, s.definition)}
                          >
                            {isSelected ? "✓ In Schema" : "+ Add to Schema"}
                          </button>
                        </div>

                        {isExpanded && s.sample_quotes && (
                          <div className="suggestion-quote-drawer">
                            {s.sample_quotes.map((q, qIdx) => (
                              <div key={qIdx} className="suggestion-quote-item">
                                <div className="quote-anchors">
                                  <span>Diagnosis: <strong>{q.diagnosis}</strong></span>
                                  <span>Medication: <strong>{q.medication}</strong></span>
                                </div>
                                <blockquote className="quote-text">
                                  &ldquo;{q.quote || q.text}&rdquo;
                                </blockquote>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* Standard Domain Predicates */}
          <section className="schema-section">
            <span className="schema-section-title">Standard Domain Predicates</span>
            {localConfig.mode === "open" ? (
              <div className="schema-open-mode-callout" role="status">
                <div className="open-callout-header">
                  <span className="open-callout-badge">Fully Open Active</span>
                  <strong>Unconstrained Emergent Inference</strong>
                </div>
                <p>
                  Predefined relationship types are bypassed and will not be sent in the prompt to the LLM. The model will freely extract and type canonical <code>UPPER_SNAKE_CASE</code> relationships grounded directly in narrative evidence without label restrictions.
                </p>
              </div>
            ) : (
              <div className="schema-predicates-grid">
                {[
                  { label: "TREATS", desc: "Medication prescribed, started or continued to manage diagnosis." },
                  { label: "ADVERSE_EFFECT", desc: "Medication caused, worsened or suspected to cause symptom." },
                  { label: "DISCONTINUED", desc: "Medication stopped, held or switched away from." },
                  { label: "CONTRAINDICATED", desc: "Medication unsafe/inappropriate for this diagnosis/context." },
                  { label: "NEGATIVE", desc: "Evidence indicates medication is for a different diagnosis." },
                  { label: "UNRESOLVED", desc: "Insufficient evidence in narrative to determine relationship." },
                ].map((p) => {
                  const isSelected = activeLabels.has(p.label);
                  const isEssential = p.label === "NEGATIVE" || p.label === "UNRESOLVED";
                  return (
                    <label
                      key={p.label}
                      className={`schema-predicate-item ${isSelected ? "checked" : ""} ${isEssential ? "essential" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isEssential}
                        onChange={() => toggleLabel(p.label, p.desc)}
                      />
                      <div className="predicate-text">
                        <span className="predicate-name">{p.label}</span>
                        <span className="predicate-desc">{p.desc}</span>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </section>

          {/* Custom User Predicates */}
          {localConfig.mode !== "open" && (
            <section className="schema-section">
              <span className="schema-section-title">Custom User Predicates</span>
              <div className="schema-custom-chips">
                {localConfig.labels
                  .filter((l) => !DEFAULT_LABELS.includes(l))
                  .map((l) => (
                    <span key={l} className="schema-custom-chip">
                      <code>{l}</code>
                      <button
                        type="button"
                        aria-label={`Remove ${l}`}
                        onClick={() => removeCustomPredicate(l)}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                {localConfig.labels.filter((l) => !DEFAULT_LABELS.includes(l)).length === 0 && (
                  <p className="schema-empty-custom">
                    No custom predicates added yet. Type below or add from discovered suggestions above.
                  </p>
                )}
              </div>

              <form onSubmit={addCustomPredicate} className="schema-custom-form">
                <input
                  type="text"
                  placeholder="e.g. PROPHYLAXIS_FOR or OFF_LABEL_USE"
                  value={customTag}
                  maxLength={40}
                  onChange={(e) => setCustomTag(e.target.value)}
                  aria-label="New predicate name"
                />
                <input
                  type="text"
                  placeholder="Optional 1-sentence definition"
                  value={customDef}
                  maxLength={200}
                  onChange={(e) => setCustomDef(e.target.value)}
                  aria-label="New predicate definition"
                />
                <button
                  type="submit"
                  className="schema-add-btn"
                  disabled={!customTag.trim()}
                >
                  + Add Predicate
                </button>
              </form>
            </section>
          )}
        </div>

        <div className="schema-studio-footer">
          <div className="schema-footer-summary">
            {localConfig.mode === "open" ? (
              <span className="schema-footer-mode">
                Mode: <strong>Fully Open</strong> (unconstrained by predefined schema)
              </span>
            ) : localConfig.mode === "hybrid" ? (
              <>
                <span>
                  <strong>{localConfig.labels.length}</strong> primary predicates
                </span>
                <span className="schema-footer-mode">Mode: <strong>Hybrid (emergent typing)</strong></span>
              </>
            ) : (
              <>
                <span>
                  <strong>{localConfig.labels.length}</strong> active predicates
                </span>
                <span className="schema-footer-mode">Mode: <strong>Strict Schema</strong></span>
              </>
            )}
          </div>
          <div className="schema-footer-actions">
            <button
              type="button"
              className="schema-btn-secondary"
              disabled={probing}
              onClick={resetToDefaults}
            >
              Reset to Defaults
            </button>
            <button
              type="button"
              className="schema-btn-primary"
              disabled={probing}
              onClick={() => {
                onSave(localConfig);
                onClose();
              }}
            >
              Apply Schema
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
