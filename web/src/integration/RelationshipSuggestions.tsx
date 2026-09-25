import { useEffect, useMemo, useRef, useState } from 'react';
import { api, post } from '../storage/api';
import type { SemanticPlan } from './SemanticResults';
import { relationshipGroups, type ReviewKeys, type ReviewSource } from './relationshipGroups';
type SemanticReview = { saved?: boolean; stale?: boolean; created?: number; model?: string; reviewed_labels: number; groups: { labels: string[]; kind: 'equivalent' | 'direction_review' | 'related_only'; reason: string; direction_mismatch: boolean }[] };

export function RelationshipSuggestions({ plan, onCombine, onEvidence }: {
  plan: SemanticPlan; onCombine: (labels: string[]) => void; onEvidence: (left: string, right: string) => void;
}) {
  const [keys, setKeys] = useState<ReviewKeys>({});
  const [semantic, setSemantic] = useState<SemanticReview | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
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
  return <section className="relationship-suggestions" aria-label="Relationship merge suggestions">
    <h3>Compare relationship meanings</h3>
    <p>Find possible synonyms across different records using the LLM selected in Settings, definitions, and up to three evidence examples per label. This is advisory, not a probability or an automatic merge.</p>
    <button type="button" disabled={pending || new Set(plan.output.map(r => r.relation)).size < 2} onClick={compareLabels}>{pending ? 'Comparing meanings…' : 'Suggest equivalent labels with LLM'}</button>
    {error && <p role="alert">{error}</p>}
    {semantic && <p>{semantic.reviewed_labels} labels reviewed{semantic.model ? ` · ${semantic.model}` : ''} · {semantic.groups.length} suggestions</p>}
    {semantic?.created && <small>Saved for this run · {new Date(semantic.created * 1000).toLocaleString()}</small>}
    {semantic?.stale && <p role="status">Saved suggestions refer to an earlier version of this run. Compare meanings again before combining labels.</p>}
    {semantic?.groups.map((g, i) => <details className="relationship-suggestion semantic-label-suggestion" key={i}>
      <summary><strong>{g.labels.join(' · ')}</strong><span>{g.kind === 'equivalent' ? 'Possible equivalents' : g.kind === 'direction_review' ? 'Possible family · direction needs review' : 'Related meanings · not equivalent'}</span></summary>
      <p>{g.reason}</p>
      {g.kind === 'direction_review' && <p><strong>Check direction before combining.</strong> Active/passive labels or conflicting directions may require correction. Combining labels preserves all current directions; it does not reverse records.</p>}
      {g.labels.map(name => <article key={name}><strong>{name}</strong>
        <p>{plan.schema_config?.definitions?.[name] || 'No saved definition.'}</p>
        {plan.output.filter(r => r.relation === name).slice(0, 3).map((r, j) => <div key={j}>
          <p>{r.candidate} · {r.record_a_value || r.left_value} → {r.record_b_value || r.right_value} · {r.direction || 'undirected'}</p>
          <blockquote>{r.evidence_quote}</blockquote>
          <button type="button" onClick={() => onEvidence(r.left_link, r.right_link)}>Inspect supporting evidence</button>
        </div>)}
      </article>)}
      <p>A confirmed label merge applies throughout this run. Review examples beyond this sample before accepting.</p>
      {g.kind !== 'related_only' && <button type="button" disabled={semantic.stale || pending} onClick={() => onCombine(g.labels)}>Review combining suggested labels</button>}
    </details>)}
    <hr />
    <h3>Review possible equivalent labels <small>{groups.length} shared pair groups</small></h3>
    <p>Different labels describe the same source-row pair in these groups. Compare the records and passages before deciding whether the labels mean the same relationship.</p>
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
      const affected = plan.output.filter(r => g.labels.includes(r.relation)).length;
      return <details key={g.key} className="relationship-suggestion">
        <summary><strong>{g.labels.join(' · ')}</strong><span>{g.cases.length} reviewed pairs · {g.rows.length} output rows</span></summary>
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
            <button type="button" onClick={() => onEvidence(row.left_link, row.right_link)}>Inspect supporting evidence</button>
          </article>;
        })}
        <p>Combining labels applies throughout this run ({affected} output rows currently use these labels), not only to this group. Original model labels and evidence remain in the edit history.</p>
        <button type="button" onClick={() => onCombine(g.labels)}>Review combining these labels</button>
      </details>;
    })}
    {groups.length > 10 && <div className="space-toolbar"><button type="button" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}>Previous groups</button>
      <span>Page {currentPage + 1} of {Math.ceil(groups.length / 10)}</span><button type="button" disabled={(currentPage + 1) * 10 >= groups.length} onClick={() => setPage(currentPage + 1)}>Next groups</button></div>}
  </section>;
}
