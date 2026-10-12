import React, { useState, useEffect } from "react";
import { relationshipMergeScope } from "./relationshipMergeScope";
import { post } from "../storage/api";
import type { SemanticPlan } from "./SemanticResults";

export interface CombineRelationshipsModalProps {
  isOpen: boolean;
  onClose: () => void;
  plan: SemanticPlan;
  initialSources?: string[];
  suggestion?: {target:string;kind:'equivalent'|'direction_review'|'structural'};
  onPlanUpdated?: (updated: SemanticPlan) => void;
}

export function CombineRelationshipsModal({
  isOpen,
  onClose,
  plan,
  initialSources = [],
  suggestion,
  onPlanUpdated,
}: CombineRelationshipsModalProps) {
  const availableRelations = Array.from(
    new Set([
      ...(plan.output ? plan.output.map((r) => r.relation) : (plan.decisions || []).flatMap(d => d.relations || [])),
    ])
  )
    .filter(name => Boolean(name) && !['NEGATIVE', 'UNRESOLVED'].includes(name))
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
  const [directionsReviewed, setDirectionsReviewed] = useState(false);
  const [meaningsConfirmed, setMeaningsConfirmed] = useState(false);
  const [expectedRevision, setExpectedRevision] = useState<string | undefined>();

  // Sync state when modal opens or initialSources change
  useEffect(() => {
    if (!isOpen) return;
    setError("");
    setSubmitting(false);
    setDirectionsReviewed(false);
    setMeaningsConfirmed(false);
    setExpectedRevision(plan.content_revision);

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
      setTargetName(suggestion?.target || "");
    } else {
      setSelectedSources([]);
      setRenameSource(availableRelations[0] || "");
      setDefinition("");
      setTargetName("");
    }
  }, [isOpen, initialSources, suggestion]);

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

  const mergeScope = relationshipMergeScope(plan, tab === "combine" ? selectedSources : [renameSource], trimmedTarget);
  const participatingRelations = tab === 'combine' ? selectedSources.filter(name => availableRelations.includes(name)) : availableRelations.filter(name => name === renameSource);
  const definitionSources = Array.from(new Set([...(tab === 'combine' ? selectedSources : [renameSource]), ...(availableRelations.includes(trimmedTarget) ? [trimmedTarget] : [])]));
  const existingDefinitions = Array.from(new Set(definitionSources.map(name => plan.schema_config?.definitions?.[name]?.trim()).filter(Boolean)));
  const needsDefinition = existingDefinitions.length > 1 && !definition.trim();
  const canSubmit =
    !mergeScope.reason &&
    !needsDefinition &&
    !submitting &&
    isTargetValid &&
    (suggestion?.kind !== "direction_review" || directionsReviewed) &&
    (suggestion?.kind !== "structural" || meaningsConfirmed) &&
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
        expected_revision: expectedRevision,
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
            <h3 id="combine-rel-modal-title">{suggestion ? "Accept suggested merge" : "Combine or Rename Relationships"}</h3>
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
            {suggestion && <div className="semantic-merge-impact">
              <strong>{selectedSources.reduce((sum, rel) => sum + countFor(rel), 0)} output rows use these labels in this run.</strong>
              <p>Choose an existing name or enter a new name below. Source records and evidence are preserved. Relationship directions are unchanged.</p>
              {suggestion.kind === 'structural' && <>
                <p>These labels overlap on shared records; this is not an LLM judgment of equivalent meanings. The merge applies to every occurrence of the selected labels throughout this run.</p>
                <label className="combine-checkbox-label"><input type="checkbox" checked={meaningsConfirmed} onChange={e => setMeaningsConfirmed(e.target.checked)}/><span>I confirm these labels mean the same relationship and want to keep their current directions.</span></label>
              </>}
              {suggestion.kind === 'direction_review' && <label className="combine-checkbox-label"><input type="checkbox" checked={directionsReviewed} onChange={e => setDirectionsReviewed(e.target.checked)}/><span>I reviewed the directions and want to keep them when merging the names.</span></label>}
            </div>}
            {!!mergeScope.tables.length && <p className="semantic-merge-impact"><strong>Source table pair</strong> · {mergeScope.tables.map(t=>t.name).join(' ↔ ')}<br /><small>Matching tables does not establish equivalent meanings. Review the definitions and evidence.</small></p>}
            {!!mergeScope.reason && <p className="combine-rel-error-alert" role="status">{mergeScope.reason}</p>}
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
              <label htmlFor="combine-existing-target">Keep an existing relationship name</label>
              <select id="combine-existing-target" className="combine-rel-select" value={participatingRelations.includes(trimmedTarget) ? trimmedTarget : ''}
                onChange={e => {setTargetName(e.target.value);}}>
                <option value="">Enter a new name below</option>
                {participatingRelations.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
              <span className="combine-field-tip">Choose a participating label or write a new name below. Existing target names remain subject to the source-table-pair check.</span>
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
                Predicate Definition {existingDefinitions.length > 1 ? '(required for conflicting definitions)' : '(optional)'}:
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
              {existingDefinitions.length > 1 && <div className="combine-definition-choices">
                <small>These definitions differ. Choose one to keep, or write the combined meaning above.</small>
                {definitionSources.filter(name=>plan.schema_config?.definitions?.[name]?.trim()).map(name => <button type="button" key={name} aria-pressed={definition.trim()===plan.schema_config!.definitions![name].trim()}
                  onClick={()=>setDefinition(plan.schema_config!.definitions![name])}><strong>{name}</strong><span>{plan.schema_config!.definitions![name]}</span></button>)}
              </div>}
              {needsDefinition && <small role="status">Choose or write a definition before accepting this merge.</small>}
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
                ? suggestion ? "Accept merge" : `Combine ${selectedSources.length} Relationships`
                : `Rename to ${trimmedTarget || "..."}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
