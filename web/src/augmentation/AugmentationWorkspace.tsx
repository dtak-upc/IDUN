import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, post, apiUrl, selectedApiLake } from '../storage/api';
import { savedDemo, inferenceUnavailable } from '../mode';
import { DataJourneyButton } from '../journey/DataJourneyButton';
import { AugmentationJourney } from '../journey/AugmentationJourney';
import './workspace.css';

type Column = { index: number; name: string; missing: number; observed: number; kind: string };
type Table = { id: string; name: string; version: string; rows: number; columns: Column[] };
type Assessment = {
  scope: string;
  revision: string;
  output_rows?: number;
  documents: number | null;
  tables: Table[];
  skipped_sources?: { name: string; reason: string }[];
  counts: {
    tables: number;
    rows: number;
    rows_with_gaps: number;
    missing_cells: number;
    observed_cells: number;
    qualitative_gap_cells: number;
    seedless_gap_cells: number;
    malformed_rows: number;
  };
};

type Seed = { value: string; count: number; record_id: string; column: number };
type ColdStart = {
  strategy: string;
  candidates: { source: string; version: string; column: number; seeds: number }[];
};
type Concept = {
  table_name?: string;
  id: string;
  source: string;
  version: string;
  column: number;
  name: string;
  kind: string;
  missing: number;
  seeds: Seed[];
  unique_observed: number;
  omitted_seeds: number;
  cold_start?: ColdStart | null;
};
type SubjectAnchor = {
  source: string;
  version: string;
  candidates: { column: number; concept: string; name: string }[];
  status: 'provisional' | 'ambiguous' | 'unresolved';
};
type Manifest = {
  adapter: string;
  scope: string;
  lake_id: string;
  fingerprint: string;
  status: string;
  counts: {
    concepts: number;
    seeds: number;
    seeded_gap_cells: number;
    seedless_gap_cells: number;
    omitted_seeds: number;
  };
  concepts: Concept[];
  subjects: SubjectAnchor[];
  runtime: {
    config: {
      vector_model: string;
      parser_model: string;
      threshold: number;
      top_k: number;
      seed_limit: number;
      device: string;
      language: string;
    };
  };
};

type Proposal = {
  second_pass?: { status: string; passages: number; skipped: string[] };
  id: string;
  run_id: string;
  target_id: string;
  target: {
    asset_id: string;
    version: string;
    record_id: string;
    source_record?: { columns: string[]; cells: (string | null)[]; origin?: 'integration_snapshot' } | null;
    record_index: number | string;
    column_index: number;
    column_name: string;
    table_name?: string;
  };
  engine?: 'thor' | 'typed_llm' | 'hybrid' | string;
  typed_data?: {
    type: string;
    raw_quoted: string;
    normalized_value: string | number | null;
    unit: string | null;
    temporal_scope: string | null;
    precision: string;
    validation: 'valid' | 'unsupported_quote' | 'out_of_range' | 'unparseable';
  } | null;
  output_references: {
    output_idx: number;
    side: 'left' | 'right';
    candidate?: string;
    relation?: string;
    other_record?: string;
  }[];
  original_model_proposal?: { proposed_value: string | null; engine?: string };
  original_value: string | null;
  null_reason: string;
  proposed_value: string | null;
  concept: { id: string; name: string };
  seed: { value: string; record_id: string; count: number } | null;
  evidence: {
    document: string;
    document_name: string;
    start: number;
    end: number;
    text: string;
    quote: string;
    sentence_start?: number;
    sentence_end?: number;
    evidence_id?: string;
    retrieval?: { method: string; anchor_start: number; anchor_end: number; radius: number; ranking_score?: number };
  } | null;
  scores: {
    semantic: number;
    word_overlap: number;
    character: number;
    combined: number;
  };
  attribution: {
    status: 'attributed' | 'negated' | 'hypothetical' | 'wrong_subject' | 'conflict' | 'unresolved';
    rationale: string;
  };
  conflict_group?: string | null;
  decision: 'proposed' | 'accepted' | 'rejected' | 'conflicting' | 'unresolved';
  decision_history: { decision: string; timestamp: number; reason: string }[];
};

type Telemetry = {
  run_id: string;
  disk_use_bytes: number;
  disk_use_formatted: string;
  total_targets: number;
  targets_with_evidence: number;
  retrieval_coverage: number;
  retrieval_coverage_percent: string;
  total_proposals: number;
  valid_attributed_count: number;
  extraction_quality: number;
  extraction_quality_percent: string;
  accepted_count: number;
  reviewed_count: number;
  acceptance_rate: number;
  acceptance_rate_percent: string;
  unique_evidence_spans: number;
  evidence_compression_ratio: number;
  engines_breakdown: Record<string, number>;
};

type TypedPromptConfig = {
  prompt_id: string;
  name: string;
  system_template: string;
  temperature?: number;
  version?: string;
  updated_at?: number;
};

type AugmentationRun = {
  id: string;
  lake_id: string;
  scope: string;
  source_revision: string;
  base_run_id: string;
  base_revision: string;
  config: any;
  status: string;
  feedback_passes?: number;
  counts: {
    llm_calls?: number;
    processed_targets?: number;
    targets: number;
    proposals: number;
    attributed: number;
    accepted: number;
    rejected: number;
    conflicting: number;
    unresolved: number;
    second_pass_targets?: number;
    second_pass_unavailable?: number;
    retryable_targets?: number;
    telemetry?: Telemetry;
  };
  created: number;
  updated: number;
};

type DerivedRow = {
  candidate?: string;
  relation?: string;
  direction?: string;
  evidence_quote?: string;
  left_record?: string;
  right_record?: string;
  left_columns?: string[];
  right_columns?: string[];
  left_cells?: (string | null)[];
  right_cells?: (string | null)[];
  left_augmentations?: {
    column_index: number;
    column_name: string;
    value: string;
    proposal_id: string;
    original: any;
    engine?: string;
    evidence_quote?: string;
    typed_data?: any;
  }[];
  right_augmentations?: {
    column_index: number;
    column_name: string;
    value: string;
    proposal_id: string;
    original: any;
    engine?: string;
    evidence_quote?: string;
    typed_data?: any;
  }[];
};

type DerivedSourceRow = {
  record_id: string;
  row_index: number;
  cells: (string | null)[];
  augmentations: {
    column_index: number;
    column_name: string;
    value: string;
    original: any;
    proposal_id: string;
    engine?: string;
    evidence_quote?: string;
    typed_data?: any;
  }[];
};

type DerivedSourceTable = {
  table_id: string;
  table_name: string;
  columns: string[];
  rows: DerivedSourceRow[];
  counts: {
    total_rows: number;
    enriched_rows: number;
    enriched_cells: number;
  };
};

type NeighborhoodReport = {
  run_id: string;
  scope: string;
  projection_revision: string;
  affected_rows_count: number;
  candidate_budget_per_row: number;
  counts: {
    affected_rows: number;
    candidate_budget: number;
    baseline_candidate_connections: number;
    enriched_candidate_connections: number;
    added_connections: number;
    old_to_new_connections: number;
    new_to_old_connections: number;
  };
  added_connections: {
    source_record: string;
    target_record: string;
    candidate_text: string;
    direction: string;
  }[];
  notice: string;
};

type DerivedView = {
  augmentation_run_id: string;
  scope?: string;
  base_run_id: string | null;
  counts: {
    base_rows: number;
    enriched_rows: number;
    enriched_cells: number;
    accepted_proposals: number;
    unresolved_cells: number;
    conflicting_cells: number;
  };
  output?: DerivedRow[];
  tables?: Record<string, DerivedSourceTable>;
};

type AugmentationStatus = {
  llm: {
    active: boolean;
    provider: string;
    model: string;
    base_url: string;
  };
  thor: {
    ready: boolean;
    packages: Record<string, string>;
  };
};

function rowLabel(recordId?: string, index?: number | string) {
  const physical = Number(index ?? recordId?.split(':').at(-1));
  return Number.isInteger(physical) && physical > 1 ? `Row ${physical - 1}` : 'Row unavailable';
}

const readiness: Record<string, string> = {
  qualitative: 'Text seeds available',
  typed: 'Numeric / date extraction',
  mixed: 'Mixed types · review',
  identifier: 'Identifier · preserve',
  no_seeds: 'No observed seeds',
};

export function AugmentationWorkspace() {
  const [scope, setScope] = useState('source');
  const [runs, setRuns] = useState<{ id: string; title: string }[]>([]);
  const [run, setRun] = useState('');
  const [stage, setStage] = useState<'assess' | 'prepare' | 'focus' | 'review'>('assess');
  const [result, setResult] = useState<Assessment>();
  const [manifest, setManifest] = useState<Manifest>();
  const [augRun, setAugRun] = useState<AugmentationRun>();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [derivedView, setDerivedView] = useState<DerivedView>();
  const [neighborhoods, setNeighborhoods] = useState<NeighborhoodReport>();
  const [selectedTableId, setSelectedTableId] = useState<string>('');
  const [pastRuns, setPastRuns] = useState<AugmentationRun[]>([]);
  const [selectedRel, setSelectedRel] = useState<string>('all');
  const [enrichedOnly, setEnrichedOnly] = useState<boolean>(false);
  const [derivedSearch, setDerivedSearch] = useState<string>('');
  const [reviewFilter, setReviewFilter] = useState<'all' | 'proposed' | 'attributed' | 'conflicting' | 'rejected' | 'unresolved' | 'accepted'>('all');
  const [viewMode, setViewMode] = useState<'proposals' | 'derived'>('proposals');
  const [reviewTableId, setReviewTableId] = useState<string>('');
  const [reviewColFilter, setReviewColFilter] = useState<string>('all');
  const [selectedProposalIds, setSelectedProposalIds] = useState<Set<string>>(new Set());
  const [inspectingEvidenceProp, setInspectingEvidenceProp] = useState<Proposal | null>(null);
  const [proposalSearch, setProposalSearch] = useState<string>('');

  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [prepBusy, setPrepBusy] = useState(false);
  const [extractBusy, setExtractBusy] = useState(false);
  const [workTable, setWorkTable] = useState('');
  const [workColumns, setWorkColumns] = useState<number[]>([]);
  const [fieldTypes, setFieldTypes] = useState<Record<string, string>>({});
  const [targetLimit, setTargetLimit] = useState(10);
  const [contextLimit, setContextLimit] = useState(3);
  const [nearbyRadius, setNearbyRadius] = useState(1500);
  const [nearbyLimit, setNearbyLimit] = useState(2);
  const [rowOffset, setRowOffset] = useState(0);
  const [proposalOffset, setProposalOffset] = useState(0);
  const [showFullRecord, setShowFullRecord] = useState(false);
  const [proposalTotal, setProposalTotal] = useState(0);
  const reviewRequest = useRef(0);
  const [finalizeBusy, setFinalizeBusy] = useState(false);
  const [editingValue, setEditingValue] = useState<{ id: string; value: string } | null>(null);
  const proposalGrid = useRef<HTMLDivElement>(null);
  const reviewPosition = useRef<{ ids: string[]; top: number; left: number; x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    const position = reviewPosition.current;
    const grid = proposalGrid.current;
    if (!position || !grid) return;
    reviewPosition.current = null;
    grid.scrollTop = position.top; grid.scrollLeft = position.left;
    window.scrollTo(position.x, position.y);
    const rows = Array.from(grid.querySelectorAll<HTMLTableRowElement>('tr[data-proposal-id]'));
    const next = position.ids.map(id => rows.find(row => row.dataset.proposalId === id)).find(Boolean);
    if (next) {
      next.focus({ preventScroll: true });
      next.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }, [proposals]);
  const workReady = Boolean(result?.tables.some(t => t.id === workTable) && workColumns.length);

  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [gapsOnly, setGapsOnly] = useState(true);
  const [engine, setEngine] = useState<'thor' | 'typed_llm' | 'hybrid'>('hybrid');
  const [showPromptModal, setShowPromptModal] = useState(false);
  const [typedPrompt, setTypedPrompt] = useState<TypedPromptConfig | null>(null);
  const [promptBusy, setPromptBusy] = useState(false);
  const [promptSavedMsg, setPromptSavedMsg] = useState('');
  const [augStatus, setAugStatus] = useState<AugmentationStatus | null>(null);
  const request = useRef(0);
  const lakeId = selectedApiLake();
  function rememberContext(nextScope:string,nextRun:string,mode:'preparation'|'extraction') {
    try { localStorage.setItem(`idun_aug_context:${lakeId}`,JSON.stringify({scope:nextScope,run:nextRun,mode})); } catch { /* Server checkpoints remain available. */ }
  }
  async function restorePreparation(nextScope:string,nextRun:string,token:number) {
    if(savedDemo)return;
    setBusy(true);
    try {
      const saved=await api<{assessment:Assessment|null;manifest:Manifest|null;stale:boolean}>(`/augmentation/workspace?scope=${nextScope}&run=${encodeURIComponent(nextRun)}`,undefined,lakeId);
      if(token!==request.current)return;
      setResult(saved.assessment??undefined);setManifest(saved.manifest??undefined);
      setStage(saved.manifest&&saved.assessment?.counts.missing_cells?'focus':saved.assessment?'prepare':'assess');
      if(saved.stale)setError('The saved assessment belongs to changed input data or projection settings. Assess again to refresh it.');
    } catch(e) { if(token===request.current)setError(`Could not restore preparation: ${(e as Error).message}`); }
    finally { if(token===request.current)setBusy(false); }
  }

  useEffect(() => {
    let active = true;
    const initialRequest = request.current;
    if (!savedDemo) {
      api<{ runs: typeof runs }>('/augmentation/runs')
        .then((r) => {
          if (active) setRuns(r.runs);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
      api<AugmentationStatus>('/augmentation/status')
        .then((s) => {
          if (active) setAugStatus(s);
        })
        .catch(() => {});
      api<{ runs: AugmentationRun[] }>('/augmentation/runs/list')
        .then(async (res) => {
          if (!active) return;
          const list = res.runs || [];
          setPastRuns(previous => [...previous, ...list.filter(r => !previous.some(p => p.id === r.id))]);
          if (initialRequest !== request.current) return;
          let context:{scope:string;run:string;mode:string}|undefined;
          try { context=JSON.parse(localStorage.getItem(`idun_aug_context:${lakeId}`)||'null')??undefined; } catch { /* Ignore malformed UI preferences. */ }
          if(context?.mode==='preparation'&&['source','integration'].includes(context.scope)) {
            setScope(context.scope);setRun(context.run||'');
            await restorePreparation(context.scope,context.run||'',initialRequest);
            return;
          }
          const savedAugRunId = localStorage.getItem(`idun_active_aug_run_id:${selectedApiLake()}`);
          const target = (savedAugRunId && list.find((r) => r.id === savedAugRunId)) || (list.length > 0 ? list[0] : null);
          if (target && active) {
            const current = await api<AugmentationRun>(`/augmentation/runs/${target.id}`);
            if (!active || initialRequest !== request.current) return;
            resetRunReview();
            setAugRun(current);
            setScope(target.scope);
            if (target.base_run_id) setRun(target.base_run_id);
            setStage('review');
            await loadProposalsAndViews(target.id, target.scope);
          } else if (active && initialRequest === request.current) {
            await restorePreparation('source','',initialRequest);
          }
        })
        .catch((e) => { if (active && initialRequest === request.current) setError(`Could not restore the saved augmentation run: ${e.message}`); });
    }
    return () => {
      active = false;
      request.current++;
      reviewRequest.current++;
    };
  }, []);

  function resetRunReview() {
    reviewRequest.current++;
    setReviewFilter('all'); setReviewColFilter('all'); setReviewTableId('');
    setProposalSearch(''); setSelectedProposalIds(new Set());
    setInspectingEvidenceProp(null); setEditingValue(null);
    setSelectedTableId(''); setSelectedRel('all'); setEnrichedOnly(false); setDerivedSearch('');
    setViewMode('proposals'); setProposalOffset(0); setProposalTotal(0);
    setProposals([]); setDerivedView(undefined); setNeighborhoods(undefined); setError('');
  }

  async function selectPastRun(selectedId: string) {
    const token = ++request.current;
    const target = pastRuns.find((r) => r.id === selectedId);
    if (!target) return;
    resetRunReview();
    setAugRun(undefined);
    setManifest(undefined); setResult(undefined);
    try {
      const current = await api<AugmentationRun>(`/augmentation/runs/${target.id}`);
      if (token !== request.current) return;
      setAugRun(current);
      localStorage.setItem(`idun_active_aug_run_id:${selectedApiLake()}`, target.id);
      rememberContext(target.scope,target.base_run_id||'','extraction');
    } catch (e) {
      if (token === request.current) setError((e as Error).message);
      return;
    }
    setScope(target.scope);
    setRun(target.base_run_id || '');
    setStage('review');
    await loadProposalsAndViews(target.id, target.scope);
  }

  function change(nextScope: string, nextRun: string) {
    if(nextScope===scope&&nextRun===run&&!augRun)return;
    request.current++;
    reviewRequest.current++;
    setWorkTable(''); setWorkColumns([]);
    setScope(nextScope);
    setRun(nextRun);
    setResult(undefined);
    setManifest(undefined);
    setAugRun(undefined);
    setProposals([]);
    setDerivedView(undefined);
    setNeighborhoods(undefined);
    setSelectedTableId('');
    setSelectedRel('all');
    setEnrichedOnly(false);
    setDerivedSearch('');
    setStage('assess');
    setError('');
    setBusy(false);
    setPrepBusy(false);
    setExtractBusy(false);
    setFeedbackBusy(false);
    rememberContext(nextScope,nextRun,'preparation');
    void restorePreparation(nextScope,nextRun,request.current);
  }

  async function assess() {
    const id = ++request.current;
    setBusy(true);
    setError('');
    setResult(undefined);
    setManifest(undefined);
    setAugRun(undefined); setProposals([]); setProposalTotal(0);
    rememberContext(scope,run,'preparation');
    try {
      const r = await api<Assessment>(
        `/augmentation/assessment?scope=${scope}&run=${encodeURIComponent(run)}`
      );
      if (id === request.current) {
        setResult(r);
        setStage('prepare');
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setBusy(false);
    }
  }

  async function prepareConcepts() {
    const id = ++request.current;
    setPrepBusy(true);
    setError('');
    try {
      const m = await api<Manifest>(
        `/thor/prepare?scope=${scope}&run=${encodeURIComponent(run)}`
      );
      if (id === request.current) {
        setManifest(m);
        setStage(result?.counts.missing_cells?'focus':'prepare');
        rememberContext(scope,run,'preparation');
        requestAnimationFrame(() => document.getElementById(result?.counts.missing_cells?'thor-step-focus':'thor-step-prepare')?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'}));
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setPrepBusy(false);
    }
  }

  async function retryDocumentPass() {
    if (!augRun || extractBusy) return;
    const token = ++request.current;
    const selectedRun = augRun.id;
    setExtractBusy(true); setError('');
    try {
      const updated = await post<AugmentationRun>(`/augmentation/runs/${selectedRun}/document-pass`, {nearby_radius: nearbyRadius, nearby_limit: nearbyLimit});
      if (token !== request.current) return;
      setAugRun(updated);
      setPastRuns(p => p.map(r => r.id === updated.id ? updated : r));
      setError((updated.config?.document_retry?.errors || []).join(' '));
      await loadProposalsAndViews(selectedRun, updated.scope, proposalOffset);
    } catch (e) {
      if (token === request.current) setError((e as Error).message);
    } finally {
      if (token === request.current) setExtractBusy(false);
    }
  }

  async function executeExtraction() {
    if (!workReady || (scope === 'integration' && !run)) return;
    const id = ++request.current;
    setExtractBusy(true);
    setError('');
    try {
      const payload = scope === 'source'
        ? { scope: 'source', engine, prompt_config: typedPrompt }
        : { scope: 'integration', run_id: run, engine, prompt_config: typedPrompt };
      const selection = { table_id: workTable, columns: workColumns, types: fieldTypes, target_limit: targetLimit, contexts_limit: contextLimit, row_offset: rowOffset, nearby_second_pass: false };
      const res = await post<AugmentationRun>('/augmentation/runs/execute', { ...payload, selection });
      if (id === request.current) {
        resetRunReview();
        setAugRun(res);
        if (res.status === 'failed') setError(`Extraction stopped: ${res.config?.error || 'Provider failure'}. Completed targets are preserved in this run.`);
        localStorage.setItem(`idun_active_aug_run_id:${selectedApiLake()}`, res.id);
        rememberContext(scope,run,'extraction');
        setPastRuns((prev) => [res, ...prev.filter((p) => p.id !== res.id)]);
        setStage('review');
        setViewMode('proposals');
        await loadProposalsAndViews(res.id, res.scope);
      }
    } catch (e) {
      if (id === request.current) setError((e as Error).message);
    } finally {
      if (id === request.current) setExtractBusy(false);
    }
  }

  async function loadProposalsAndViews(runId: string, _runScope?: string, offset = 0, includeRecords = showFullRecord) {
    const token = ++reviewRequest.current;
    setDerivedView(undefined); setNeighborhoods(undefined); setProposals([]);
    try {
      const props = await api<{ total: number; proposals: Proposal[] }>(`/augmentation/runs/${runId}/proposals?limit=50&offset=${offset}&include_records=${includeRecords}`);
      if (token !== reviewRequest.current) return;
      setProposals(props.proposals || []);
      setProposalTotal(props.total); setProposalOffset(offset);
    } catch (e) { if (token === reviewRequest.current) setError((e as Error).message); }
  }

  async function openDerived() {
    if (!augRun) return;
    const token = ++reviewRequest.current;
    setViewMode('derived'); setDerivedView(undefined);
    try {
      const table = augRun.config?.selection?.table_id || activeTableId;
      const view = await api<DerivedView>(`/augmentation/runs/${augRun.id}/view${table ? '?table_id='+encodeURIComponent(table) : ''}`);
      if (token !== reviewRequest.current) return;
      if (Array.isArray(view.tables)) {
        view.tables = Object.fromEntries((view.tables as any[]).map(t => [t.id, { ...t, table_id: t.id, table_name: t.name, counts: { total_rows: t.rows.length, enriched_rows: t.enriched_rows, enriched_cells: t.enriched_cells } }]));
      }
      setDerivedView(view);
      if (view.tables) setSelectedTableId(Object.keys(view.tables)[0] || '');
    } catch (e) { if (token === reviewRequest.current) setError((e as Error).message); }
  }

  async function removeRun() {
    if (!augRun || !window.confirm('Delete this augmentation run and its proposals? Original tables and integration runs will be preserved.')) return;
    try {
      const id = augRun.id;
      await post(`/augmentation/runs/${id}/delete`);
      reviewRequest.current++;
      setPastRuns(p => p.filter(r => r.id !== id)); setAugRun(undefined);
      setProposals([]); setDerivedView(undefined); setNeighborhoods(undefined); setStage('assess');
      localStorage.removeItem(`idun_active_aug_run_id:${selectedApiLake()}`);
    } catch (e) { setError((e as Error).message); }
  }

  async function handleFeedbackPass() {
    if (!augRun) return;
    setFeedbackBusy(true);
    setError('');
    try {
      await post(`/augmentation/runs/${augRun.id}/feedback-pass`, {});
      const updatedRun = await api<AugmentationRun>(`/augmentation/runs/${augRun.id}`);
      setAugRun(updatedRun);
      await loadProposalsAndViews(updatedRun.id, updatedRun.scope);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFeedbackBusy(false);
    }
  }

  function nextReviewPosition(affected: Set<string>) {
    const last = displayedTableProposals.reduce((found, p, index) => affected.has(p.id) ? index : found, -1);
    const grid = proposalGrid.current;
    return {
      ids: last < 0 ? [] : displayedTableProposals.slice(last + 1).filter(p => !affected.has(p.id)).map(p => p.id),
      top: grid?.scrollTop || 0, left: grid?.scrollLeft || 0, x: window.scrollX, y: window.scrollY
    };
  }

  async function refreshDecisions(runId: string, generation: number, position: ReturnType<typeof nextReviewPosition>) {
    const [updatedRun, page] = await Promise.all([
      api<AugmentationRun>(`/augmentation/runs/${runId}`),
      api<{ total: number; proposals: Proposal[] }>(`/augmentation/runs/${runId}/proposals?limit=50&offset=${proposalOffset}&include_records=${showFullRecord}`)
    ]);
    if (generation !== reviewRequest.current) return;
    reviewPosition.current = position;
    setAugRun(updatedRun); setProposals(page.proposals || []); setProposalTotal(page.total);
    setPastRuns(previous => previous.map(r => r.id === runId ? updatedRun : r));
    setDerivedView(undefined); setNeighborhoods(undefined);
  }

  async function finalizeReview() {
    if (!augRun) return;
    const generation = reviewRequest.current;
    setFinalizeBusy(true); setError('');
    try {
      const finalized = await post<AugmentationRun>(`/augmentation/runs/${augRun.id}/finalize`);
      if (generation !== reviewRequest.current) return;
      setAugRun(finalized);
      setPastRuns(previous => previous.map(r => r.id === finalized.id ? finalized : r));
      setSelectedProposalIds(new Set());
      await openDerived();
    } catch (e) { if (generation === reviewRequest.current) setError((e as Error).message); }
    finally { setFinalizeBusy(false); }
  }

  async function saveManualValue(accept: boolean) {
    if (!augRun || !editingValue?.value.trim()) return;
    const generation = reviewRequest.current;
    const position = nextReviewPosition(new Set([editingValue.id]));
    if (!accept) position.ids = [editingValue.id];
    setDecisionBusy(editingValue.id); setError('');
    try {
      await post(`/augmentation/proposals/${editingValue.id}/override`, { value: editingValue.value, accept });
      if (generation !== reviewRequest.current) return;
      setEditingValue(null);
      await refreshDecisions(augRun.id, generation, position);
    } catch (e) { if (generation === reviewRequest.current) setError((e as Error).message); }
    finally { setDecisionBusy(null); }
  }

  async function updateDecision(propId: string, decision: 'accepted' | 'rejected' | 'proposed') {
    if (!augRun) return;
    setDecisionBusy(propId);
    const generation = reviewRequest.current;
    const position = nextReviewPosition(new Set([propId]));
    try {
      await post<Proposal>(`/augmentation/proposals/${propId}/decision`, { decision });
      await refreshDecisions(augRun.id, generation, position);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDecisionBusy(null);
    }
  }

  async function handleBulk(params: {
    action: 'accept_attributed' | 'reject_flagged' | 'reset' | 'accept_all' | 'reject_all' | 'accept_table' | 'reject_table' | 'accept_column' | 'reject_column' | 'accept_selected' | 'reject_selected' | 'reset_table';
    table_id?: string;
    column_name?: string;
    proposal_ids?: string[];
  } | 'accept_attributed' | 'reject_flagged' | 'reset') {
    if (!augRun) return;
    setBulkBusy(true);
    const payload = typeof params === 'string' ? { action: params } : params;
    const generation = reviewRequest.current;
    const affected = new Set(displayedTableProposals.filter(p =>
      (!payload.proposal_ids || payload.proposal_ids.includes(p.id)) &&
      (!payload.table_id || payload.table_id === p.target.asset_id) &&
      (!payload.column_name || payload.column_name === p.target.column_name)
    ).map(p => p.id));
    const position = nextReviewPosition(affected);
    try {
      await post<{ updated: number }>(`/augmentation/runs/${augRun.id}/bulk-decision`, payload);
      await refreshDecisions(augRun.id, generation, position);
      setSelectedProposalIds(new Set());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBulkBusy(false);
    }
  }

  const items = (result?.tables || [])
    .flatMap((t) => t.columns.map((c) => ({ table: t, column: c })))
    .filter(
      ({ table, column }) =>
        (!gapsOnly || column.missing > 0) &&
        `${table.name} ${column.name}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort(
      (a, b) =>
        b.column.missing - a.column.missing ||
        a.table.id.localeCompare(b.table.id) ||
        a.column.index - b.column.index
    );

  const conceptItems = (manifest?.concepts || [])
    .filter(
      (c) =>
        (!gapsOnly || c.missing > 0) &&
        `${c.source} ${c.name}`.toLowerCase().includes(query.toLowerCase())
    )
    .sort(
      (a, b) =>
        b.seeds.length - a.seeds.length ||
        b.missing - a.missing ||
        a.name.localeCompare(b.name)
    );

  const proposalsByTable = useMemo(() => {
    const map: Record<string, { table_id: string; table_name: string; proposals: Proposal[] }> = {};
    for (const p of proposals) {
      const tid = p.target.asset_id || 'unassigned';
      const tname = p.target.table_name || derivedView?.tables?.[tid]?.table_name || tid;
      if (!map[tid]) {
        map[tid] = { table_id: tid, table_name: tname, proposals: [] };
      }
      map[tid].proposals.push(p);
    }
    return map;
  }, [proposals, derivedView]);

  const activeTableId = useMemo(() => {
    if (reviewTableId && proposalsByTable[reviewTableId]) {
      return reviewTableId;
    }
    const firstKey = Object.keys(proposalsByTable)[0];
    return firstKey || '';
  }, [reviewTableId, proposalsByTable]);

  const currentTableProposalsGroup = useMemo(() => {
    return proposalsByTable[activeTableId];
  }, [proposalsByTable, activeTableId]);

  const activeTableColumns = useMemo(() => {
    if (!currentTableProposalsGroup) return [];
    const counts: Record<string, { total: number; attributed: number; accepted: number }> = {};
    for (const p of currentTableProposalsGroup.proposals) {
      const col = p.target.column_name;
      if (!counts[col]) counts[col] = { total: 0, attributed: 0, accepted: 0 };
      counts[col].total++;
      if (p.attribution?.status === 'attributed') counts[col].attributed++;
      if (p.decision === 'accepted') counts[col].accepted++;
    }
    return Object.entries(counts).map(([name, stat]) => ({ name, ...stat }));
  }, [currentTableProposalsGroup]);

  const displayedTableProposals = useMemo(() => {
    if (!currentTableProposalsGroup) return [];
    return currentTableProposalsGroup.proposals.filter((p) => {
      // Column filter
      if (reviewColFilter !== 'all' && p.target.column_name !== reviewColFilter) return false;

      // Status filter
      if (reviewFilter === 'accepted' && p.decision !== 'accepted') return false;
      if (reviewFilter === 'rejected' && p.decision !== 'rejected') return false;
      if (reviewFilter === 'conflicting' && p.decision !== 'conflicting') return false;
      if (reviewFilter === 'unresolved' && p.decision !== 'unresolved') return false;
      if (reviewFilter === 'attributed' && p.attribution?.status !== 'attributed') return false;
      if (reviewFilter === 'proposed' && p.decision !== 'proposed') return false;

      // Search filter
      if (proposalSearch.trim()) {
        const q = proposalSearch.toLowerCase();
        const matchRec = rowLabel(p.target.record_id, p.target.record_index).toLowerCase().includes(q);
        const matchCol = (p.target.column_name || '').toLowerCase().includes(q);
        const matchVal = (String(p.proposed_value) || '').toLowerCase().includes(q);
        const matchQuote = (p.evidence?.quote || p.typed_data?.raw_quoted || '').toLowerCase().includes(q);
        if (!matchRec && !matchCol && !matchVal && !matchQuote) return false;
      }

      return true;
    });
  }, [currentTableProposalsGroup, reviewColFilter, reviewFilter, proposalSearch]);

  const filteredProposals = proposals.filter((p) => {
    if (reviewFilter === 'all') return true;
    if (reviewFilter === 'accepted') return p.decision === 'accepted';
    if (reviewFilter === 'rejected') return p.decision === 'rejected';
    if (reviewFilter === 'conflicting') return p.decision === 'conflicting';
    if (reviewFilter === 'unresolved') return p.decision === 'unresolved';
    if (reviewFilter === 'attributed') return p.attribution?.status === 'attributed';
    if (reviewFilter === 'proposed') return p.decision === 'proposed';
    return true;
  });

  const relationshipGroups = useMemo(() => {
    const map: Record<string, DerivedRow[]> = {};
    for (const r of derivedView?.output || []) {
      const rel = r.relation || 'UNSPECIFIED';
      if (!map[rel]) map[rel] = [];
      map[rel].push(r);
    }
    return map;
  }, [derivedView?.output]);

  const totalEnrichedOutputRows = useMemo(() => {
    return (derivedView?.output || []).filter(
      (r) => (r.left_augmentations?.length || 0) > 0 || (r.right_augmentations?.length || 0) > 0
    ).length;
  }, [derivedView?.output]);

  const totalEnrichedOutputCells = useMemo(() => {
    return (derivedView?.output || []).reduce(
      (sum, r) => sum + (r.left_augmentations?.length || 0) + (r.right_augmentations?.length || 0),
      0
    );
  }, [derivedView?.output]);

  return (
    <section className="thor-workspace" aria-label="Augmentation workspace">
      <header className="thor-heading">
        <div className="journey-workspace-heading"><div>
          <span className="thor-kicker">THOR · AUGMENTATION</span>
          <h1>Make room for missing knowledge.</h1>
          <p>
            Find gaps in your source tables or a selected integration run. Ground new values in your
            lake’s text.
          </p>
        </div>{!savedDemo&&<DataJourneyButton stage="Augmentation"><AugmentationJourney lakeId={selectedApiLake()} runId={augRun?.id} updated={augRun?.updated} assessment={result} scope={scope} baseRunId={run} tableName={result?.tables.find(t=>t.id===workTable)?.name} targetLimit={targetLimit}/></DataJourneyButton>}</div>
        <nav className="thor-stage-buttons thor-progress" aria-label="Augmentation workflow stages">
          {([
            ['assess', '01', 'Assess Gaps', Boolean(result), true],
            ['prepare', '02', 'Prepare Seeds', Boolean(manifest), Boolean(result)],
            ['focus', '03', 'Choose & Extract', Boolean(augRun), Boolean(manifest&&result?.counts.missing_cells)],
            ['review', '04', 'Review & Finalize', augRun?.config?.review?.status === 'finalized', Boolean(augRun)],
          ] as const).map(([key, number, label, done, enabled]) => <button key={key}
            className={`thor-stage ${stage === key ? 'thor-stage-active' : ''} ${done ? 'thor-stage-done' : ''}`}
            aria-current={stage === key ? 'step' : undefined} disabled={!enabled || busy || prepBusy || extractBusy}
            onClick={() => { setStage(key); requestAnimationFrame(() => document.getElementById(key === 'prepare' && !manifest ? 'thor-prepare-action' : `thor-step-${key}`)?.scrollIntoView({behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start'})); }}>
            <span className="thor-step-number">{done ? '✓' : number}</span><span>{label}<small>{done ? 'Complete · Inspect' : stage === key ? 'Current Step' : enabled ? 'Ready' : 'Upcoming'}</small></span>
          </button>)}
        </nav>
      </header>

      <div className="thor-scope" role="group" aria-label="Augmentation scope">
        <div className="thor-scope-card" data-active={scope === 'source'}>
        <button aria-pressed={scope === 'source'} onClick={() => change('source', run)}>
          <strong>Before Integration</strong>
          <span>Assess all saved source rows, including rows that have not joined.</span>
        </button>
        {augRun && !savedDemo && <button className="thor-new-run" aria-label="New Before integration run" title="Start a new Before integration run" disabled={extractBusy} onClick={() => { resetRunReview(); change('source', run); }}><span aria-hidden="true">+</span></button>}
        </div>
        <div className="thor-scope-card" data-active={scope === 'integration'}>
        <button aria-pressed={scope === 'integration'} onClick={() => change('integration', run)}>
          <strong>After Integration</strong>
          <span>Assess the source cells represented in one integration output.</span>
        </button>
        {augRun && !savedDemo && <button className="thor-new-run" aria-label="New After integration run" title="Start a new After integration run" disabled={extractBusy} onClick={() => { resetRunReview(); change('integration', run); }}><span aria-hidden="true">+</span></button>}
        </div>
      </div>

      {/* Engine & LLM status indicator */}
      {augStatus && (
        <div className="thor-status-bar" aria-label="Engine readiness">
          <div className="thor-status-item">
            <span className={`thor-dot ${augStatus.thor.ready ? 'dot-ok' : 'dot-off'}`} />
            <span>THOR</span>
            <small>{augStatus.thor.ready ? 'Ready' : 'Unavailable'}</small>
          </div>
          <div className="thor-status-item">
            <span className={`thor-dot ${augStatus.llm.active ? 'dot-ok' : 'dot-off'}`} />
            <span>LLM</span>
            <small>
              {augStatus.llm.provider === 'disabled' || !augStatus.llm.provider
                ? 'Disabled'
                : augStatus.llm.active
                  ? `${augStatus.llm.provider} · ${augStatus.llm.model || '(no model)'}`
                  : `${augStatus.llm.provider} · Offline`}
            </small>
          </div>
          {!augStatus.llm.active && engine !== 'thor' && (
            <div className="thor-status-hint">
              Configure an available LLM provider in Settings before using Typed LLM or Hybrid.
            </div>
          )}
        </div>
      )}

      {/* Augmentation runs history selector */}
      {pastRuns.length > 0 && (
        <div className="thor-past-runs-bar" aria-label="Augmentation run history">
          <div className="thor-past-runs-label">
            <span className="thor-history-icon">📦</span>
            <strong>Augmentation Run:</strong>
          </div>
          <select
            className="thor-past-run-select"
            value={augRun?.id || ''}
            onChange={(e) => selectPastRun(e.target.value)}
          >
            <option value="" disabled>Choose a saved augmentation run</option>
            {pastRuns.map((r, idx) => (
              <option key={r.id} value={r.id}>
                {r.scope === 'source' ? 'Pre-Integration (Source)' : 'Post-Integration (Relational)'} · #{r.id.slice(0, 10)} · {r.counts.attributed} attributed, {r.counts.accepted} accepted {idx === 0 ? '(Latest)' : ''}
              </option>
            ))}
          </select>
          {augRun && (
            <span className="thor-active-run-pill">
              Active: <code>{augRun.id.slice(0, 10)}</code> <button className="thor-sm-btn" disabled={savedDemo || extractBusy} onClick={removeRun}>Delete run</button>
            </span>
          )}
        </div>
      )}

      <div className="thor-controls">
        {scope === 'integration' && (
          <label>
            Integration run{' '}
            <select aria-label="Integration run" value={run} onChange={(e) => change(scope, e.target.value)}>
              <option value="">Choose a run</option>
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
          </label>
        )}
        <button
          className={!result && stage !== 'review' ? 'thor-primary' : 'thor-secondary-btn'}
          onClick={assess}
          disabled={busy || savedDemo || (scope === 'integration' && !run)}
        >
          {busy ? 'Assessing saved rows…' : '01 / Assess missing values'}
        </button>
        <button
          id="thor-prepare-action"
          className={result && !manifest ? 'thor-primary' : 'thor-secondary-btn'}
          onClick={prepareConcepts}
          disabled={!result || busy || extractBusy || prepBusy || inferenceUnavailable || (scope === 'integration' && !run)}
          title="Derive concepts, bounded seed instances, and subject anchors via THOR contracts"
        >
          {prepBusy ? 'Preparing concepts & seeds…' : '02 / Prepare concepts & seeds (THOR)'}
        </button>
      </div>
      {/* Stage 01: Assess gaps */}
      {result && (
        <section id="thor-step-assess" className="thor-completed-step">
          <h3><span className="thor-done">✓</span> 01 / Assessment complete</h3>
          <div className="thor-metrics" aria-label="Assessment summary">
            {[
              [result.counts.rows, 'Unique source rows'],
              [result.counts.missing_cells, 'Missing cells'],
              [result.counts.qualitative_gap_cells, 'Gaps in text-seeded columns'],
              [result.counts.seedless_gap_cells, 'Gaps in columns without observed seeds'],
            ].map(([val, label]) => (
              <div key={label}>
                <strong>{val.toLocaleString()}</strong>
                <span>{label}</span>
              </div>
            ))}
          </div>

          <details className="thor-step-details">
            <summary>Inspect assessment results · tables and missing fields</summary>
          <div className="thor-filter">
            <input
              type="search"
              aria-label="Filter tables and columns"
              placeholder="Search table or column…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={gapsOnly}
                onChange={(e) => setGapsOnly(e.target.checked)}
              />
              Show columns with missing values only
            </label>
            <span>
              {items.length} of {result.tables.reduce((acc, t) => acc + t.columns.length, 0)} columns
            </span>
          </div>

          <div className="thor-grid" role="region" aria-label="Missing-value audit" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Table</th>
                  <th scope="col">Column</th>
                  <th scope="col">Gaps</th>
                  <th scope="col">Observed</th>
                  <th scope="col">Readiness</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ table, column }) => {
                  const pct = table.rows ? Math.round((column.missing / table.rows) * 100) : 0;
                  return (
                    <tr key={`${table.id}:${table.version}:${column.index}`}>
                      <th scope="row">
                        {table.name}
                        <small>
                          {table.id} · v{table.version}
                        </small>
                      </th>
                      <td>
                        <strong>{column.name}</strong>
                      </td>
                      <td>
                        <progress value={column.missing} max={table.rows || 1} />
                        {column.missing.toLocaleString()} ({pct}%)
                      </td>
                      <td>{column.observed.toLocaleString()}</td>
                      <td className={`thor-kind ${column.kind === 'qualitative' ? 'thor-qualitative' : ''}`}>
                        {readiness[column.kind] || column.kind}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!items.length && <p className="thor-empty">No columns match this filter.</p>}
          </div>

          <p className="thor-note">
            Gap counts follow the lake projection policy. Literal NULL and NA are preserved as text
            when escaped.
          </p>
          </details>
        </section>
      )}

      {/* Stage 02: Prepare concepts & seeds */}
      {manifest && (
        <section id="thor-step-prepare" className="thor-completed-step">
          <h3><span className="thor-done">✓</span> 02 / Concepts & seeds prepared</h3>
          <p>{manifest.counts.concepts} concepts · {manifest.counts.seeds} observed seeds. {result?.counts.missing_cells===0?'No missing values in this assessed scope. Assessment and preparation are saved; no extraction is needed.':'Continue below to choose the fields to enrich.'}</p>
          <details className="thor-step-details"><summary>Inspect prepared concepts and seeds</summary>
        <div className="thor-prepare-section">
          <div className="thor-manifest-bar">
            <div>
              <strong>Runtime Manifest:</strong> <code>{manifest.fingerprint.slice(0, 16)}…</code> ·{' '}
              <span>Adapter: {manifest.adapter}</span> ·{' '}
              <span>Model: {manifest.runtime.config.vector_model}</span>
            </div>
            <div className="thor-status-tag status-prepared">
              Prepared ({manifest.counts.concepts} concepts · {manifest.counts.seeds} seeds)
            </div>
          </div>

          <div className="thor-subjects-panel">
            <h3>Subject Anchors (1-to-1 Qualitative Candidates)</h3>
            <p className="thor-note">
              Subject identification follows source profile statistics. Only non-empty, fully unique
              qualitative columns are provisionally assigned. Ambiguous or multi-candidate sources stay
              unresolved until verified.
            </p>
            <div className="thor-subject-cards">
              {manifest.subjects.map((s) => (
                <div key={`${s.source}:${s.version}`} className="thor-subject-card">
                  <div>
                    <strong>Source {s.source}</strong> (v{s.version})
                  </div>
                  <div>
                    Status:{' '}
                    <span className={`thor-badge status-${s.status}`}>
                      {s.status.toUpperCase()}
                    </span>
                  </div>
                  <div className="thor-subject-candidates">
                    {s.candidates.length ? (
                      s.candidates.map((c) => (
                        <code key={c.column} title={`Concept ${c.concept}`}>
                          {c.name}
                        </code>
                      ))
                    ) : (
                      <em>No unambiguous unique qualitative anchor</em>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="thor-filter">
            <input
              type="search"
              aria-label="Filter prepared concepts"
              placeholder="Search concepts and seeds…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label>
              <input
                type="checkbox"
                checked={gapsOnly}
                onChange={(e) => setGapsOnly(e.target.checked)}
              />
              Show concepts with gaps only
            </label>
            <span>{conceptItems.length} concepts</span>
          </div>

          <div className="thor-grid" role="region" aria-label="Prepared concepts" tabIndex={0}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Concept / Column</th>
                  <th scope="col">Source Table</th>
                  <th scope="col">Gaps</th>
                  <th scope="col">Seed Instances (Ranked)</th>
                  <th scope="col">Classification</th>
                </tr>
              </thead>
              <tbody>
                {conceptItems.map((c) => {
                  const subject = manifest.subjects.find((s) => s.source === c.source);
                  const isAnchor = subject?.candidates.some((cand) => cand.column === c.column);
                  return (
                    <tr key={c.id}>
                      <th scope="row">
                        <strong>{c.name}</strong>
                        <small>Concept {c.id.slice(0, 10)}…</small>
                      </th>
                      <td>
                        {c.table_name || result?.tables.find(t => t.id === c.source)?.name || 'Unavailable source table'} <small>col #{c.column + 1}</small>
                      </td>
                      <td>{c.missing.toLocaleString()}</td>
                      <td>
                        {c.seeds.length ? (
                          <div className="thor-seed-list">
                            <span className="thor-seed-count">
                              {c.seeds.length} seeds{' '}
                              {c.omitted_seeds > 0 && (
                                <small>({c.omitted_seeds} omitted beyond limit)</small>
                              )}
                            </span>
                            <span className="thor-seed-samples">
                              {c.seeds
                                .slice(0, 3)
                                .map((s) => `${s.value} (${s.count})`)
                                .join(', ')}
                              {c.seeds.length > 3 && ', …'}
                            </span>
                          </div>
                        ) : (
                          <em>No seeds observed</em>
                        )}
                      </td>
                      <td>
                        {isAnchor ? (
                          <span className="thor-badge badge-anchor">Subject Anchor</span>
                        ) : c.cold_start?.strategy === 'candidate_equivalent_found' ? (
                          <span
                            className="thor-badge badge-cold-start"
                            title={`Found ${c.cold_start.candidates.length} candidate equivalent sources in the lake. Never auto-pooled without validation.`}
                          >
                            Candidate match in lake
                          </span>
                        ) : c.kind === 'no_seeds' ? (
                          <span className="thor-badge badge-unresolved">Cold-start unresolved</span>
                        ) : (
                          <span className="thor-badge badge-normal">Attribute concept</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!conceptItems.length && <p className="thor-empty">No concepts match this filter.</p>}
          </div>
          <p className="thor-note">
            Concepts and seeds are immutable snapshots keyed by fingerprint.
          </p>
        </div>
          </details>
        </section>
      )}

      <div className="thor-controls">
        {manifest && result?.counts.missing_cells!==0 && <>
      <section id="thor-step-focus" className="thor-selection" aria-label="Choose augmentation scope">
        <h3>03 / Enrich a focused part of your lake</h3>
        <p>Concepts are prepared. Choose a table, select fields and check their types, then extract a small batch.</p>
        <label>Table <select value={workTable} disabled={extractBusy} onChange={e => { setWorkTable(e.target.value); setWorkColumns([]); setFieldTypes({}); setRowOffset(0); }}>
          <option value="">{result ? 'Choose a table with missing values' : 'Assess missing values first'}</option>
          {result?.tables.filter(t => t.columns.some(c => c.missing > 0)).map(t => <option key={t.id} value={t.id}>{t.name} · {t.columns.reduce((n,c) => n+c.missing, 0)} missing cells</option>)}
        </select></label>
        <div className="thor-field-choices">
          {result?.tables.find(t => t.id === workTable)?.columns.filter(c => c.missing > 0 && c.kind !== 'identifier').map(c => <div key={c.index}>
            <label><input type="checkbox" disabled={extractBusy} checked={workColumns.includes(c.index)} onChange={e => { setWorkColumns(p => e.target.checked ? [...p,c.index] : p.filter(i => i !== c.index)); setFieldTypes(p => ({...p, [c.index]: p[c.index] || (c.kind === 'typed' ? 'numeric' : 'string')})); }} /> {c.name} <small>{c.missing} missing</small></label>
            <select aria-label={`Expected type for ${c.name}`} value={fieldTypes[c.index] || (c.kind === 'typed' ? 'numeric' : 'string')} disabled={extractBusy} onChange={e => setFieldTypes(p => ({...p,[c.index]:e.target.value}))}>
              <option value="string">Text</option><option value="numeric">Number</option><option value="date">Date</option><option value="unit_quantity">Quantity with unit</option>
            </select>
          </div>)}
        </div>
        <div className="thor-batch-controls">
          <label>Missing cells per batch <input type="number" min={1} max={100} value={targetLimit} onChange={e => setTargetLimit(Math.max(1,Math.min(100,Number(e.target.value)||1)))} /></label>
          <label>Passages per cell <input type="number" min={1} max={10} value={contextLimit} onChange={e => setContextLimit(Math.max(1,Math.min(10,Number(e.target.value)||1)))} /></label>
          <label>Skip first data rows <input type="number" min={0} value={rowOffset} onChange={e => setRowOffset(Math.max(0,Number(e.target.value)||0))} /></label>
        </div>
        <small>{engine === 'thor' ? 'No LLM requests.' : `Up to ${targetLimit * contextLimit} LLM requests in this batch.`} Review results before requesting a document second pass.</small>
        {extractBusy && <p role="status">Processing the selected batch. Provider response times depend on the model and the timeout in Settings.</p>}
        <div className="thor-extraction-actions">
        <div className="thor-engine-selector" role="group" aria-label="Extraction engine selector">
          <label htmlFor="thor-engine-select">Engine:</label>
          <select
            id="thor-engine-select"
            value={engine}
            onChange={(e) => setEngine(e.target.value as any)}
          >
            <option value="hybrid">Hybrid (THOR seeds + Typed LLM)</option>
            <option value="thor">THOR (Faithful phrase matcher)</option>
            <option value="typed_llm">Typed LLM (Text, numeric, date, unit)</option>
          </select>
          <button
            type="button"
            className="thor-sm-btn thor-prompt-btn"
            onClick={async () => {
              setShowPromptModal(true);
              try {
                const p = await api<TypedPromptConfig>('/augmentation/prompts/typed');
                setTypedPrompt(p);
              } catch {
                // local fallback if offline
              }
            }}
            title="Configure generic typed extraction prompt template for numeric, dates, and units"
          >
            ⚙ Typed Prompt
          </button>
        </div>
        {scope === 'source' ? (
          <button
            className="thor-accent-btn"
            onClick={executeExtraction}
            disabled={extractBusy || inferenceUnavailable || !workReady}
            title="Execute extraction on unjoined source rows using grounded evidence"
          >
            {extractBusy
              ? 'Extracting…'
              : `Extract pre-integration (${engine === 'hybrid' ? 'Hybrid' : engine === 'thor' ? 'THOR' : 'Typed LLM'})`}
          </button>
        ) : (
          <button
            className="thor-accent-btn"
            onClick={executeExtraction}
            disabled={extractBusy || inferenceUnavailable || !run || !workReady}
            title="Execute extraction on supported evidence contexts and review attribute attribution"
          >
            {extractBusy
              ? 'Extracting…'
              : `Extract post-integration (${engine === 'hybrid' ? 'Hybrid' : engine === 'thor' ? 'THOR' : 'Typed LLM'})`}
          </button>
        )}
        </div>
      </section>
        </>}
        <span>Immutable preparation · Original sources and runs stay intact</span>
      </div>

      {augRun && viewMode === 'proposals' && proposalTotal > 0 && <div className="thor-batch-controls" aria-label="Proposal pages">
        <span>Proposals {proposalOffset+1}–{Math.min(proposalOffset+50,proposalTotal)} of {proposalTotal}. Table and field filters apply to this page.</span>
        <button disabled={proposalOffset === 0} onClick={() => loadProposalsAndViews(augRun.id, augRun.scope, Math.max(0,proposalOffset-50))}>Previous</button>
        <button disabled={proposalOffset+50 >= proposalTotal} onClick={() => loadProposalsAndViews(augRun.id, augRun.scope, proposalOffset+50)}>Next</button>
      </div>}
      {error && (
        <p role="alert" className="thor-error">
          {error}
        </p>
      )}

      {!result && !manifest && !augRun && !busy && !prepBusy && !extractBusy && (
        <div className="thor-intro">
          <h2>Start with what is actually missing</h2>
          <p>
            THOR uses observed values as seeds for finding related phrases in text. This first step
            identifies gaps and separates fields with text seeds from fields that need a different
            extraction strategy.
          </p>
          <p>
            Extraction and proposal review follow this assessment stage. A seed is a starting
            point, not evidence that a missing value can be recovered.
          </p>
        </div>
      )}

      {/* Stage 03: Post-Integration Review & Derived View */}
      {augRun && (
        <div id="thor-step-review" className="thor-review-section">
          <h3>04 / Review & finalize</h3>
          {/* Review Stats */}
          <div className="thor-review-stats" aria-label="Augmentation extraction metrics">
            <div className="thor-stat-box">
              <strong>{augRun.counts.targets}</strong>
              <span>Missing Targets</span>
            </div>
            <div className="thor-stat-box">
              <strong>{augRun.counts.proposals}</strong>
              <span>Extracted Proposals</span>
            </div>
            <div className="thor-stat-box">
              <strong>{augRun.counts.attributed}</strong>
              <span>Attributed Mentions</span>
            </div>
            <div className="thor-stat-box stat-accepted">
              <strong>{augRun.counts.accepted}</strong>
              <span>Accepted Proposals</span>
            </div>
            <div className="thor-stat-box stat-rejected">
              <strong>{augRun.counts.rejected}</strong>
              <span>Rejected / Flagged</span>
            </div>
            <div className="thor-stat-box stat-conflicting">
              <strong>{augRun.counts.conflicting}</strong>
              <span>Conflicting Cells</span>
            </div>
            <div className="thor-stat-box">
              <strong>{augRun.counts.unresolved}</strong>
              <span>Unresolved / Cold-start</span>
            </div>
          </div>

          <section className="thor-document-retry" aria-label="Retry unresolved values">
            <button className={(augRun.counts.retryable_targets ?? augRun.counts.unresolved) > 0 ? 'thor-accent-btn' : 'thor-secondary-btn'}
              disabled={inferenceUnavailable || extractBusy || bulkBusy || Boolean(decisionBusy) || Boolean(editingValue) || !(augRun.counts.retryable_targets ?? augRun.counts.unresolved)}
              onClick={retryDocumentPass}>
              {extractBusy ? 'Searching linked documents…' : 'THOR second pass in linked documents'}
            </button>
            <p>{(augRun.counts.retryable_targets ?? augRun.counts.unresolved) > 0
              ? `${augRun.counts.retryable_targets ?? augRun.counts.unresolved} unresolved None cells in this run. Retry up to 100 using nearby document text; accepted and rejected proposals are preserved.`
              : 'No unresolved None values in this run. A second pass is not needed.'}</p>
            {(augRun.counts.retryable_targets ?? augRun.counts.unresolved) > 0 && <div className="thor-batch-controls">
              <label>Nearby characters on each side <input type="number" min={200} max={5000} value={nearbyRadius} disabled={extractBusy} onChange={e => setNearbyRadius(Math.max(200,Math.min(5000,Number(e.target.value)||200)))} /></label>
              <label>Extra passages per unresolved cell <input type="number" min={1} max={5} value={nearbyLimit} disabled={extractBusy} onChange={e => setNearbyLimit(Math.max(1,Math.min(5,Number(e.target.value)||1)))} /></label>
              <small>Uses this run's engine and prompt with the current provider in Settings. Requires THOR language models.</small>
            </div>}
            {augRun.config?.document_retry && <p role="status">Last second pass: {augRun.config.document_retry.retried} cells retried · {augRun.config.document_retry.unavailable} unavailable.</p>}
          </section>
          {augRun.counts.second_pass_targets !== undefined && <p>Document second pass: {augRun.counts.second_pass_targets} cells retried · {augRun.counts.second_pass_unavailable ?? 0} unavailable. Details are recorded with each proposal.</p>}
          {augRun.counts.telemetry && (
            <div className="thor-telemetry-banner" aria-label="Runtime telemetry and evidence compression">
              <div className="telemetry-header">
                <h4>Runtime Telemetry & Performance</h4>
                <div className="telemetry-engines">
                  {Object.entries(augRun.counts.telemetry.engines_breakdown || {}).map(([eng, cnt]) => (
                    <span key={eng} className={`engine-count-badge engine-${eng}`}>
                      {eng === 'typed_llm' ? 'Typed LLM' : 'THOR'}: <strong>{cnt}</strong>
                    </span>
                  ))}
                </div>
              </div>
              <div className="thor-telemetry-grid">
                <div className="telemetry-item">
                  <strong>{augRun.counts.telemetry.disk_use_formatted}</strong>
                  <span>Disk Footprint</span>
                </div>
                <div className="telemetry-item">
                  <strong>{augRun.counts.telemetry.retrieval_coverage_percent}</strong>
                  <span>Retrieval Coverage</span>
                </div>
                <div className="telemetry-item">
                  <strong>{augRun.counts.telemetry.extraction_quality_percent}</strong>
                  <span>Extraction Quality</span>
                </div>
                <div className="telemetry-item">
                  <strong>{augRun.counts.telemetry.acceptance_rate_percent}</strong>
                  <span>Proposal Acceptance</span>
                </div>
                <div className="telemetry-item">
                  <strong>{augRun.counts.telemetry.evidence_compression_ratio}x</strong>
                  <span>Evidence Compression</span>
                </div>
              </div>
            </div>
          )}

          <p role="status">{augRun.status} · {augRun.counts.processed_targets ?? augRun.counts.targets}/{augRun.counts.targets} cells processed · {augRun.counts.llm_calls ?? 'Not recorded'} LLM requests{augRun.config?.error ? ` · ${augRun.config.error}` : ''}</p>
          <div className="thor-finalize-review">
            <div><strong>{augRun.config?.review?.status === 'finalized' ? 'Review finalized' : augRun.config?.review?.status === 'changed' ? 'Decisions changed — finalize again' : 'Finish this review'}</strong>
              <p>Only the {augRun.counts.accepted} accepted values will be included. Rejected and undecided proposals stay excluded. Checked rows must be accepted first.</p>
            </div>
            {!savedDemo && <button className="thor-primary" onClick={finalizeReview} disabled={finalizeBusy || bulkBusy || Boolean(decisionBusy) || feedbackBusy || Boolean(editingValue) || augRun.config?.review?.status === 'finalized'}>
              {finalizeBusy ? 'Finalizing…' : 'Finalize review'}
            </button>}
          </div>
          {/* Toolbar: View mode + Bulk actions */}
          <div className="thor-review-toolbar">
            <div className="thor-view-toggle">
              <button
                className={viewMode === 'proposals' ? 'active' : ''}
                onClick={() => setViewMode('proposals')}
              >
                Review Proposals ({proposalTotal})
              </button>
              <button
                className={viewMode === 'derived' ? 'active' : ''}
                onClick={openDerived}
              >
                {augRun.scope === 'source'
                  ? `Enriched Source Tables (${derivedView?.counts.enriched_cells || 0} filled)`
                  : `Enriched Relational Tables (${derivedView?.counts.enriched_cells || 0} filled)`}
              </button>
            </div>

            {viewMode === 'proposals' ? (
              <div className="thor-bulk-actions">
                <button
                  className="thor-sm-btn thor-sm-btn-primary"
                  onClick={() => handleBulk('accept_attributed')}
                  disabled={bulkBusy || finalizeBusy}
                  title="Accept remaining attributed proposals; preserve rejected decisions and unresolved conflicts"
                >
                  Accept remaining attributed
                </button>
                <button
                  className="thor-sm-btn"
                  onClick={() => handleBulk('reject_flagged')}
                  disabled={bulkBusy || finalizeBusy}
                  title="Reject all proposals flagged for negation, hypothetical, or wrong subject"
                >
                  Reject flagged
                </button>
                <button
                  className="thor-sm-btn"
                  onClick={() => handleBulk('reset')}
                  disabled={bulkBusy || finalizeBusy}
                  title="Reset decisions to initial proposed state"
                >
                  Reset all
                </button>
                <button
                  className="thor-sm-btn thor-sm-btn-accent"
                  onClick={handleFeedbackPass}
                  disabled={inferenceUnavailable || feedbackBusy || (augRun.feedback_passes ?? 0) >= 1}
                  title={
                    (augRun.feedback_passes ?? 0) >= 1
                      ? 'Bounded feedback pass limit reached (1/1 max per run)'
                      : 'Run one bounded feedback pass to re-evaluate unresolved targets with expanded retrieval'
                  }
                >
                  {feedbackBusy
                    ? 'Running feedback pass…'
                    : (augRun.feedback_passes ?? 0) >= 1
                    ? 'Feedback pass completed (1/1)'
                    : 'Run bounded feedback pass (0/1)'}
                </button>
              </div>
            ) : (
              <div className="thor-bulk-actions">
                {augRun.scope === 'source' ? (
                  <>
                    <a
                      href={apiUrl(
                        `/augmentation/runs/${augRun.id}/export?format=csv${
                          selectedTableId ? `&table_id=${selectedTableId}` : ''
                        }`
                      )}
                      download={`idun-enriched-source-${selectedTableId || 'all'}-${augRun.id}.csv`}
                      className="thor-sm-btn thor-sm-btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Export Enriched CSV
                    </a>
                    <a
                      href={apiUrl(`/augmentation/runs/${augRun.id}/export?format=json`)}
                      download={`idun-enriched-source-${augRun.id}.json`}
                      className="thor-sm-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      Export JSON
                    </a>
                  </>
                ) : (
                  <>
                    <a
                      href={apiUrl(`/augmentation/runs/${augRun.id}/export?format=csv`)}
                      download={`idun-augmented-${augRun.id}.csv`}
                      className="thor-sm-btn thor-sm-btn-primary"
                      style={{ textDecoration: 'none' }}
                    >
                      Export Enriched CSV
                    </a>
                    <a
                      href={apiUrl(`/augmentation/runs/${augRun.id}/export?format=json`)}
                      download={`idun-augmented-${augRun.id}.json`}
                      className="thor-sm-btn"
                      style={{ textDecoration: 'none' }}
                    >
                      Export JSON
                    </a>
                  </>
                )}
              </div>
            )}
          </div>

          {viewMode === 'proposals' ? (
            <div className="thor-table-proposals-workspace">
              {/* Table-wise Navigation Tabs */}
              <div className="thor-tabs-nav-bar">
                <div className="thor-rel-tabs" role="tablist" aria-label="Table proposal navigation">
                  {Object.entries(proposalsByTable).map(([tid, tgroup]) => {
                    const isSelected = activeTableId === tid;
                    const tProps = tgroup.proposals;
                    const acceptedCount = tProps.filter((p) => p.decision === 'accepted').length;
                    const attributedCount = tProps.filter((p) => p.attribution?.status === 'attributed').length;
                    return (
                      <button
                        key={tid}
                        role="tab"
                        aria-selected={isSelected}
                        className={`thor-rel-tab ${isSelected ? 'active' : ''}`}
                        onClick={() => {
                          setReviewTableId(tid);
                          setReviewColFilter('all');
                          setSelectedProposalIds(new Set());
                        }}
                      >
                        <span className="thor-table-tab-name">{tgroup.table_name}</span>
                        <span className="thor-tab-count">{tProps.length} Proposals</span>
                        {attributedCount > 0 && (
                          <span className="thor-tab-enriched-badge">✨ {attributedCount}</span>
                        )}
                        {acceptedCount > 0 && (
                          <span className="thor-tab-accepted-badge">✓ {acceptedCount}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Table Review Toolbar: Status Filters, Search, Table-Level Batch */}
              <div className="thor-table-review-toolbar">
                <div className="thor-table-toolbar-left">
                  <div className="thor-filter-chips" style={{ marginBottom: 0 }}>
                    {[
                      ['all', `All (${currentTableProposalsGroup?.proposals.length || 0})`],
                      ['attributed', `Attributed (${currentTableProposalsGroup?.proposals.filter(p => p.attribution?.status === 'attributed').length || 0})`],
                      ['conflicting', 'Conflicting'],
                      ['rejected', 'Rejected'],
                      ['unresolved', 'Unresolved'],
                      ['accepted', `Accepted (${currentTableProposalsGroup?.proposals.filter(p => p.decision === 'accepted').length || 0})`],
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        role="tab"
                        aria-selected={reviewFilter === key}
                        className={`thor-chip ${reviewFilter === key ? 'active' : ''}`}
                        onClick={() => setReviewFilter(key as typeof reviewFilter)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div className="thor-search-wrap" style={{ minWidth: '220px' }}>
                    <input
                      type="text"
                      placeholder={`Filter ${currentTableProposalsGroup?.table_name || 'table'} proposals...`}
                      value={proposalSearch}
                      onChange={(e) => setProposalSearch(e.target.value)}
                      className="thor-search-input"
                    />
                    {proposalSearch && (
                      <button className="thor-search-clear" onClick={() => setProposalSearch('')}>✕</button>
                    )}
                  </div>
                </div>

                <div className="thor-table-toolbar-right">
                  <button
                    className="thor-sm-btn thor-sm-btn-primary"
                    onClick={() => handleBulk({ action: 'accept_table', table_id: activeTableId })}
                    disabled={bulkBusy || !currentTableProposalsGroup?.proposals.length}
                    title="Accept eligible undecided proposals; preserve accepted and rejected decisions"
                  >
                    ✓ Accept remaining in Table
                  </button>
                  <button
                    className="thor-sm-btn"
                    onClick={() => handleBulk({ action: 'reject_table', table_id: activeTableId })}
                    disabled={bulkBusy || !currentTableProposalsGroup?.proposals.length}
                    title="Reject undecided proposals; preserve accepted decisions"
                  >
                    ✕ Reject remaining in Table
                  </button>
                  <button
                    className="thor-sm-btn"
                    onClick={() => handleBulk({ action: 'reset_table', table_id: activeTableId })}
                    disabled={bulkBusy || !currentTableProposalsGroup?.proposals.length}
                    title={`Reset all proposals for table ${currentTableProposalsGroup?.table_name}`}
                  >
                    Reset Table
                  </button>
                </div>
              </div>

              {/* Column-Level Quick Controls */}
              {activeTableColumns.length > 0 && (
                <div className="thor-col-actions-bar" aria-label="Columns in table">
                  <span className="thor-col-bar-label">Columns:</span>
                  <button
                    className={`thor-col-pill ${reviewColFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setReviewColFilter('all')}
                  >
                    All ({currentTableProposalsGroup?.proposals.length || 0})
                  </button>
                  {activeTableColumns.map((col) => (
                    <div key={col.name} className={`thor-col-pill-group ${reviewColFilter === col.name ? 'active' : ''}`}>
                      <button
                        className="thor-col-pill-select"
                        onClick={() => setReviewColFilter(col.name)}
                        title={`Filter to column '${col.name}'`}
                      >
                        <strong>{col.name}</strong>
                        <span className="col-pill-count">{col.total}</span>
                        {col.accepted > 0 && <span className="col-pill-accepted">✓{col.accepted}</span>}
                      </button>
                      <button
                        className="thor-col-quick-accept"
                        onClick={() => handleBulk({ action: 'accept_column', table_id: activeTableId, column_name: col.name })}
                        disabled={bulkBusy || col.accepted === col.total}
                        title={`Accept eligible undecided proposals for '${col.name}'; preserve rejected decisions`}
                      >
                        ✓ Accept
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Cell Selection Toolbar (when >= 1 row is checked) */}
              {selectedProposalIds.size > 0 && (
                <div className="thor-selection-toolbar" role="alert">
                  <span>
                    <strong>{selectedProposalIds.size}</strong> proposals selected in {currentTableProposalsGroup?.table_name}
                  </span>
                  <div className="thor-selection-actions">
                    <button
                      className="thor-sm-btn thor-sm-btn-primary"
                      onClick={() => handleBulk({ action: 'accept_selected', proposal_ids: Array.from(selectedProposalIds) })}
                      disabled={bulkBusy || finalizeBusy}
                    >
                      ✓ Accept Selected ({selectedProposalIds.size})
                    </button>
                    <button
                      className="thor-sm-btn btn-danger"
                      onClick={() => handleBulk({ action: 'reject_selected', proposal_ids: Array.from(selectedProposalIds) })}
                      disabled={bulkBusy || finalizeBusy}
                    >
                      ✕ Reject Selected ({selectedProposalIds.size})
                    </button>
                    <button
                      className="thor-sm-btn"
                      onClick={() => setSelectedProposalIds(new Set())}
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              <label className="thor-record-toggle">
                <input type="checkbox" checked={showFullRecord} onChange={e => {
                  setShowFullRecord(e.target.checked);
                  if (augRun) void loadProposalsAndViews(augRun.id, augRun.scope, proposalOffset, e.target.checked);
                }} /> Show full record values
                <small>Original source values · row numbers exclude the header</small>
              </label>
              {/* Structured Proposals Grid */}
              <div ref={proposalGrid} className="thor-grid thor-proposals-grid" role="region" aria-label="Table proposals grid" tabIndex={0}>
                <table>
                  <thead>
                    <tr>
                      <th style={{ width: '38px', textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={
                            displayedTableProposals.length > 0 &&
                            displayedTableProposals.every((p) => selectedProposalIds.has(p.id))
                          }
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedProposalIds(new Set(displayedTableProposals.map((p) => p.id)));
                            } else {
                              setSelectedProposalIds(new Set());
                            }
                          }}
                          aria-label="Select all displayed proposals"
                        />
                      </th>
                      <th scope="col">Record</th>
                      {showFullRecord && <th scope="col">Full record</th>}
                      <th scope="col">Column</th>
                      <th scope="col">Original</th>
                      <th scope="col">Proposed Value</th>
                      <th scope="col">Attribution</th>
                      <th scope="col" style={{ width: '130px' }}>Evidence</th>
                      <th scope="col" style={{ width: '170px' }}>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedTableProposals.map((p) => {
                      const isSelected = selectedProposalIds.has(p.id);
                      const isAccepted = p.decision === 'accepted';
                      const isRejected = p.decision === 'rejected';
                      const isBusy = decisionBusy === p.id;
                      return (
                        <tr key={p.id} data-proposal-id={p.id} tabIndex={-1} className={`${isSelected ? 'thor-row-selected' : ''} ${isAccepted ? 'thor-row-accepted' : isRejected ? 'thor-row-rejected' : ''}`}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedProposalIds);
                                if (e.target.checked) next.add(p.id);
                                else next.delete(p.id);
                                setSelectedProposalIds(next);
                              }}
                              aria-label={`Select proposal for ${p.target.column_name}`}
                            />
                          </td>
                          <td>
                            <span>{rowLabel(p.target.record_id, p.target.record_index)}</span>
                          </td>
                          {showFullRecord && <td className="thor-full-record">
                            {p.target.source_record?.origin === 'integration_snapshot' && <small>Saved integrated record</small>}
                            {p.target.source_record ? <dl>{p.target.source_record.columns.map((column, index) => <div key={index} className={column === p.target.column_name ? 'thor-target-field' : ''}>
                              <dt>{column}</dt><dd>{p.target.source_record!.cells[index] === '' || p.target.source_record!.cells[index] == null ? <em>Empty</em> : p.target.source_record!.cells[index]}</dd>
                            </div>)}</dl> : <span>{p.target.source_record === undefined ? 'Record details were not returned. Restart the local API, then toggle this checkbox again.' : 'Source version unavailable'}</span>}
                          </td>}
                          <td>
                            <span className="thor-col-badge">{p.target.column_name}</span>
                          </td>
                          <td>
                            <span className="thor-orig-empty">— (empty)</span>
                          </td>
                          <td>
                            <div className="thor-cell-proposed-wrap">
                              <span className="thor-proposed-badge">
                                <strong>+ {p.proposed_value || 'None'}</strong>
                              </span>
                              <span className={`thor-engine-tag thor-engine-${p.engine || 'thor'}`}>
                                {p.engine === 'manual' ? 'Manual entry' : p.engine === 'typed_llm' ? 'Typed LLM' : p.engine === 'hybrid' ? 'Hybrid' : 'THOR'}
                              </span>
                              {p.original_model_proposal && <small>Model originally proposed: {p.original_model_proposal.proposed_value ?? 'None'}</small>}
                              {!savedDemo && (editingValue?.id === p.id ? <div className="thor-manual-value">
                                <label>Manual value<input autoFocus aria-label={`Manual value for ${rowLabel(p.target.record_id, p.target.record_index)} ${p.target.column_name}`} maxLength={10000} value={editingValue.value} disabled={isBusy || finalizeBusy} onChange={e => setEditingValue({ id: p.id, value: e.target.value })} /></label>
                                <small>Saved as your correction; original model output is retained.</small>
                                <div><button className="thor-sm-btn" disabled={isBusy || !editingValue.value.trim()} onClick={() => saveManualValue(false)}>Save value</button>
                                <button className="thor-sm-btn" disabled={isBusy || !editingValue.value.trim()} onClick={() => saveManualValue(true)}>Save &amp; accept</button>
                                <button className="thor-sm-btn" disabled={isBusy || finalizeBusy} onClick={() => setEditingValue(null)}>Cancel</button></div>
                              </div> : <button className="thor-sm-btn" disabled={isBusy || finalizeBusy} onClick={() => setEditingValue({ id: p.id, value: p.proposed_value ?? '' })}>Edit value</button>)}
                              {p.typed_data?.unit && (
                                <span className="thor-unit-tag">{p.typed_data.unit}</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="thor-attr-cell">
                              <span className={`thor-attr-pill status-${p.attribution?.status}`}>
                                {p.attribution?.status === 'attributed' ? '✓ Attributed' : p.attribution?.status}
                              </span>
                              {p.attribution?.rationale && (
                                <small className="thor-attr-rationale" title={p.attribution.rationale}>
                                  {p.attribution.rationale}
                                </small>
                              )}
                            </div>
                          </td>
                          <td>
                            {p.evidence ? (
                              <button
                                type="button"
                                className="thor-view-evidence-btn"
                                onClick={() => setInspectingEvidenceProp(p)}
                                title="View grounding passage and context"
                              >
                                <span className="ev-icon">📄</span>
                                <span>View Evidence</span>
                              </button>
                            ) : (
                              <small style={{ color: 'var(--ink-muted)' }}>No evidence</small>
                            )}
                          </td>
                          <td>
                            <div className="thor-actions-cell">
                              {isAccepted ? (
                                <div className="decision-cell-accepted">
                                  <span className="decision-accepted-pill">✓ Accepted</span>
                                  <button
                                    className="thor-undo-btn"
                                    onClick={() => updateDecision(p.id, 'proposed')}
                                    disabled={isBusy || finalizeBusy}
                                    title="Undo decision"
                                  >
                                    Undo
                                  </button>
                                </div>
                              ) : isRejected ? (
                                <div className="decision-cell-rejected">
                                  <span className="decision-rejected-pill">✕ Rejected</span>
                                  <button
                                    className="thor-undo-btn"
                                    onClick={() => updateDecision(p.id, 'proposed')}
                                    disabled={isBusy || finalizeBusy}
                                    title="Undo decision"
                                  >
                                    Undo
                                  </button>
                                </div>
                              ) : (
                                <div className="decision-cell-buttons">
                                  <button
                                    className="btn-accept-sm"
                                    onClick={() => updateDecision(p.id, 'accepted')}
                                    disabled={isBusy || finalizeBusy}
                                  >
                                    Accept
                                  </button>
                                  <button
                                    className="btn-reject-sm"
                                    onClick={() => updateDecision(p.id, 'rejected')}
                                    disabled={isBusy || finalizeBusy}
                                  >
                                    Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {displayedTableProposals.length === 0 && (
                  <div className="thor-empty" style={{ padding: '32px', textAlign: 'center' }}>
                    No proposals match the filter {reviewFilter !== 'all' ? `(${reviewFilter})` : ''}{reviewColFilter !== 'all' ? ` for column "${reviewColFilter}"` : ''}{proposalSearch ? ` matching "${proposalSearch}"` : ''}.
                  </div>
                )}
              </div>

              {/* On-Demand Evidence Inspection Modal */}
              {inspectingEvidenceProp && (
                <div className="thor-evidence-modal-backdrop" onClick={() => setInspectingEvidenceProp(null)}>
                  <div className="thor-evidence-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                    <div className="thor-evidence-modal-header">
                      <div className="thor-evidence-modal-title">
                        <span className="thor-evidence-icon">📄</span>
                        <div>
                          <h3>Evidence Inspection</h3>
                          <span className="thor-evidence-subtitle">
                            Target: <strong>{inspectingEvidenceProp.target.column_name}</strong> in <span>{rowLabel(inspectingEvidenceProp.target.record_id, inspectingEvidenceProp.target.record_index)}</span> ({inspectingEvidenceProp.target.table_name || inspectingEvidenceProp.target.asset_id})
                          </span>
                        </div>
                      </div>
                      <button
                        className="thor-evidence-modal-close"
                        onClick={() => setInspectingEvidenceProp(null)}
                        aria-label="Close evidence inspection"
                      >
                        ✕
                      </button>
                    </div>

                    <div className="thor-evidence-modal-body">
                      <div className="thor-evidence-meta-grid">
                        <div className="thor-meta-item">
                          <span className="meta-label">Proposed Value</span>
                          <span className="meta-value thor-prop-pill">
                            + {inspectingEvidenceProp.proposed_value || 'None'}
                          </span>
                        </div>
                        <div className="thor-meta-item">
                          <span className="meta-label">Engine</span>
                          <span className={`engine-badge engine-${inspectingEvidenceProp.engine || 'thor'}`}>
                            {inspectingEvidenceProp.engine === 'manual' ? 'Manual entry' : inspectingEvidenceProp.engine === 'typed_llm' ? 'Typed LLM' : inspectingEvidenceProp.engine === 'hybrid' ? 'Hybrid' : 'THOR'}
                          </span>
                        </div>
                        <div className="thor-meta-item">
                          <span className="meta-label">Attribution</span>
                          <span className={`thor-attr-pill status-${inspectingEvidenceProp.attribution?.status}`}>
                            {inspectingEvidenceProp.attribution?.status}
                          </span>
                        </div>
                        <div className="thor-meta-item">
                          <span className="meta-label">Source Document</span>
                          <span className="meta-value doc-name">
                            {inspectingEvidenceProp.evidence?.document_name || inspectingEvidenceProp.evidence?.document || 'N/A'}
                          </span>
                        </div>
                      </div>

                      {inspectingEvidenceProp.second_pass && <p>
                        <strong>Document second pass:</strong> {inspectingEvidenceProp.second_pass.status} · {inspectingEvidenceProp.second_pass.passages} additional passages.
                        {inspectingEvidenceProp.second_pass.skipped.join('; ')}
                        {inspectingEvidenceProp.evidence?.retrieval && <> Original evidence span: {inspectingEvidenceProp.evidence.retrieval.anchor_start}–{inspectingEvidenceProp.evidence.retrieval.anchor_end}; up to {inspectingEvidenceProp.evidence.retrieval.radius} characters searched on each side.</>}
                      </p>}
                      {inspectingEvidenceProp.attribution?.rationale && (
                        <div className="thor-evidence-rationale">
                          <strong>Rationale:</strong> {inspectingEvidenceProp.attribution.rationale}
                        </div>
                      )}

                      {inspectingEvidenceProp.typed_data && (
                        <div className="thor-typed-attributes" style={{ marginBottom: '14px' }}>
                          <span className="typed-pill">Type: <strong>{inspectingEvidenceProp.typed_data.type}</strong></span>
                          {inspectingEvidenceProp.typed_data.unit && <span className="typed-pill">Unit: <strong>{inspectingEvidenceProp.typed_data.unit}</strong></span>}
                          <span className="typed-pill">Verbatim Quote: <code>{inspectingEvidenceProp.typed_data.raw_quoted}</code></span>
                          <span className="typed-pill">Precision: <strong>{inspectingEvidenceProp.typed_data.precision}</strong></span>
                          <span className={`typed-pill validation-${inspectingEvidenceProp.typed_data.validation}`}>
                            {inspectingEvidenceProp.typed_data.validation === 'valid' ? '✓ Grounded' : inspectingEvidenceProp.typed_data.validation}
                          </span>
                        </div>
                      )}

                      <div className="thor-evidence-passage-wrap">
                        <div className="thor-evidence-passage-header">
                          <span>Passage Text (Verbatim Evidence)</span>
                          {inspectingEvidenceProp.evidence?.start !== undefined && (
                            <small>Offsets: {inspectingEvidenceProp.evidence.start}–{inspectingEvidenceProp.evidence.end}</small>
                          )}
                        </div>
                        <div className="thor-evidence-passage-text">
                          {inspectingEvidenceProp.evidence ? (
                            inspectingEvidenceProp.evidence.quote && inspectingEvidenceProp.evidence.text.includes(inspectingEvidenceProp.evidence.quote) ? (
                              <>
                                {inspectingEvidenceProp.evidence.text.split(inspectingEvidenceProp.evidence.quote)[0]}
                                <mark>{inspectingEvidenceProp.evidence.quote}</mark>
                                {inspectingEvidenceProp.evidence.text.split(inspectingEvidenceProp.evidence.quote).slice(1).join(inspectingEvidenceProp.evidence.quote)}
                              </>
                            ) : (
                              inspectingEvidenceProp.evidence.text
                            )
                          ) : (
                            <em>No evidence passage attached to this proposal.</em>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="thor-evidence-modal-footer">
                      <div className="thor-evidence-footer-status">
                        Current Decision: <strong>{inspectingEvidenceProp.decision}</strong>
                      </div>
                      <div className="thor-actions">
                        <button
                          className="btn-accept"
                          onClick={async () => {
                            await updateDecision(inspectingEvidenceProp.id, 'accepted');
                            setInspectingEvidenceProp(null);
                          }}
                          disabled={inspectingEvidenceProp.decision === 'accepted'}
                        >
                          ✓ Accept Proposal
                        </button>
                        <button
                          className="btn-reject"
                          onClick={async () => {
                            await updateDecision(inspectingEvidenceProp.id, 'rejected');
                            setInspectingEvidenceProp(null);
                          }}
                          disabled={inspectingEvidenceProp.decision === 'rejected'}
                        >
                          ✕ Reject Proposal
                        </button>
                        <button
                          className="thor-sm-btn"
                          onClick={() => setInspectingEvidenceProp(null)}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : augRun.scope === 'source' ? (
            /* Derived Source Tables View & Candidate Neighborhoods */
            <div className="thor-derived-table">
              {neighborhoods && (
                <div className="thor-neighborhoods-panel">
                  <div className="thor-neighborhoods-header">
                    <div>
                      <h3>Candidate Neighborhoods &amp; Join Impact</h3>
                      <small style={{ color: 'var(--ink-muted)' }}>
                        Deterministic projection revision indexing affected source rows and evaluating new candidate connections.
                      </small>
                    </div>
                    <div className="thor-revision-badge">
                      Revision: <code>{neighborhoods.projection_revision}</code>
                    </div>
                  </div>

                  <div className="thor-neighborhoods-grid">
                    <div className="thor-neigh-stat">
                      <strong>{neighborhoods.counts.affected_rows}</strong>
                      <span>Affected Rows (Augmented)</span>
                    </div>
                    <div className="thor-neigh-stat">
                      <strong>
                        {neighborhoods.counts.baseline_candidate_connections} → {neighborhoods.counts.enriched_candidate_connections}
                      </strong>
                      <span>Candidate Connections (Budget: {neighborhoods.candidate_budget_per_row}/row)</span>
                    </div>
                    <div className="thor-neigh-stat">
                      <strong style={{ color: '#059669' }}>+{neighborhoods.counts.added_connections}</strong>
                      <span>Added Candidate Connections</span>
                    </div>
                    <div className="thor-neigh-stat">
                      <strong>
                        {neighborhoods.counts.old_to_new_connections} / {neighborhoods.counts.new_to_old_connections}
                      </strong>
                      <span>Old-to-New / New-to-Old</span>
                    </div>
                  </div>

                  <div className="thor-notice-banner">
                    ℹ️ {neighborhoods.notice}
                  </div>

                  {neighborhoods.added_connections.length > 0 && (
                    <div className="thor-connections-list">
                      {neighborhoods.added_connections.slice(0, 10).map((conn, idx) => (
                        <div key={idx} className="thor-connection-row">
                          <span className="thor-dir-badge">{conn.direction}</span>
                          <code>{conn.source_record}</code>
                          <span>→</span>
                          <code>{conn.target_record}</code>
                          <span style={{ color: 'var(--ink-muted)', marginLeft: 'auto' }}>
                            {conn.candidate_text}
                          </span>
                        </div>
                      ))}
                      {neighborhoods.added_connections.length > 10 && (
                        <small style={{ color: 'var(--ink-muted)', textAlign: 'center', padding: '4px' }}>
                          +{neighborhoods.added_connections.length - 10} additional added candidate connections
                        </small>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Derived Source Tables View */}
              {derivedView?.tables && Object.keys(derivedView.tables).length > 0 && (
                <div className="thor-tabs-nav-bar">
                  <div className="thor-rel-tabs" role="tablist" aria-label="Source tables selection">
                    {Object.entries(derivedView.tables).map(([tid, tbl]) => {
                      const isSelected = (selectedTableId || Object.keys(derivedView.tables!)[0]) === tid;
                      return (
                        <button
                          key={tid}
                          role="tab"
                          aria-selected={isSelected}
                          className={`thor-rel-tab ${isSelected ? 'active' : ''}`}
                          onClick={() => setSelectedTableId(tid)}
                        >
                          <span className="thor-table-tab-name">{tbl.table_name}</span>
                          <span className="thor-tab-count">{tbl.counts.total_rows} Rows</span>
                          {tbl.counts.enriched_cells > 0 && (
                            <span className="thor-tab-enriched-badge">✨ {tbl.counts.enriched_cells} Enriched</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {(() => {
                const currentTbl = derivedView?.tables && (derivedView.tables[selectedTableId] || Object.values(derivedView.tables)[0]);
                if (!currentTbl) {
                  return <p className="thor-empty">No source tables available in this run.</p>;
                }

                const filteredTableRows = currentTbl.rows.filter((row) => {
                  const isEnriched = row.augmentations.length > 0;
                  if (enrichedOnly && !isEnriched) return false;
                  if (derivedSearch.trim()) {
                    const q = derivedSearch.toLowerCase();
                    const matchRec = row.record_id.toLowerCase().includes(q);
                    const matchCells = row.cells.some((c) => (c || '').toLowerCase().includes(q));
                    const matchAugs = row.augmentations.some(
                      (a) => (a.value || '').toLowerCase().includes(q) || (a.column_name || '').toLowerCase().includes(q)
                    );
                    if (!matchRec && !matchCells && !matchAugs) return false;
                  }
                  return true;
                });

                return (
                  <div className="thor-source-table-wrap">
                    <div className="thor-rel-toolbar">
                      <div className="thor-rel-filters">
                        <label className="thor-checkbox-label">
                          <input
                            type="checkbox"
                            checked={enrichedOnly}
                            onChange={(e) => setEnrichedOnly(e.target.checked)}
                          />
                          <span>Show enriched rows only</span>
                          {currentTbl.counts.enriched_rows > 0 && (
                            <span className="thor-count-pill">{currentTbl.counts.enriched_rows}</span>
                          )}
                        </label>
                        <div className="thor-search-wrap">
                          <input
                            type="text"
                            placeholder={`Filter ${currentTbl.table_name} rows...`}
                            value={derivedSearch}
                            onChange={(e) => setDerivedSearch(e.target.value)}
                            className="thor-search-input"
                          />
                          {derivedSearch && (
                            <button className="thor-search-clear" onClick={() => setDerivedSearch('')}>✕</button>
                          )}
                        </div>
                      </div>
                      <div className="thor-rel-actions">
                        {augRun && (
                          <a
                            href={apiUrl(
                              `/augmentation/runs/${augRun.id}/export?format=csv&table_id=${encodeURIComponent(currentTbl.table_id)}`
                            )}
                            download
                            className="thor-download-btn"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                            <span>Download {currentTbl.table_name} CSV</span>
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="thor-grid" role="region" aria-label="Enriched source table view" tabIndex={0}>
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Record</th>
                            {currentTbl.columns.map((col, idx) => (
                              <th key={idx} scope="col">
                                {col}
                              </th>
                            ))}
                            <th scope="col">Enriched Provenance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredTableRows.map((row) => {
                            const isEnriched = row.augmentations.length > 0;
                            return (
                              <tr key={row.record_id} className={isEnriched ? 'thor-row-enriched' : ''}>
                                <td>
                                  <span>{rowLabel(row.record_id)}</span>
                                </td>
                                {row.cells.map((cell, cIdx) => {
                                  const aug = row.augmentations.find((a) => a.column_index === cIdx);
                                  return (
                                    <td key={cIdx} className={aug ? 'thor-cell-enriched' : 'thor-cell-baseline'}>
                                      {aug ? (
                                        <div className="thor-cell-enriched-content">
                                          <span
                                            className="thor-enriched-badge"
                                            title={`Augmented: proposed '${aug.value}', originally empty. Engine: ${aug.engine || 'THOR'}`}
                                          >
                                            <span className="thor-plus-tag">+</span> {aug.value}
                                          </span>
                                          {aug.engine && (
                                            <span className={`thor-engine-tag thor-engine-${aug.engine}`}>
                                              {aug.engine === 'manual' ? 'Manual entry' : aug.engine === 'thor' ? 'THOR' : aug.engine === 'typed_llm' ? 'Typed LLM' : 'Hybrid'}
                                            </span>
                                          )}
                                        </div>
                                      ) : (
                                        cell ?? <span className="thor-cell-empty">—</span>
                                      )}
                                    </td>
                                  );
                                })}
                                <td>
                                  {isEnriched ? (
                                    <div className="thor-provenance-chips">
                                      {row.augmentations.map((a, i) => (
                                        <span key={i} className="thor-aug-chip" title={a.evidence_quote ? `Quote: ${a.evidence_quote}` : undefined}>
                                          <strong>{a.column_name}:</strong> {a.value}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <small className="thor-baseline-muted">Baseline raw record</small>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {filteredTableRows.length === 0 && (
                        <p className="thor-empty" style={{ padding: '24px', textAlign: 'center' }}>
                          No rows match the filter {enrichedOnly ? '(showing enriched rows only)' : ''}{derivedSearch ? ` for "${derivedSearch}"` : ''}.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })()}

              <p className="thor-note">
                Non-destructive overlay. Raw source CSV files and SQLite records remain 100% immutable.
              </p>
            </div>
          ) : (
            /* Derived Relational Tables View (Shown Separately per Relationship) */
            <div className="thor-derived-table thor-rel-workspace">
              {/* Relationship navigation tabs */}
              <div className="thor-tabs-nav-bar">
                <div className="thor-rel-tabs" role="tablist" aria-label="Relational tables navigation">
                  <button
                    role="tab"
                    aria-selected={selectedRel === 'all'}
                    className={`thor-rel-tab ${selectedRel === 'all' ? 'active' : ''}`}
                    onClick={() => setSelectedRel('all')}
                  >
                    <span>All Relationships</span>
                    <span className="thor-tab-count">{(derivedView?.output || []).length} Pairs</span>
                    {totalEnrichedOutputCells > 0 && (
                      <span className="thor-tab-enriched-badge">✨ {totalEnrichedOutputCells} Enriched</span>
                    )}
                  </button>
                  {Object.entries(relationshipGroups).map(([rel, rRows]) => {
                    const relCells = rRows.reduce(
                      (sum, r) => sum + (r.left_augmentations?.length || 0) + (r.right_augmentations?.length || 0),
                      0
                    );
                    return (
                      <button
                        key={rel}
                        role="tab"
                        aria-selected={selectedRel === rel}
                        className={`thor-rel-tab ${selectedRel === rel ? 'active' : ''}`}
                        onClick={() => setSelectedRel(rel)}
                      >
                        <span className="thor-table-tab-name">{rel}</span>
                        <span className="thor-tab-count">{rRows.length} Pairs</span>
                        {relCells > 0 && (
                          <span className="thor-tab-enriched-badge">✨ {relCells}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Filtering and CSV Download Toolbar */}
              <div className="thor-rel-toolbar">
                <div className="thor-rel-filters">
                  <label className="thor-checkbox-label">
                    <input
                      type="checkbox"
                      checked={enrichedOnly}
                      onChange={(e) => setEnrichedOnly(e.target.checked)}
                    />
                    <span>Show enriched rows only</span>
                    {totalEnrichedOutputRows > 0 && (
                      <span className="thor-count-pill">{totalEnrichedOutputRows}</span>
                    )}
                  </label>
                  <div className="thor-search-wrap">
                    <input
                      type="text"
                      placeholder="Filter pairs, attributes, evidence quotes..."
                      value={derivedSearch}
                      onChange={(e) => setDerivedSearch(e.target.value)}
                      className="thor-search-input"
                    />
                    {derivedSearch && (
                      <button className="thor-search-clear" onClick={() => setDerivedSearch('')}>✕</button>
                    )}
                  </div>
                </div>
                <div className="thor-rel-actions">
                  {augRun && (
                    <a
                      href={apiUrl(
                        `/augmentation/runs/${augRun.id}/export?format=csv${selectedRel !== 'all' ? `&relation=${encodeURIComponent(selectedRel)}` : ''}`
                      )}
                      download
                      className="thor-download-btn"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span>Download {selectedRel === 'all' ? 'All Relationships' : selectedRel} CSV</span>
                    </a>
                  )}
                </div>
              </div>

              {/* Relationship Tables rendered as separate sections */}
              {Object.keys(relationshipGroups).length === 0 ? (
                <p className="thor-empty">No relationship output rows in this run.</p>
              ) : (
                (selectedRel === 'all'
                  ? Object.entries(relationshipGroups)
                  : Object.entries(relationshipGroups).filter(([r]) => r === selectedRel)
                ).map(([rel, rRows]) => {
                  const leftCols = rRows[0]?.left_columns || [];
                  const rightCols = rRows[0]?.right_columns || [];
                  const relEnrichedRows = rRows.filter(
                    (r) => (r.left_augmentations?.length || 0) > 0 || (r.right_augmentations?.length || 0) > 0
                  );
                  const relEnrichedCells = rRows.reduce(
                    (sum, r) => sum + (r.left_augmentations?.length || 0) + (r.right_augmentations?.length || 0),
                    0
                  );

                  const filteredRows = rRows.filter((r) => {
                    const isEnriched = (r.left_augmentations?.length || 0) > 0 || (r.right_augmentations?.length || 0) > 0;
                    if (enrichedOnly && !isEnriched) return false;
                    if (derivedSearch.trim()) {
                      const q = derivedSearch.toLowerCase();
                      const matchCand = (r.candidate || '').toLowerCase().includes(q);
                      const matchLeftRec = (r.left_record || '').toLowerCase().includes(q);
                      const matchRightRec = (r.right_record || '').toLowerCase().includes(q);
                      const matchLeftCells = (r.left_cells || []).some((c) => (c || '').toLowerCase().includes(q));
                      const matchRightCells = (r.right_cells || []).some((c) => (c || '').toLowerCase().includes(q));
                      const matchEvidence = (r.evidence_quote || '').toLowerCase().includes(q);
                      const matchAugs = [...(r.left_augmentations || []), ...(r.right_augmentations || [])].some(
                        (a) => (a.value || '').toLowerCase().includes(q) || (a.column_name || '').toLowerCase().includes(q)
                      );
                      if (!matchCand && !matchLeftRec && !matchRightRec && !matchLeftCells && !matchRightCells && !matchEvidence && !matchAugs) return false;
                    }
                    return true;
                  });

                  return (
                    <section key={rel} className="thor-rel-section" aria-label={`${rel} relationship table`}>
                      <header className="thor-rel-header">
                        <div className="thor-rel-title-group">
                          <div className="thor-rel-badge-wrap">
                            <span className="thor-rel-badge-main">{rel}</span>
                            <span className="thor-rel-dir-pill">{rRows[0]?.direction || 'undirected'}</span>
                          </div>
                          <div className="thor-rel-meta-stats">
                            <span className="thor-stat-pill">
                              <strong>{rRows.length}</strong> pairs
                            </span>
                            <span className={`thor-stat-pill ${relEnrichedRows.length > 0 ? 'thor-stat-enriched' : ''}`}>
                              <strong>{relEnrichedRows.length}</strong> enriched
                            </span>
                            <span className={`thor-stat-pill ${relEnrichedCells > 0 ? 'thor-stat-values' : ''}`}>
                              <strong>{relEnrichedCells}</strong> new grounded values
                            </span>
                          </div>
                        </div>
                        <div className="thor-rel-header-actions">
                          {augRun && (
                            <a
                              href={apiUrl(`/augmentation/runs/${augRun.id}/export?format=csv&relation=${encodeURIComponent(rel)}`)}
                              download
                              className="thor-sm-download-btn"
                              title={`Download ${rel} table as CSV`}
                            >
                              Download {rel} CSV ↓
                            </a>
                          )}
                        </div>
                      </header>

                      <div className="thor-grid" role="region" aria-label={`Enriched ${rel} relationship table view`} tabIndex={0}>
                        <table>
                          <thead>
                            <tr>
                              <th scope="col" className="thor-th-pair">Record Pair</th>
                              {leftCols.length > 0 ? (
                                leftCols.map((c, i) => (
                                  <th key={`l-${i}`} scope="col" className="thor-th-left">
                                    <span className="thor-th-sub">Left ·</span> {c}
                                  </th>
                                ))
                              ) : (
                                <th scope="col" className="thor-th-left">Left Entity Data</th>
                              )}
                              <th scope="col" className="thor-th-rel">Relationship</th>
                              {rightCols.length > 0 ? (
                                rightCols.map((c, i) => (
                                  <th key={`r-${i}`} scope="col" className="thor-th-right">
                                    <span className="thor-th-sub">Right ·</span> {c}
                                  </th>
                                ))
                              ) : (
                                <th scope="col" className="thor-th-right">Right Entity Data</th>
                              )}
                              <th scope="col" className="thor-th-evidence">Grounded Text Evidence</th>
                              <th scope="col" className="thor-th-provenance">Enriched Values</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRows.map((row, idx) => {
                              const hasLeftAug = (row.left_augmentations || []).length > 0;
                              const hasRightAug = (row.right_augmentations || []).length > 0;
                              const isRowEnriched = hasLeftAug || hasRightAug;
                              return (
                                <tr key={idx} className={isRowEnriched ? 'thor-row-enriched' : ''}>
                                  <td className="thor-td-pair">
                                    <strong>{row.candidate || `${rowLabel(row.left_record)} ↔ ${rowLabel(row.right_record)}`}</strong>
                                    <div className="thor-records-sub">
                                      <span>L: <span>{rowLabel(row.left_record)}</span></span>
                                      <span>R: <span>{rowLabel(row.right_record)}</span></span>
                                    </div>
                                  </td>
                                  {leftCols.length > 0 ? (
                                    leftCols.map((_, cIdx) => {
                                      const aug = row.left_augmentations?.find((a) => a.column_index === cIdx);
                                      const cellVal = row.left_cells?.[cIdx];
                                      return (
                                        <td key={`lc-${cIdx}`} className={aug ? 'thor-cell-enriched' : 'thor-cell-baseline'}>
                                          {aug ? (
                                            <div className="thor-cell-enriched-content">
                                              <span
                                                className="thor-enriched-badge"
                                                title={`Augmented: proposed '${aug.value}', originally empty. Engine: ${aug.engine || 'THOR'}`}
                                              >
                                                <span className="thor-plus-tag">+</span> {aug.value}
                                              </span>
                                              {aug.engine && (
                                                <span className={`thor-engine-tag thor-engine-${aug.engine}`}>
                                                  {aug.engine === 'manual' ? 'Manual entry' : aug.engine === 'thor' ? 'THOR' : aug.engine === 'typed_llm' ? 'Typed LLM' : 'Hybrid'}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            cellVal ?? <span className="thor-cell-empty">—</span>
                                          )}
                                        </td>
                                      );
                                    })
                                  ) : (
                                    <td>
                                      {(row.left_cells || []).map((c, i) => {
                                        const isAug = row.left_augmentations?.some((a) => a.column_index === i);
                                        return isAug ? (
                                          <span key={i} className="thor-enriched-badge" title={`Augmented column #${i}`}>
                                            + {c}
                                          </span>
                                        ) : (
                                          <span key={i} style={{ marginRight: 6, color: 'var(--ink-muted)' }}>
                                            {c || '—'}
                                          </span>
                                        );
                                      })}
                                    </td>
                                  )}
                                  <td className="thor-td-rel">
                                    <span className="thor-rel-pill">{row.relation || 'LINK'}</span>
                                    <small className="thor-rel-dir">{row.direction || 'undirected'}</small>
                                  </td>
                                  {rightCols.length > 0 ? (
                                    rightCols.map((_, cIdx) => {
                                      const aug = row.right_augmentations?.find((a) => a.column_index === cIdx);
                                      const cellVal = row.right_cells?.[cIdx];
                                      return (
                                        <td key={`rc-${cIdx}`} className={aug ? 'thor-cell-enriched' : 'thor-cell-baseline'}>
                                          {aug ? (
                                            <div className="thor-cell-enriched-content">
                                              <span
                                                className="thor-enriched-badge"
                                                title={`Augmented: proposed '${aug.value}', originally empty. Engine: ${aug.engine || 'THOR'}`}
                                              >
                                                <span className="thor-plus-tag">+</span> {aug.value}
                                              </span>
                                              {aug.engine && (
                                                <span className={`thor-engine-tag thor-engine-${aug.engine}`}>
                                                  {aug.engine === 'manual' ? 'Manual entry' : aug.engine === 'thor' ? 'THOR' : aug.engine === 'typed_llm' ? 'Typed LLM' : 'Hybrid'}
                                                </span>
                                              )}
                                            </div>
                                          ) : (
                                            cellVal ?? <span className="thor-cell-empty">—</span>
                                          )}
                                        </td>
                                      );
                                    })
                                  ) : (
                                    <td>
                                      {(row.right_cells || []).map((c, i) => {
                                        const isAug = row.right_augmentations?.some((a) => a.column_index === i);
                                        return isAug ? (
                                          <span key={i} className="thor-enriched-badge" title={`Augmented column #${i}`}>
                                            + {c}
                                          </span>
                                        ) : (
                                          <span key={i} style={{ marginRight: 6, color: 'var(--ink-muted)' }}>
                                            {c || '—'}
                                          </span>
                                        );
                                      })}
                                    </td>
                                  )}
                                  <td className="thor-td-evidence">
                                    {row.evidence_quote ? (
                                      <div className="thor-evidence-quote-box" title={row.evidence_quote}>
                                        <span className="thor-quote-mark">“</span>
                                        <span className="thor-quote-body">{row.evidence_quote}</span>
                                        <span className="thor-quote-mark">”</span>
                                      </div>
                                    ) : (
                                      <span className="thor-cell-empty">—</span>
                                    )}
                                  </td>
                                  <td className="thor-td-provenance">
                                    {isRowEnriched ? (
                                      <div className="thor-provenance-chips">
                                        {(row.left_augmentations || []).map((a, i) => (
                                          <span key={`la-${i}`} className="thor-aug-chip" title={a.evidence_quote ? `Quote: ${a.evidence_quote}` : undefined}>
                                            <strong>L.{a.column_name}:</strong> {a.value}
                                          </span>
                                        ))}
                                        {(row.right_augmentations || []).map((a, i) => (
                                          <span key={`ra-${i}`} className="thor-aug-chip" title={a.evidence_quote ? `Quote: ${a.evidence_quote}` : undefined}>
                                            <strong>R.{a.column_name}:</strong> {a.value}
                                          </span>
                                        ))}
                                      </div>
                                    ) : (
                                      <small className="thor-baseline-muted">Baseline raw record</small>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                        {filteredRows.length === 0 && (
                          <p className="thor-empty" style={{ padding: '24px', textAlign: 'center' }}>
                            No rows match the current filter {enrichedOnly ? '(showing enriched rows only)' : ''}{derivedSearch ? ` for "${derivedSearch}"` : ''}.
                          </p>
                        )}
                      </div>
                    </section>
                  );
                })
              )}

              <p className="thor-note">
                Non-destructive overlay. The base integration run in <code>integration_plans</code> and raw source
                CSV records remain completely unchanged.
              </p>
            </div>
          )}
        </div>
      )}

      {showPromptModal && (
        <div className="thor-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="typed-prompt-modal-title">
          <div className="thor-modal-content">
            <div className="thor-modal-header">
              <h3 id="typed-prompt-modal-title">Configure Typed Extraction Prompt</h3>
              <button
                type="button"
                className="thor-modal-close"
                onClick={() => setShowPromptModal(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="thor-modal-body">
              <p className="thor-note">
                Lake-scoped generic prompt template for seedless concepts, numbers, dates, and measurement units.
                Snapshotted immutably per augmentation run.
              </p>
              {typedPrompt ? (
                <>
                  <div className="thor-field-group">
                    <label>Prompt Preset / ID</label>
                    <input type="text" readOnly value={typedPrompt.prompt_id} />
                  </div>
                  <div className="thor-field-group">
                    <label>System Template & Grounding Instructions</label>
                    <textarea
                      rows={12}
                      value={typedPrompt.system_template}
                      onChange={(e) => setTypedPrompt({ ...typedPrompt, system_template: e.target.value })}
                    />
                  </div>
                  {promptSavedMsg && <div className="thor-saved-toast">{promptSavedMsg}</div>}
                  <div className="thor-modal-actions">
                    <button
                      type="button"
                      className="thor-primary"
                      disabled={promptBusy}
                      onClick={async () => {
                        setPromptBusy(true);
                        try {
                          const res = await post<TypedPromptConfig>('/augmentation/prompts/typed', typedPrompt);
                          setTypedPrompt(res);
                          setPromptSavedMsg('Prompt template saved to lake config');
                          setTimeout(() => setPromptSavedMsg(''), 3000);
                        } catch (err) {
                          setError((err as Error).message);
                        } finally {
                          setPromptBusy(false);
                        }
                      }}
                    >
                      {promptBusy ? 'Saving…' : 'Save to Lake'}
                    </button>
                    <button
                      type="button"
                      className="thor-secondary-btn"
                      onClick={() => setShowPromptModal(false)}
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <p>Loading prompt configuration…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
