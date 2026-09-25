export type ReviewSource = {
  source?: string; name: string; columns: string[];
  record: { record_id?: string; cells: string[] }; anchor_column: number;
};
type ReviewCase = { candidate: string; left: ReviewSource; right: ReviewSource; document_name?: string };
type ReviewRow = { candidate: string; relation: string; direction?: string; evidence_quote: string; left_link: string; right_link: string };
export type ReviewKeys = Record<string, number[]>;

/** Source IDs, not names or inferred semantic similarity, define table identity. */
export function relationshipGroups<C extends ReviewCase, R extends ReviewRow>(cases: C[], rows: R[], keys: ReviewKeys = {}) {
  const byCandidate = new Map(cases.map(c => [c.candidate, c]));
  const groups = new Map<string, { key: string; rows: R[]; cases: C[]; labels: string[]; basis: string; direction: string }>();
  let skipped = 0;
  const identity = (s: ReviewSource) => {
    if (!s.source) return null;
    const columns = keys[s.source];
    if (columns?.length) {
      const values = columns.map(index => s.record.cells[index]);
      if (values.some(v => v == null || !v.trim())) return null;
      return [s.source, 'key', columns, values];
    }
    return s.record.record_id ? [s.source, 'record', s.record.record_id] : null;
  };
  for (const row of rows) {
    if (['NEGATIVE', 'UNRESOLVED'].includes(row.relation)) continue;
    const c = byCandidate.get(row.candidate);
    const a = c && identity(c.left), b = c && identity(c.right);
    if (!c || !a || !b) { skipped++; continue; }
    const direction = row.direction || 'undirected';
    const key = JSON.stringify([a, b, direction]);
    const g = groups.get(key) || { key, rows: [], cases: [], labels: [],
      basis: keys[c.left.source!]?.length || keys[c.right.source!]?.length ? 'Selected review keys' : 'Exact source rows', direction };
    g.rows.push(row);
    if (!g.cases.some(old => old.candidate === c.candidate)) g.cases.push(c);
    if (!g.labels.includes(row.relation)) g.labels.push(row.relation);
    groups.set(key, g);
  }
  return { groups: [...groups.values()].filter(g => g.labels.length > 1).sort((a, b) => b.labels.length - a.labels.length || b.rows.length - a.rows.length), skipped };
}
