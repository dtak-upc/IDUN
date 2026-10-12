import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../storage/api';
import { useSourcePeek } from './SourcePeek';
import './journey.css';

export type ScopeSnapshot = {
  id?: string; generation: string; recipe?: Record<string, unknown>;
  counts: { pairs: number; tables: number; documents: number; shared_documents: number };
  total_pairs: number; indexed_pair_scores: number | null; notice: string;
};
type Pair = { id: string; table: string; text: string; table_name: string; document_name: string; score: number; table_version: string; document_version: string };
type Page = { total: number; offset: number; limit: number; items: Pair[]; receipt: { generation: string; scope_id: string | null; status: string } };

function policy(recipe?: Record<string, unknown>) {
  if (!recipe || recipe.mode === 'all') return 'All profiled candidate pairs';
  const rules: string[] = [];
  if (recipe.mode === 'explicit') rules.push('Picked pairs');
  if (recipe.min_score !== undefined) rules.push(`Minimum score ${recipe.min_score}`);
  if (recipe.max_score !== undefined) rules.push(`Maximum score ${recipe.max_score}`);
  if (recipe.top_documents) rules.push(`Top ${recipe.top_documents} documents per table`);
  if (recipe.top_tables) rules.push(`Top ${recipe.top_tables} tables per document`);
  if (recipe.top_documents && recipe.top_tables) rules.push(recipe.combine === 'union' ? 'Either direction' : 'Both directions');
  for (const name of ['tables', 'documents', 'include', 'exclude']) {
    const values = recipe[name];
    if (Array.isArray(values)) rules.push(`${values.length} ${name === 'include' ? 'added picks' : name === 'exclude' ? 'excluded picks' : name}`);
  }
  if (recipe.search) rules.push(`Search: ${recipe.search}`);
  return rules.join(' · ') || 'Filtered candidate pairs';
}

function ScopeCardArrow() {
  return <svg className="journey-scope-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>;
}

export function ScopeHandoff({ scope, lakeId, receiving = false, children }: {
  scope: ScopeSnapshot; lakeId: string; receiving?: boolean; children?: ReactNode;
}) {
  const [group, setGroup] = useState<'all' | 'included' | 'outside'>('included');
  const [open, setOpen] = useState(false), [offset, setOffset] = useState(0);
  const [activeCard, setActiveCard] = useState<'profiling' | 'selection' | 'loki'>('selection');
  const [page, setPage] = useState<Page>(), [error, setError] = useState(''), [loading, setLoading] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  const key = JSON.stringify([lakeId, scope.id, scope.generation, scope.recipe]);
  const sourcePeek = useSourcePeek(lakeId, key + group + offset + open);
  useEffect(() => { setPage(undefined); setOffset(0); setError(''); }, [key, group]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    const controller = new AbortController();
    setLoading(true); setPage(undefined); setError('');
    api<Page>('/discovery/scope/inspect', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({ ...(scope.id ? { id: scope.id } : { generation: scope.generation, recipe: scope.recipe || { mode: 'all' } }), group, offset, limit: 12 }),
    }, lakeId).then(result => {
      if (!active) return;
      if (result.receipt.generation !== scope.generation) throw Error('The profile changed. Refresh the scope before inspecting it.');
      setPage(result);
    }).catch(e => { if (active) setError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [key, group, offset, open]);
  function inspect(next: 'all' | 'included' | 'outside', origin: 'profiling' | 'selection' | 'loki' = next === 'all' ? 'profiling' : 'selection') {
    setActiveCard(origin); setGroup(next); setOffset(0); setOpen(true);
    requestAnimationFrame(() => {
      inspector.current?.focus({ preventScroll: true });
      inspector.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  const outside = scope.total_pairs - scope.counts.pairs;
  return <section className="journey-handoff" aria-label="Data Lake to Discovery handoff">
    <header className="journey-heading"><div><span>DATA JOURNEY · DATA LAKE → DISCOVERY</span><h3>{receiving ? 'See what Discovery receives' : 'See what moves into Discovery'}</h3></div><strong className="journey-status">{scope.id ? 'Committed scope' : 'Input preview'}</strong></header>
    <div className="journey-scope-cards">
      <button className="journey-scope-card" aria-label="Inspect received profiling sources" aria-expanded={open && group === 'all'} aria-controls="scope-pair-inspector" onClick={() => inspect('all')}>
        <span className="journey-scope-card-head"><span className="journey-scope-step">01</span><span role="heading" aria-level={4}>Received from profiling</span><ScopeCardArrow /></span>
        <span className="journey-scope-value">{scope.total_pairs.toLocaleString()}</span><span className="journey-scope-label">profiled source pairs</span>
        <span className="journey-scope-detail">Table–document similarities before your filters.</span>
        <span className="journey-scope-card-foot">Browse all sources <span aria-hidden="true">→</span></span>
      </button>
      <button className="journey-scope-card" aria-label="Inspect selected working set" aria-expanded={open && group === 'included' && activeCard === 'selection'} aria-controls="scope-pair-inspector" onClick={() => inspect('included')}>
        <span className="journey-scope-card-head"><span className="journey-scope-step">02</span><span role="heading" aria-level={4}>Selected working set</span><ScopeCardArrow /></span>
        <span className="journey-scope-value">{scope.counts.pairs.toLocaleString()}<span className="journey-scope-percentage">{scope.total_pairs ? Math.round(scope.counts.pairs / scope.total_pairs * 100) : 0}% of input</span></span><span className="journey-scope-label">source pairs in your scope</span>
        <span className="journey-scope-detail journey-scope-meter" aria-label={`${scope.counts.pairs} included, ${outside} outside scope, of ${scope.total_pairs} pairs`}><span style={{width:`${scope.total_pairs ? scope.counts.pairs / scope.total_pairs * 100 : 0}%`}} /></span>
        <span className="journey-scope-card-foot">Browse selected sources <span aria-hidden="true">→</span></span>
      </button>
      <button className="journey-scope-card" aria-label="Inspect sources passed to LOKI" aria-expanded={open && group === 'included' && activeCard === 'loki'} aria-controls="scope-pair-inspector" onClick={() => inspect('included', 'loki')}>
        <span className="journey-scope-card-head"><span className="journey-scope-step">03</span><span role="heading" aria-level={4}>{receiving ? 'Input to LOKI' : 'Passed to LOKI on commit'}</span><ScopeCardArrow /></span>
        <span className="journey-scope-source-counts"><span><b>{scope.counts.tables}</b><span>tables</span></span><span><b>{scope.counts.documents}</b><span>documents</span></span></span>
        <span className="journey-scope-detail">{scope.counts.shared_documents} documents connect multiple tables.</span>
        <span className="journey-scope-card-foot">Browse LOKI inputs <span aria-hidden="true">→</span></span>
      </button>
    </div>
    <div className="journey-scope-summary"><div><span className="journey-scope-summary-label">Selection policy</span><span>{policy(scope.recipe)}</span></div><div className="journey-pair-actions"><button onClick={() => inspect('included')} aria-pressed={open && group === 'included'}><b>{scope.counts.pairs.toLocaleString()}</b> included</button><button onClick={() => inspect('outside')} aria-pressed={open && group === 'outside'}><b>{outside.toLocaleString()}</b> outside scope</button></div></div>
    {children}
    <div className="journey-footnote"><strong>Indexed combinations {scope.indexed_pair_scores === null ? 'unavailable' : `≈ ${scope.indexed_pair_scores.toLocaleString()}`}</strong><span>Work estimate, not an evidence count. Overlapping contexts can change actual scoring work.</span></div>
    {!scope.counts.shared_documents && <p className="journey-notice">No document in this scope connects multiple tables; cross-table join paths may not be possible.</p>}
    {open && <section className="journey-inspector" id="scope-pair-inspector" ref={inspector} tabIndex={-1} aria-label="Scope pair inspector"><header><div><h4>Inspect actual source pairs</h4><small>{scope.id ? 'Saved membership · later draft edits do not change these pairs' : 'Preview membership · commit fixes this selection'}</small></div><button onClick={() => setOpen(false)}>Close inspector</button></header><nav className="journey-tabs" aria-label="Pair membership"><button aria-pressed={group === 'all'} onClick={() => { setGroup('all'); setOffset(0); }}>All profiled · {scope.total_pairs}</button><button aria-pressed={group === 'included'} onClick={() => { setGroup('included'); setOffset(0); }}>Included · {scope.counts.pairs}</button><button aria-pressed={group === 'outside'} onClick={() => { setGroup('outside'); setOffset(0); }}>Outside scope · {outside}</button></nav>
      {loading && <p role="status">Loading exact pair membership…</p>}{error && <p role="alert">{error}</p>}
      {sourcePeek.view}{page && <><div className="journey-pagination"><strong>{page.total.toLocaleString()} {group === 'all' ? 'profiled' : group === 'included' ? 'included' : 'outside-scope'} pairs · Page {Math.floor(page.offset / page.limit) + 1} / {Math.max(1, Math.ceil(page.total / page.limit))}</strong><div><button disabled={loading || !offset} onClick={() => setOffset(offset - 12)}>Previous pairs</button><button disabled={loading || offset + page.limit >= page.total} onClick={() => setOffset(offset + 12)}>Next pairs</button></div></div><div className="journey-table-scroll"><table><thead><tr><th>Source table</th><th>Text document</th><th>Profile similarity</th><th>Source versions</th></tr></thead><tbody>{page.items.map(pair => <tr key={pair.id}><td>{sourcePeek.link({id:pair.table,name:pair.table_name,version:pair.table_version})}</td><td>{sourcePeek.link({id:pair.text,name:pair.document_name,version:pair.document_version})}</td><td>{pair.score.toFixed(3)}</td><td><details><summary>Inspect versions</summary><small>Table: {pair.table_version}<br />Document: {pair.document_version}</small></details></td></tr>)}</tbody></table></div>{!page.total && <p>{group === 'all' ? 'No profiled candidate pairs are available.' : group === 'included' ? 'No pairs selected. This does not fall back to the whole lake.' : 'Every profiled candidate pair is included.'}</p>}<small>{page.items.length} shown on this page · Profile scores are similarities, not probabilities.</small></>}
    </section>}
  </section>;
}
