import React, { useState, useEffect } from "react";
import { post } from "../storage/api";
import type { SemanticPlan } from "./SemanticResults";

export interface CombineRelationshipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SemanticPlan;
  initialSources?: string[];
  onPlanUpdated?: (updated: SemanticPlan) => void;
}

export function CombineRelationshipsModal({
  isOpen,
  onClose,
  plan,
  initialSources = [],
  onPlanUpdated,
}: CombineRelationshipsModalProps) {
  const availableRelations = Array.from(
    new Set([
      ...(plan.output ? plan.output.map((r) => r.relation) : []),
      ...(plan.decisions ? plan.decisions.flatMap((d) => d.relations || []) : []),
    ])
  )
    .filter(Boolean)
    .sort();

  const [tab, setTab] = useState<"combine" | "rename">(
    initialSources.length === 1 ? "rename" : "combine"
  );
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [renameSource, setRenameSource] = useState<string>("");
  const [targetName, setTargetName] = useState<string>("");
  const [definition, setDefinition] = useState<string>("");
  const [addToSchema, setAddToSchema] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Sync state when modal opens or initialSources change
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSubmitting(false);

    const isSingle = initialSources.length === 1;
    setTab(isSingle ? "rename" : "combine");

    if (isSingle) {
      const src = initialSources[0];
      setRenameSource(src);
      setSelectedSources([src]);
      // Prefill definition if available
      const existingDef = (plan as any).schema_config?.definitions?.[src] || "";
      setDefinition(existingDef);
      setTargetName("");
    } else if (initialSources.length > 1) {
      setSelectedSources(initialSources);
      setRenameSource(initialSources[0] || availableRelations[0] || "");
      setDefinition("");
      setTargetName("");
    } else {
      setSelectedSources([]);
      setRenameSource(availableRelations[0] || "");
      setDefinition("");
      setTargetName("");
    }
  }, [isOpen, initialSources]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) {
        onClose();
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const countFor = (rel: string) =>
    plan.output ? plan.output.filter((r) => r.relation === rel).length : 0;

  const canonicalRegex = /^[A-Z0-9_]{2,64}$/;
  const trimmedTarget = targetName.trim();
  const isTargetValid =
    canonicalRegex.test(trimmedTarget) &&
    !["NEGATIVE", "UNRESOLVED"].includes(trimmedTarget);

  const canSubmit =
    !submitting &&
    isTargetValid &&
    (tab === "combine"
      ? selectedSources.length >= 2
      : Boolean(renameSource) && renameSource !== trimmedTarget);

  function handleToggleSource(rel: string) {
    setSelectedSources((prev) =>
      prev.includes(rel) ? prev.filter((r) => r !== rel) : [...prev, rel]
    );
  }

  function handleSelectAll() {
    setSelectedSources([...availableRelations]);
  }

  function handleClearSelection() {
    setSelectedSources([]);
  }

  function handleRenameSourceChange(newSrc: string) {
    setRenameSource(newSrc);
    const existingDef = (plan as any).schema_config?.definitions?.[newSrc] || "";
    if (!definition || definition === (plan as any).schema_config?.definitions?.[renameSource]) {
      setDefinition(existingDef);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError("");

    const sources = tab === "combine" ? selectedSources : [renameSource];
    const target = trimmedTarget;

    setSubmitting(true);
    try {
      const updated = await post<SemanticPlan>(`/integration/${plan.id}/relationships`, {
        sources,
        target,
        definition: definition.trim() || undefined,
        add_to_schema: addToSchema,
      });
      onPlanUpdated?.(updated);
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="lake-modal-overlay"
      role="presentation"
      onClick={() => !submitting && onClose()}
    >
      <div
        className="lake-modal-card combine-rel-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="combine-rel-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lake-modal-header combine-rel-header">
          <div className="combine-rel-header-content">
            <h3 id="combine-rel-modal-title">Combine or Rename Relationships</h3>
            <p className="lake-modal-desc">
              Consolidate predicted relationships into a single predicate or assign
              a custom user-defined name for this integration run. Changes apply
              to every occurrence of the selected labels in this run. Original
              model labels and supporting evidence are preserved.
            </p>
          </div>
          <button
            type="button"
            className="combine-rel-close-btn"
            onClick={onClose}
            disabled={submitting}
            aria-label="Close dialog"
          >
            ×
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="combine-rel-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "combine"}
            className={`combine-rel-tab-btn ${tab === "combine" ? "active" : ""}`}
            onClick={() => {
              setTab("combine");
              setError("");
            }}
          >
            Combine Multiple ({selectedSources.length} selected)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "rename"}
            className={`combine-rel-tab-btn ${tab === "rename" ? "active" : ""}`}
            onClick={() => {
              setTab("rename");
              setError("");
            }}
          >
            Rename Single
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="lake-modal-body combine-rel-modal-body">
            {error && (
              <div className="combine-rel-error-alert" role="alert">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <span>{error}</span>
              </div>
            )}

            {tab === "combine" ? (
              <div className="combine-sources-section">
                <div className="combine-section-heading">
                  <label>Select relationships to combine into one:</label>
                  <div className="combine-quick-actions">
                    <button
                      type="button"
                      className="combine-link-btn"
                      onClick={handleSelectAll}
                    >
                      Select all
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      className="combine-link-btn"
                      onClick={handleClearSelection}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="combine-rel-list" role="group" aria-label="Available relationships">
                  {availableRelations.map((rel) => {
                    const isChecked = selectedSources.includes(rel);
                    const count = countFor(rel);
                    return (
                      <label
                        key={rel}
                        className={`combine-rel-item ${isChecked ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          className="combine-rel-checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleSource(rel)}
                        />
                        <span className="combine-rel-label">{rel}</span>
                        <span className="combine-rel-count">
                          {count} {count === 1 ? "row" : "rows"}
                        </span>
                      </label>
                    );
                  })}
                </div>
                {selectedSources.length < 2 && (
                  <p className="combine-hint-text">
                    Select at least 2 relationships to merge their rows and evidence.
                  </p>
                )}
              </div>
            ) : (
              <div className="rename-source-section">
                <label htmlFor="rename-source-select">
                  Select relationship to rename:
                </label>
                <select
                  id="rename-source-select"
                  className="combine-rel-select"
                  value={renameSource}
                  onChange={(e) => handleRenameSourceChange(e.target.value)}
                >
                  {availableRelations.map((rel) => (
                    <option key={rel} value={rel}>
                      {rel} ({countFor(rel)} rows)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Target Predicate Name */}
            <div className="combine-field-group">
              <label htmlFor="combine-target-input">
                Target Canonical Predicate Name:
              </label>
              <input
                id="combine-target-input"
                className="combine-rel-input"
                type="text"
                value={targetName}
                onChange={(e) =>
                  setTargetName(
                    e.target.value.toUpperCase().replace(/[\s-]+/g, "_")
                  )
                }
                placeholder="e.g. THERAPEUTIC_INDICATION"
                maxLength={64}
                required
                autoFocus
              />
              <span className="combine-field-tip">
                Must be 2–64 uppercase letters, digits, or underscores (e.g.{" "}
                <code>TREATS_INDICATION</code>). Cannot be <code>NEGATIVE</code> or{" "}
                <code>UNRESOLVED</code>.
              </span>
            </div>

            {/* Relationship Definition */}
            <div className="combine-field-group">
              <label htmlFor="combine-def-input">
                Predicate Definition (optional):
              </label>
              <textarea
                id="combine-def-input"
                className="combine-rel-textarea"
                rows={2}
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                maxLength={1200}
                placeholder="Describe what this relationship represents (e.g. Drug is therapeutically indicated or prescribed for the diagnosed condition)..."
              />
            </div>

            {/* Add to Lake Schema Checkbox */}
            <div className="combine-checkbox-group">
              <label className="combine-checkbox-label">
                <input
                  type="checkbox"
                  className="combine-rel-checkbox"
                  checked={addToSchema}
                  onChange={(e) => setAddToSchema(e.target.checked)}
                />
                <div className="combine-checkbox-text">
                  <strong>Add to Lake Schema</strong>
                  <p>
                    Persist this predicate and its definition to the lake&apos;s
                    integration schema so future runs in Hybrid or Strict mode can
                    utilize it.
                  </p>
                </div>
              </label>
            </div>
          </div>

          <div className="lake-modal-footer combine-rel-modal-footer">
            <button
              type="button"
              className="lake-modal-btn-cancel"
              disabled={submitting}
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="lake-modal-btn-primary"
              disabled={!canSubmit}
            >
              {submitting
                ? "Applying changes..."
                : tab === "combine"
                ? `Combine ${selectedSources.length} Relationships`
                : `Rename to ${trimmedTarget || "..."}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
