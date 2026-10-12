import { test } from 'node:test';
import assert from 'node:assert/strict';

export interface TypedAttribute {
  type: 'numeric' | 'date' | 'unit_quantity' | 'string';
  raw_quoted: string;
  normalized_value: number | string | null;
  unit: string | null;
  temporal_scope: string | null;
  precision: string;
  validation: 'valid' | 'unsupported_quote' | 'out_of_range' | 'unparseable';
}

export interface TypedProposal {
  id: string;
  engine: 'thor' | 'typed_llm';
  column: string;
  proposed_value: string | null;
  typed_data?: TypedAttribute | null;
  decision: 'proposed' | 'accepted' | 'rejected' | 'conflicting' | 'unresolved';
}

export function validateTypedQuote(rawQuote: string, passage: string): boolean {
  if (!rawQuote || !passage) return false;
  return passage.toLowerCase().includes(rawQuote.toLowerCase().trim());
}

export function computeTelemetry(proposals: TypedProposal[]) {
  const total = proposals.length;
  const validAttributed = proposals.filter(
    (p) => p.typed_data?.validation === 'valid' && p.decision !== 'unresolved'
  ).length;
  const accepted = proposals.filter((p) => p.decision === 'accepted').length;
  const reviewed = proposals.filter((p) => p.decision === 'accepted' || p.decision === 'rejected').length;

  const engines: Record<string, number> = {};
  for (const p of proposals) {
    engines[p.engine] = (engines[p.engine] || 0) + 1;
  }

  return {
    total,
    extractionQuality: total > 0 ? validAttributed / total : 0,
    acceptanceRate: reviewed > 0 ? accepted / reviewed : 0,
    engines,
  };
}

test('verbatim quote grounding verification', () => {
  const passage = 'Subject was measured with weight 72.5 kg on 2026-04-10.';
  assert.equal(validateTypedQuote('72.5 kg', passage), true);
  assert.equal(validateTypedQuote('2026-04-10', passage), true);
  assert.equal(validateTypedQuote('999 kg', passage), false);
  assert.equal(validateTypedQuote('', passage), false);
});

test('typed proposal structure and engine labeling', () => {
  const thorProposal: TypedProposal = {
    id: 'p_thor_1',
    engine: 'thor',
    column: 'appearance',
    proposed_value: 'amber',
    typed_data: null,
    decision: 'accepted',
  };

  const typedProposal: TypedProposal = {
    id: 'p_typed_1',
    engine: 'typed_llm',
    column: 'weight',
    proposed_value: '72.5',
    typed_data: {
      type: 'unit_quantity',
      raw_quoted: '72.5 kg',
      normalized_value: 72.5,
      unit: 'kg',
      temporal_scope: null,
      precision: 'float_1',
      validation: 'valid',
    },
    decision: 'proposed',
  };

  assert.equal(thorProposal.engine, 'thor');
  assert.equal(thorProposal.typed_data, null);

  assert.equal(typedProposal.engine, 'typed_llm');
  assert.ok(typedProposal.typed_data);
  assert.equal(typedProposal.typed_data?.unit, 'kg');
  assert.equal(typedProposal.typed_data?.validation, 'valid');
});

test('telemetry calculation and engine breakdown', () => {
  const proposals: TypedProposal[] = [
    {
      id: 'p1',
      engine: 'thor',
      column: 'color',
      proposed_value: 'clear',
      typed_data: null,
      decision: 'accepted',
    },
    {
      id: 'p2',
      engine: 'typed_llm',
      column: 'weight',
      proposed_value: '75',
      typed_data: {
        type: 'unit_quantity',
        raw_quoted: '75 kg',
        normalized_value: 75,
        unit: 'kg',
        temporal_scope: null,
        precision: 'integer',
        validation: 'valid',
      },
      decision: 'accepted',
    },
    {
      id: 'p3',
      engine: 'typed_llm',
      column: 'dosage',
      proposed_value: null,
      typed_data: {
        type: 'numeric',
        raw_quoted: 'unknown',
        normalized_value: null,
        unit: null,
        temporal_scope: null,
        precision: 'unknown',
        validation: 'unsupported_quote',
      },
      decision: 'unresolved',
    },
  ];

  const t = computeTelemetry(proposals);
  assert.equal(t.total, 3);
  assert.equal(t.engines.thor, 1);
  assert.equal(t.engines.typed_llm, 2);
  assert.equal(t.acceptanceRate, 1.0); // 2 accepted out of 2 reviewed
  assert.equal(t.extractionQuality, 1 / 3); // 1 valid typed attributed proposal out of 3 total
});

export interface TestDerivedRow {
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
  left_augmentations?: { column_index: number; column_name: string; value: string; proposal_id: string; original: any }[];
  right_augmentations?: { column_index: number; column_name: string; value: string; proposal_id: string; original: any }[];
}

export function groupDerivedRowsByRelationship(rows: TestDerivedRow[]): Record<string, TestDerivedRow[]> {
  const groups: Record<string, TestDerivedRow[]> = {};
  for (const r of rows) {
    const rel = r.relation || 'UNSPECIFIED';
    if (!groups[rel]) groups[rel] = [];
    groups[rel].push(r);
  }
  return groups;
}

export function filterDerivedRows(
  rows: TestDerivedRow[],
  opts: { enrichedOnly?: boolean; query?: string }
): TestDerivedRow[] {
  return rows.filter((r) => {
    const isEnriched = (r.left_augmentations?.length || 0) > 0 || (r.right_augmentations?.length || 0) > 0;
    if (opts.enrichedOnly && !isEnriched) return false;
    if (opts.query && opts.query.trim()) {
      const q = opts.query.toLowerCase();
      const matchCand = (r.candidate || '').toLowerCase().includes(q);
      const matchLeftRec = (r.left_record || '').toLowerCase().includes(q);
      const matchRightRec = (r.right_record || '').toLowerCase().includes(q);
      const matchLeftCells = (r.left_cells || []).some((c) => (c || '').toLowerCase().includes(q));
      const matchRightCells = (r.right_cells || []).some((c) => (c || '').toLowerCase().includes(q));
      const matchQuote = (r.evidence_quote || '').toLowerCase().includes(q);
      const matchAugs = [...(r.left_augmentations || []), ...(r.right_augmentations || [])].some(
        (a) => (a.value || '').toLowerCase().includes(q) || (a.column_name || '').toLowerCase().includes(q)
      );
      if (!matchCand && !matchLeftRec && !matchRightRec && !matchLeftCells && !matchRightCells && !matchQuote && !matchAugs) {
        return false;
      }
    }
    return true;
  });
}

test('separate relational tables grouping by relationship', () => {
  const rows: TestDerivedRow[] = [
    {
      candidate: 'Aspirin ↔ Myocardial Infarction',
      relation: 'TREATED_WITH',
      left_record: 'prescriptions:v1:1',
      right_record: 'diagnoses:v1:1',
      left_columns: ['drug', 'dose'],
      right_columns: ['condition'],
      left_cells: ['Aspirin', '81mg'],
      right_cells: ['Myocardial Infarction'],
      left_augmentations: [{ column_index: 1, column_name: 'dose', value: '81mg', proposal_id: 'p1', original: null }],
    },
    {
      candidate: 'Metformin ↔ Type 2 Diabetes',
      relation: 'TREATED_WITH',
      left_record: 'prescriptions:v1:2',
      right_record: 'diagnoses:v1:2',
      left_columns: ['drug', 'dose'],
      right_columns: ['condition'],
      left_cells: ['Metformin', '500mg'],
      right_cells: ['Type 2 Diabetes'],
    },
    {
      candidate: 'Smoking ↔ Lung Cancer',
      relation: 'CAUSES',
      left_record: 'habits:v1:1',
      right_record: 'diagnoses:v1:3',
      left_columns: ['habit'],
      right_columns: ['condition'],
      left_cells: ['Smoking'],
      right_cells: ['Lung Cancer'],
      right_augmentations: [{ column_index: 0, column_name: 'condition', value: 'Lung Cancer', proposal_id: 'p2', original: null }],
    },
  ];

  const grouped = groupDerivedRowsByRelationship(rows);
  assert.deepEqual(Object.keys(grouped).sort(), ['CAUSES', 'TREATED_WITH']);
  assert.equal(grouped['TREATED_WITH'].length, 2);
  assert.equal(grouped['CAUSES'].length, 1);
});

test('filtering enriched relational rows and searching content', () => {
  const rows: TestDerivedRow[] = [
    {
      candidate: 'Aspirin ↔ MI',
      relation: 'TREATED_WITH',
      left_cells: ['Aspirin', '81mg'],
      left_augmentations: [{ column_index: 1, column_name: 'dose', value: '81mg', proposal_id: 'p1', original: null }],
    },
    {
      candidate: 'Metformin ↔ Diabetes',
      relation: 'TREATED_WITH',
      left_cells: ['Metformin', '500mg'],
    },
    {
      candidate: 'Lisinopril ↔ Hypertension',
      relation: 'TREATED_WITH',
      left_cells: ['Lisinopril', '10mg'],
      right_augmentations: [{ column_index: 0, column_name: 'indication', value: 'Hypertension', proposal_id: 'p2', original: null }],
    },
  ];

  // Enriched only filter
  const enrichedOnly = filterDerivedRows(rows, { enrichedOnly: true });
  assert.equal(enrichedOnly.length, 2);
  assert.equal(enrichedOnly[0].candidate, 'Aspirin ↔ MI');
  assert.equal(enrichedOnly[1].candidate, 'Lisinopril ↔ Hypertension');

  // Text search filter
  const searchAspirin = filterDerivedRows(rows, { query: 'aspirin' });
  assert.equal(searchAspirin.length, 1);
  assert.equal(searchAspirin[0].candidate, 'Aspirin ↔ MI');

  // Search by augmented value
  const searchDose = filterDerivedRows(rows, { query: '81mg' });
  assert.equal(searchDose.length, 1);
});

export interface ReviewProposalItem {
  id: string;
  target: {
    asset_id: string;
    table_name?: string;
    record_id: string;
    column_name: string;
  };
  proposed_value: string | null;
  engine?: string;
  decision: 'proposed' | 'accepted' | 'rejected' | 'conflicting' | 'unresolved';
  evidence?: {
    document_name?: string;
    text_content?: string;
  };
}

export function groupProposalsByTable(proposals: ReviewProposalItem[]): Record<string, { table_id: string; table_name: string; proposals: ReviewProposalItem[] }> {
  const map: Record<string, { table_id: string; table_name: string; proposals: ReviewProposalItem[] }> = {};
  for (const p of proposals) {
    const tid = p.target.asset_id || 'unassigned';
    const tname = p.target.table_name || tid;
    if (!map[tid]) {
      map[tid] = { table_id: tid, table_name: tname, proposals: [] };
    }
    map[tid].proposals.push(p);
  }
  return map;
}

export function filterTableProposals(
  proposals: ReviewProposalItem[],
  opts: { column?: string; status?: string; search?: string }
): ReviewProposalItem[] {
  return proposals.filter((p) => {
    if (opts.column && opts.column !== 'all' && p.target.column_name !== opts.column) {
      return false;
    }
    if (opts.status && opts.status !== 'all' && p.decision !== opts.status) {
      return false;
    }
    if (opts.search && opts.search.trim()) {
      const q = opts.search.toLowerCase();
      const matchRec = (p.target.record_id || '').toLowerCase().includes(q);
      const matchCol = (p.target.column_name || '').toLowerCase().includes(q);
      const matchVal = (p.proposed_value || '').toLowerCase().includes(q);
      if (!matchRec && !matchCol && !matchVal) return false;
    }
    return true;
  });
}

test('table-wise proposal grouping isolates tables and prevents cross-table DOM pollution', () => {
  const proposals: ReviewProposalItem[] = [
    {
      id: 'p1',
      target: { asset_id: 'tbl_patients', table_name: 'Patients', record_id: 'P01', column_name: 'age' },
      proposed_value: '45',
      decision: 'proposed',
    },
    {
      id: 'p2',
      target: { asset_id: 'tbl_patients', table_name: 'Patients', record_id: 'P02', column_name: 'gender' },
      proposed_value: 'Female',
      decision: 'proposed',
    },
    {
      id: 'p3',
      target: { asset_id: 'tbl_labs', table_name: 'Lab_Results', record_id: 'L01', column_name: 'cholesterol' },
      proposed_value: '190',
      decision: 'proposed',
    },
  ];

  const grouped = groupProposalsByTable(proposals);
  assert.equal(Object.keys(grouped).length, 2);
  assert.equal(grouped['tbl_patients'].table_name, 'Patients');
  assert.equal(grouped['tbl_patients'].proposals.length, 2);
  assert.equal(grouped['tbl_labs'].table_name, 'Lab_Results');
  assert.equal(grouped['tbl_labs'].proposals.length, 1);
});

test('per-table proposal filtering by column, status, and query', () => {
  const patientProps: ReviewProposalItem[] = [
    {
      id: 'p1',
      target: { asset_id: 'tbl_patients', table_name: 'Patients', record_id: 'P01', column_name: 'age' },
      proposed_value: '45',
      decision: 'proposed',
    },
    {
      id: 'p2',
      target: { asset_id: 'tbl_patients', table_name: 'Patients', record_id: 'P02', column_name: 'gender' },
      proposed_value: 'Female',
      decision: 'accepted',
    },
    {
      id: 'p3',
      target: { asset_id: 'tbl_patients', table_name: 'Patients', record_id: 'P03', column_name: 'age' },
      proposed_value: '62',
      decision: 'proposed',
    },
  ];

  // Filter by column 'age'
  const colFiltered = filterTableProposals(patientProps, { column: 'age' });
  assert.equal(colFiltered.length, 2);
  assert.ok(colFiltered.every((p) => p.target.column_name === 'age'));

  // Filter by status 'accepted'
  const acceptedFiltered = filterTableProposals(patientProps, { status: 'accepted' });
  assert.equal(acceptedFiltered.length, 1);
  assert.equal(acceptedFiltered[0].id, 'p2');

  // Filter by search query 'Female'
  const searchFiltered = filterTableProposals(patientProps, { search: 'female' });
  assert.equal(searchFiltered.length, 1);
  assert.equal(searchFiltered[0].id, 'p2');
});

test('batch acceptance selection mechanics across table, column, and cell levels', () => {
  const proposals: ReviewProposalItem[] = [
    { id: 'p1', target: { asset_id: 't1', record_id: 'r1', column_name: 'c1' }, proposed_value: 'v1', decision: 'proposed' },
    { id: 'p2', target: { asset_id: 't1', record_id: 'r2', column_name: 'c1' }, proposed_value: 'v2', decision: 'proposed' },
    { id: 'p3', target: { asset_id: 't1', record_id: 'r1', column_name: 'c2' }, proposed_value: 'v3', decision: 'proposed' },
    { id: 'p4', target: { asset_id: 't2', record_id: 'r3', column_name: 'c3' }, proposed_value: 'v4', decision: 'proposed' },
  ];

  // 1. Table level: All proposals in table t1
  const t1Proposals = proposals.filter((p) => p.target.asset_id === 't1');
  assert.equal(t1Proposals.length, 3);
  const t1Ids = t1Proposals.map((p) => p.id);
  assert.deepEqual(t1Ids, ['p1', 'p2', 'p3']);

  // 2. Column level: All proposals in column c1 for table t1
  const c1Proposals = t1Proposals.filter((p) => p.target.column_name === 'c1');
  assert.equal(c1Proposals.length, 2);
  const c1Ids = c1Proposals.map((p) => p.id);
  assert.deepEqual(c1Ids, ['p1', 'p2']);

  // 3. Cell level: User selectively picks specific proposals by ID (checkbox selection)
  const selectedCellIds = new Set(['p1', 'p3']);
  const selectedCells = t1Proposals.filter((p) => selectedCellIds.has(p.id));
  assert.equal(selectedCells.length, 2);
  assert.equal(selectedCells[0].id, 'p1');
  assert.equal(selectedCells[1].id, 'p3');
});

