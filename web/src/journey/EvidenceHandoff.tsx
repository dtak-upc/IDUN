import { useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from '../storage/api';
import { useSourcePeek } from './SourcePeek';
import './journey.css';

type Policy = { min_score?: number; max_score?: number; top_k?: number; source?: string; bridge_cap?: number };
type Link = { id: string; table: string; text: string; table_name: string; text_name: string; row_index: number; row_preview: string; text_preview: string; score: number; start: number; end: number; row_version: string; text_version: string };
type Path = { id: string; left: Link; right: Link; score: number };
type Page = { revision: string; total: number; offset: number; limit: number; items: (Link | Path)[] };
type Receipt = {
  prepared_at: number;
  observations: { scored: number; matching: number; outside_filter: number; after_row_bound: number; row_bound_omitted: number; retention_omitted: number };
  published: { link_entries: number; unique_row_spans: number; shared_span_paths: number; paths_before_cap: number };
  limits: { links_per_row_context: number; links_per_shared_span: number; bridge_cap: number };
};
type Summary = {
  available: boolean; status: string; revision?: string;
  matrix?: { generation: string; cells: number; rows: number; text_units: number; contexts: number };
  scope?: { counts: { pairs: number } };
  sources?: { id: string; name: string }[];
  policy?: Policy; retention_policy?: string; receipt?: Receipt;
  counts?: { links?: number; bridges?: number };
  coverage?: { bridge_group_links_omitted?: number; bridges_omitted?: number; sampled_sources?: number; max_row_combinations_omitted?: number };
};
const number = (n?: number) => n === undefined ? 'Unrecorded' : n.toLocaleString();
function policyText(p?: Policy, sources: Summary['sources'] = []) {
  if (!p) return 'Earlier prepared evidence · filter details unavailable';
  return `Score ${p.min_score}–${p.max_score} · ${p.top_k ? `Top ${p.top_k} per row / context` : 'All matching scores'} · ${p.source ? sources?.find(s => s.id === p.source)?.name || 'Selected source' : 'All scoped sources'}`;
}
function samePolicy(a: Policy, b?: Policy) {
  return !!b && ['min_score', 'max_score', 'top_k', 'source', 'bridge_cap'].every(key => a[key as keyof Policy] === b[key as keyof Policy]);
}
export function EvidenceHandoff({ lakeId, refreshKey, receiving = false, preview, children, onEvidence }: {
  lakeId: string; refreshKey?: string; receiving?: boolean;
  preview?: { policy: Policy; matching?: number; loading: boolean; valid: boolean; generation?: string };
  children?: ReactNode; onEvidence?: (id: string, companion?: string) => void;
}) {
  const [data, setData] = useState<Summary>(), [error, setError] = useState('');
  const [kind, setKind] = useState<'links' | 'paths'>('links'), [open, setOpen] = useState(false), [offset, setOffset] = useState(0);
  const [page, setPage] = useState<Page>(), [pageError, setPageError] = useState(''), [loading, setLoading] = useState(false);
  const inspector = useRef<HTMLElement>(null);
  const sourcePeek = useSourcePeek(lakeId, `${data?.revision}:${kind}:${offset}:${open}`);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setData(undefined); setError(''); setPage(undefined); setOffset(0);
    api<Summary>('/discovery/handoff', { signal: controller.signal }, lakeId)
      .then(r => { if (active) setData(r); }).catch(e => { if (active) setError(String(e)); });
    return () => { active = false; controller.abort(); };
  }, [lakeId, refreshKey]);
  useEffect(() => {
    if (!open || !data?.revision || data.status !== 'prepared') return;
    let active = true; const controller = new AbortController();
    setLoading(true); setPage(undefined); setPageError('');
    api<Page>('/discovery/handoff/inspect', { method: 'POST', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ revision: data.revision, kind, offset, limit: 12 }) }, lakeId)
      .then(r => { if (active) { if (r.revision !== data.revision) throw Error('Evidence changed. Reload the handoff.'); setPage(r); } })
      .catch(e => { if (active) setPageError(String(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [data?.revision, data?.status, open, kind, offset, lakeId]);
  function inspect(next: 'links' | 'paths') {
    setKind(next); setOffset(0); setOpen(true);
    requestAnimationFrame(() => { inspector.current?.focus({ preventScroll: true }); inspector.current?.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  }
  if (error) return <p role="alert">Could not inspect the Discovery handoff: {error}</p>;
  if (!data) return <p role="status">Loading Discovery handoff…</p>;
  if (!data.available) return <p className="journey-notice">Current Discovery input is {data.status}. Prepare current evidence to inspect the handoff.</p>;
  const prepared = data.status === 'prepared', receipt = data.receipt, obs = receipt?.observations;
  const previewCurrent = preview?.generation === data.matrix?.generation;
  const changed = !!preview && (!prepared || !samePolicy(preview.policy, data.policy));
  return <section className="journey-handoff journey-evidence" aria-label="Discovery to Integration handoff">
    <header className="journey-heading"><div><span>DATA JOURNEY · DISCOVERY → INTEGRATION</span><h3>{receiving ? 'Input for your next Integration run' : 'See how scores become evidence'}</h3></div><strong className="journey-status">{prepared ? 'Prepared evidence' : 'Scores only · not prepared'}</strong></header>
    {receiving && <p className="journey-footnote">This is the current next-run input. Selected older runs keep their own saved evidence.</p>}
    <div className="journey-grid">
      <aside className="journey-card"><h4>Received from scoring</h4><b className="journey-number">{number(data.matrix?.cells)}</b><p>contextual score observations</p><small>Overlapping contexts count separately. Similarity scores are not relationship confidence.</small><p>{number(data.matrix?.rows)} source rows · {number(data.matrix?.text_units)} text spans</p><small>{data.scope ? `${number(data.scope.counts.pairs)} committed source pairs` : 'Whole profiled candidate scope'} · {number(data.matrix?.contexts)} scoring contexts</small></aside>
      <section className="journey-card journey-selection"><h4>{preview ? 'Filter preview & prepared output' : 'How the input was prepared'}</h4>
        {preview && <div className="journey-preview"><strong>{changed ? 'Current filter preview' : 'Current filters match prepared policy'}</strong><p>{preview.valid && previewCurrent ? `${preview.loading ? 'Calculating…' : number(preview.matching)} matching observations` : 'Choose valid filters for the current scores'}</p><small>{changed ? 'Prepared evidence stays unchanged until you prepare this filter.' : 'Sorting and browsing pages do not change the prepared input.'}</small></div>}
        {prepared ? <><p className="journey-policy">{policyText(data.policy, data.sources)}</p>{obs ? <ol className="journey-funnel">
          <li><span>Pass score / source / Top-K policy</span><b>{number(obs.matching)}</b><small>{number(obs.outside_filter)} outside this policy</small></li>
          <li><span>After per-row/context bound</span><b>{number(obs.after_row_bound)}</b><small>{number(obs.row_bound_omitted)} omitted · up to {receipt.limits.links_per_row_context} per row/context</small></li>
          <li><span>After evidence retention</span><b>{number(receipt.published.link_entries)}</b><small>{number(obs.retention_omitted)} omitted by retention · {data.retention_policy}</small></li>
        </ol> : <p>Intermediate reductions were not recorded for this earlier output. Prepare evidence again to record them; no rescoring is needed for a saved matrix.</p>}</> : <p>No evidence view has been prepared from these scores yet.</p>}
      </section>
      <aside className="journey-card"><h4>{receiving ? 'Received by Integration' : prepared ? 'Prepared for Integration' : 'Passed forward on preparation'}</h4>
        {prepared ? <><div className="journey-pair-actions"><button onClick={() => inspect('links')}><b>{number(data.counts?.links)}</b> published link entries ↗</button><button onClick={() => inspect('paths')}><b>{number(data.counts?.bridges)}</b> shared-span paths ↗</button></div>
          {receipt && <small>{number(receipt.published.unique_row_spans)} distinct source row/span links; contextual entries can repeat them.</small>}
          <p>Integration constructs and ranks row-pair candidates from link entries, including nearby text evidence.</p><small>The shared-span path cap controls this inspection view. It does not set the Integration candidate budget.</small>
          {!!data.coverage?.bridges_omitted && <p>{number(data.coverage.bridges_omitted)} shared-span paths omitted by cap.</p>}
          {!!data.coverage?.bridge_group_links_omitted && <small>{number(data.coverage.bridge_group_links_omitted)} link entries omitted from shared-span grouping. This is separate from evidence retention.</small>}
        </> : <p>Integration needs a prepared evidence view, not raw score observations.</p>}{children}
      </aside>
    </div>
    {!!data.coverage?.sampled_sources && <p className="journey-notice">{number(data.coverage.sampled_sources)} sources had sampled coverage. Scoring does not imply complete source coverage.</p>}
    {!!data.coverage?.max_row_combinations_omitted && <p className="journey-notice">Configured context selection omitted some row combinations; the maximum recorded omission per context is {number(data.coverage.max_row_combinations_omitted)}.</p>}
    {prepared && open && <section ref={inspector} tabIndex={-1} className="journey-inspector" aria-label="Published evidence inspector"><header><div><h4>Inspect the prepared input</h4><small>Saved evidence revision · filter previews do not change these records</small></div><button onClick={() => setOpen(false)}>Close inspector</button></header><nav className="journey-tabs" aria-label="Published collections"><button aria-pressed={kind === 'links'} onClick={() => inspect('links')}>Atomic link entries</button><button aria-pressed={kind === 'paths'} onClick={() => inspect('paths')}>Shared-span paths</button></nav>
      {loading && <p role="status">Loading published evidence…</p>}{pageError && <p role="alert">{pageError}</p>}
      {sourcePeek.view}{page && <><div className="journey-pagination"><strong>{number(page.total)} {kind === 'links' ? 'link entries' : 'shared-span paths'} · Page {Math.floor(page.offset / page.limit) + 1} / {Math.max(1, Math.ceil(page.total / page.limit))}</strong><div><button disabled={!offset || loading} onClick={() => setOffset(offset - 12)}>Previous evidence</button><button disabled={loading || offset + page.limit >= page.total} onClick={() => setOffset(offset + 12)}>Next evidence</button></div></div><div className="journey-evidence-list">{page.items.map(item => {
        const links = 'left' in item ? [item.left, item.right] : [item];
        return <article key={item.id}><header><b>{links.map(l => `${l.table_name} · row ${l.row_index}`).join(' ↔ ')}</b><span>Similarity {item.score.toFixed(3)}</span></header><div className="journey-records">{links.map(l => <p key={l.id}><strong>{sourcePeek.link({id:l.table,name:l.table_name,version:l.row_version,row:l.row_index})}</strong><br />{l.row_preview}</p>)}</div><small>{sourcePeek.link({id:links[0].text,name:links[0].text_name,version:links[0].text_version,start:links[0].start,end:links[0].end})} · characters {links[0].start}–{links[0].end}</small><blockquote>{links[0].text_preview}</blockquote><footer>{onEvidence && <button onClick={() => onEvidence(links[0].id, links[1]?.id)}>Open full evidence</button>}<details><summary>Source versions</summary>{links.map(l => <small key={l.id}>{l.table_name}: {l.row_version}<br />{l.text_name}: {l.text_version}</small>)}</details></footer></article>;
      })}</div>{!page.total && <p>No {kind === 'links' ? 'link entries' : 'shared-span paths'} in this prepared revision.</p>}<small>{page.items.length} shown on this page · These are candidate evidence, not LLM-verified relationships.</small></>}
    </section>}
  </section>;
}
