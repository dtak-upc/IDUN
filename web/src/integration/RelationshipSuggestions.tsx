import { useEffect, useMemo, useRef, useState } from 'react';
import {inferenceUnavailable} from '../mode';
import { createPortal } from 'react-dom';
import { relationshipMergeScope } from './relationshipMergeScope';
import { api, post } from '../storage/api';
import type { SemanticPlan } from './SemanticResults';
import { relationshipGroups, type ReviewKeys, type ReviewSource } from './relationshipGroups';
type SemanticReview = { saved?: boolean; stale?: boolean; created?: number; model?: string; basis_revision?:string; reviewed_labels: number; groups: { labels: string[]; current_labels?:string[]; state?:string; kind: 'equivalent' | 'direction_review' | 'related_only'; reason: string; direction_mismatch: boolean; stale?: boolean; applied?: boolean; applied_target?: string }[] };
function MergeBoundary({scope}:{scope:ReturnType<typeof relationshipMergeScope>}) {
  return scope.reason ? <div className="relationship-merge-boundary">
    <small role="status">{scope.reason}</small>
    {scope.conflicts?.map(pair => <div key={JSON.stringify(pair.tables.map(t=>t.id))}>
      <strong>{pair.tables.map(t=>t.name).join(' ↔ ')}</strong>
      <small>{pair.labels.join(' · ')} · {pair.candidates.slice(0,5).join(', ')}{pair.candidates.length>5 ? ` · +${pair.candidates.length-5} more paths` : ''}</small>
    </div>)}
  </div> : <small>Source table pair · {scope.tables.map(t=>t.name).join(' ↔ ')}</small>;
}

export function RelationshipSuggestions({ plan, onCombine, onEvidence, resumeReview }: {
  resumeReview?: {panel: 'meanings' | 'pairs'; serial: number}; plan: SemanticPlan; onCombine: (labels: string[], suggestion?: { target: string; kind: 'equivalent' | 'direction_review' | 'structural' }) => void; onEvidence: (left: string, right: string) => void;
}) {
  const [keys, setKeys] = useState<ReviewKeys>({});
  const [semantic, setSemantic] = useState<SemanticReview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [panel, setPanel] = useState<'meanings' | 'pairs' | null>(null);
  useEffect(() => { if (resumeReview) setPanel(resumeReview.panel); }, [resumeReview]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelOpen = panel !== null;
  useEffect(() => {
    if (!panelOpen) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setPanel(null); }
      if (event.key !== 'Tab') return;
      const items = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]') || [])].filter(el => el.getClientRects().length);
      const first = items[0], last = items[items.length - 1];
      if (!first) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKey);
      // Do not steal focus from the merge/evidence view that may have just opened.
      if (document.activeElement === document.body && previousFocus?.isConnected) previousFocus.focus();
    };
  }, [panelOpen]);
  const combine = (labels: string[], suggestion?: {target:string;kind:'equivalent'|'direction_review'|'structural'}) => {
    setPanel(null); onCombine(labels, suggestion);
  };
  const inspectEvidence = (left: string, right: string) => { setPanel(null); onEvidence(left, right); };
  const requestVersion = useRef(0);
  useEffect(() => {
    const version = ++requestVersion.current;
    setSemantic(null); setError(''); setPending(false);
    void api<SemanticReview>(`/integration/${plan.id}/relationship-suggestions`).then(result => {
      if (version === requestVersion.current && result.saved) setSemantic(result);
    }).catch(e => { if (version === requestVersion.current) setError(String(e)); });
  }, [plan.id, plan.content_revision, plan.output]);
  useEffect(() => () => { requestVersion.current++; }, []);
  async function compareLabels() {
    const version = ++requestVersion.current;
    setPending(true); setError('');
    try {
      const result = await post<SemanticReview>(`/integration/${plan.id}/relationship-suggestions`);
      if (version === requestVersion.current) setSemantic(result);
    } catch (e) { if (version === requestVersion.current) setError(String(e)); }
    finally { if (version === requestVersion.current) setPending(false); }
  }
  const sources = useMemo(() => {
    const byId = new Map<string, ReviewSource>();
    for (const c of plan.cases) for (const s of [c.left, c.right]) if (s.source) byId.set(s.source, s);
    return [...byId.values()];
  }, [plan.cases]);
  const { groups, skipped } = useMemo(() => relationshipGroups(plan.cases, plan.output, keys), [plan.cases, plan.output, keys]);
  const [page, setPage] = useState(0);
  const currentPage = Math.min(page, Math.max(0, Math.ceil(groups.length / 10) - 1));
  return <>
    <section className="relationship-review-rail" aria-label="Relationship review tools">
      <button type="button" className="relationship-review-launch" onClick={() => setPanel('meanings')} aria-haspopup="dialog">
        <span className="relationship-review-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 2.4 6.6L21 12l-6.6 2.4L12 21l-2.4-6.6L3 12l6.6-2.4Z"/></svg></span>
        <span className="relationship-review-launch-copy"><strong>Compare relationship meanings</strong><small>{pending ? 'Comparing with your LLM…' : semantic?.stale ? 'Saved suggestions · refresh needed' : error ? 'Comparison needs attention' : semantic ? `${semantic.groups.length} saved suggestions · review when ready` : 'Find synonyms with your selected LLM'}</small></span>
        <span className="relationship-review-count">{semantic?.groups.length ?? 'LLM'}</span><span aria-hidden="true">↗</span>
      </button>
      <button type="button" className="relationship-review-launch" onClick={() => setPanel('pairs')} aria-haspopup="dialog">
        <span className="relationship-review-icon pair-icon" aria-hidden="true"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="7" height="16" rx="2"/><rect x="14" y="4" width="7" height="16" rx="2"/><path d="M6 9h1m10 0h1M6 14h1m10 0h1m-8-2h4"/></svg></span>
        <span className="relationship-review-launch-copy"><strong>Review possible equivalent labels</strong><small>Compare labels attached to the same records</small></span>
        <span className="relationship-review-count">{groups.length}</span><span aria-hidden="true">↗</span>
      </button>
    </section>
    {panel && createPortal(<div className="relationship-review-backdrop" onClick={e => { if (e.target === e.currentTarget) setPanel(null); }}>
      <div ref={dialogRef} className="relationship-suggestions relationship-review-dialog" role="dialog" aria-modal="true" aria-labelledby="relationship-review-title">
        <header className="relationship-review-dialog-header">
          <div><small>RELATIONSHIP REVIEW · {plan.title}</small><h2 id="relationship-review-title">Refine your integrated relationships</h2></div>
          <button ref={closeRef} type="button" className="relationship-review-close" aria-label="Close relationship review" onClick={() => setPanel(null)}>×</button>
        </header>
        <div className="relationship-review-tabs" role="tablist" aria-label="Relationship review method">
          <button id="review-meanings-tab" type="button" role="tab" aria-selected={panel === 'meanings'} aria-controls="review-meanings-panel" onClick={() => setPanel('meanings')}>Compare meanings <span>{semantic?.groups.length ?? 'LLM'}</span></button>
          <button id="review-pairs-tab" type="button" role="tab" aria-selected={panel === 'pairs'} aria-controls="review-pairs-panel" onClick={() => setPanel('pairs')}>Shared record pairs <span>{groups.length}</span></button>
        </div>
        <div className="relationship-review-body" role="tabpanel" id={panel === 'meanings' ? 'review-meanings-panel' : 'review-pairs-panel'} aria-labelledby={panel === 'meanings' ? 'review-meanings-tab' : 'review-pairs-tab'}>
        {panel === 'meanings' ? <>
    <h3>Compare relationship meanings</h3>
    <p>Find possible synonyms across different records using the LLM selected in Settings, definitions, and up to three evidence examples per label. This is advisory, not a probability or an automatic merge.</p>
    <div className="relationship-review-basis"><strong>Current curated run · {new Set(plan.output.map(r=>r.relation)).size} relationship labels</strong><small>New comparisons use your accepted names and definitions. Saved suggestions reflect the earlier review; changed groups need a refresh.</small></div>
    <button type="button" className="review-compare-action" disabled={pending||inferenceUnavailable} onClick={compareLabels}>{pending ? 'Comparing meanings…' : semantic ? 'Refresh comparison with current labels' : 'Suggest equivalent labels with LLM'}</button>
    {error && <p role="alert">{error}</p>}
    {semantic && <p>{semantic.reviewed_labels} labels reviewed{semantic.model ? ` · ${semantic.model}` : ''} · {semantic.groups.length} suggestions</p>}
    {semantic?.created && <small>Saved for this run · {new Date(semantic.created * 1000).toLocaleString()}</small>}
    {semantic?.stale && <p role="status">Some suggestions have changed inputs. Compare meanings again to refresh those; unchanged suggestions remain available.</p>}
    {semantic && !semantic.groups.length && <p role="status">{semantic.reviewed_labels < 2 ? 'Fewer than two relationship labels remain to compare.' : 'No equivalent labels were suggested for this review.'}</p>}
    {semantic?.groups.map((g, i) => { const names=g.current_labels || g.labels; const scope = relationshipMergeScope(plan,names); const stale=g.stale ?? semantic.stale; return <article className="relationship-suggestion semantic-label-suggestion" key={i}>
      <header className="semantic-merge-header">
        <div><strong>{names.join(' · ')}</strong><small>{g.kind === 'equivalent' ? 'Possible equivalents' : g.kind === 'direction_review' ? 'Possible family · direction needs review' : 'Advisory comparison · not an actionable merge'}</small></div>
        {g.applied ? <span className="relationship-review-count">Merged as {g.applied_target}</span> : stale ? <button type="button" className="semantic-merge-accept" disabled={pending||inferenceUnavailable} onClick={compareLabels}>Refresh this review</button> : g.kind !== 'related_only' && <button type="button" className="semantic-merge-accept" disabled={!!scope.reason || pending} onClick={() => combine(names, {target: names[0], kind: g.kind as 'equivalent' | 'direction_review'})}>{g.kind === 'equivalent' ? 'Accept merge…' : 'Review & merge…'}</button>}
      </header>
      <p>{g.reason}</p>
      {!g.applied && !stale && <MergeBoundary scope={scope}/>}
      {stale && <small role="status">Names, definitions or evidence changed. Refresh compares the current curated run before accepting.</small>}
      {[...names].sort().join('|')!==[...g.labels].sort().join('|') && <small>Previously reviewed as {g.labels.join(' · ')}</small>}
      <small>{plan.output.filter(r => names.includes(r.relation)).length} current output rows in this run</small>
      {g.kind === 'related_only' && <p>These labels have related meanings but were not suggested as interchangeable.</p>}
      <details className="semantic-merge-evidence"><summary>Review definitions & evidence</summary>
      {g.kind === 'direction_review' && <p><strong>Check direction before combining.</strong> Active/passive labels or conflicting directions may require correction. Combining labels preserves all current directions; it does not reverse records.</p>}
      {names.map(name => <article key={name}><strong>{name}</strong>
        <p>{plan.schema_config?.definitions?.[name] || 'No saved definition.'}</p>
        {plan.output.filter(r => r.relation === name).slice(0, 3).map((r, j) => <div key={j}>
          <p>{r.candidate} · {r.record_a_value || r.left_value} → {r.record_b_value || r.right_value} · {r.direction || 'undirected'}</p>
          <blockquote>{r.evidence_quote}</blockquote>
          <button type="button" onClick={() => inspectEvidence(r.left_link, r.right_link)}>Inspect supporting evidence</button>
        </div>)}
      </article>)}
      <p>A confirmed label merge applies throughout this run. Review examples beyond this sample before accepting.</p>
      </details>
    </article>; })}
    </> : <>
    <h3>Review possible equivalent labels <small>{groups.length} shared pair groups</small></h3>
    <p>Different labels describe the same source-row pair in these groups. Compare the records and passages before deciding whether the labels mean the same relationship.</p>
    {!!plan.curation?.length && <div className="relationship-merge-confirmation" role="status">
      <strong>Last completed {plan.curation.at(-1)!.sources.length>1 ? 'merge' : 'rename'} · {plan.curation.at(-1)!.target}</strong>
      <small>{plan.curation.at(-1)!.sources.join(' · ')} → {plan.curation.at(-1)!.target}</small>
      <small>Merged groups leave this list once they share one label. Other suggestions are checked independently against their source tables.</small>
    </div>}
    <details className="relationship-review-keys"><summary>Choose review keys · default: exact source rows</summary>
      <p>Select one or more columns for a composite key. Values must match exactly within the same source table. These are review keys, not verified primary keys, and are never sent to a model. Blank keys are excluded. Choices apply to this view.</p>
      {sources.map(s => <fieldset key={s.source}><legend>{s.name} · {s.source!.slice(0, 8)}</legend>
        {s.columns.map((name, i) => <label key={i}><input type="checkbox" checked={keys[s.source!]?.includes(i) || false}
          onChange={e => { setPage(0); setKeys(old => ({ ...old, [s.source!]: e.target.checked ? [...(old[s.source!] || []), i].sort((a, b) => a - b) : (old[s.source!] || []).filter(k => k !== i) })); }} />{name}</label>)}
      </fieldset>)}
      <button type="button" onClick={() => { setKeys({}); setPage(0); }}>Use exact source rows</button>
    </details>
    {!groups.length && <p>No overlapping labels found under the current review keys.</p>}
    {!!skipped && <small>{skipped} output rows lack source identity or nonblank selected keys and were excluded from suggestions.</small>}
    {groups.slice(currentPage * 10, currentPage * 10 + 10).map(g => {
      const first = g.cases[0];
      const scope = relationshipMergeScope(plan,g.labels);
      const affected = plan.output.filter(r => g.labels.includes(r.relation)).length;
      return <article key={g.key} className="relationship-suggestion structural-label-suggestion">
        <header className="semantic-merge-header">
          <div><strong>{g.labels.join(' · ')}</strong><small>{g.cases.length} reviewed pairs · {g.rows.length} output rows · shared records</small></div>
          <button type="button" className="semantic-merge-accept" disabled={!!scope.reason} onClick={() => combine(g.labels, {target:g.labels[0],kind:'structural'})}>Accept merge…</button>
        </header>
        <MergeBoundary scope={scope}/>
        <p>Shared records suggest a possible overlap. Confirm that these labels mean the same relationship before merging.</p>
        <small>{affected} output rows across this run use these labels.</small>
        <details className="semantic-merge-evidence"><summary>Review records & evidence</summary>
        <p>{g.basis} · {first.left.name} → {first.right.name} · direction: {g.direction}</p>
        <p>Record A: <strong>{first.left.record.cells[first.left.anchor_column]}</strong> · Record B: <strong>{first.right.record.cells[first.right.anchor_column]}</strong></p>
        {g.rows.map((row, i) => {
          const c = g.cases.find(c => c.candidate === row.candidate)!;
          return <article key={i}><strong>{row.relation} · {row.candidate}</strong>
            <small>{c.document_name || 'Supporting document'}</small>
            <div className="relationship-compare-records">{(['left', 'right'] as const).map(side => <dl key={side} aria-label={side === 'left' ? 'Record A' : 'Record B'}>
              <dt><b>{side === 'left' ? 'Record A' : 'Record B'}</b></dt><dd>{c[side].name}</dd>
              {c[side].columns.map((name, j) => <div key={j}><dt>{name}</dt><dd>{c[side].record.cells[j] || '—'}</dd></div>)}
            </dl>)}</div>
            <blockquote>{row.evidence_quote}</blockquote>
            <button type="button" onClick={() => inspectEvidence(row.left_link, row.right_link)}>Inspect supporting evidence</button>
          </article>;
        })}
        <p>Combining labels applies throughout this run ({affected} output rows currently use these labels), not only to this group. Original model labels and evidence remain in the edit history.</p>
        </details>
      </article>;
    })}
    {groups.length > 10 && <div className="space-toolbar"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous groups</button>
      <span>Page {currentPage + 1} of {Math.ceil(groups.length / 10)}</span><button type="button" disabled={(currentPage + 1) * 10 >= groups.length} onClick={() => setPage(currentPage + 1)}>Next groups</button></div>}
        </>}
        </div>
      </div>
    </div>, document.body)}
  </>;
}
