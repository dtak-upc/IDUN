type Plan = {
  cases: {candidate:string;left:{source?:string;name:string};right:{source?:string;name:string}}[];
  output: {candidate:string;relation:string}[];
  decisions?: {relations?:string[];path_decisions?:{relationship:string}[]}[];
};
type Table = {id:string;name:string};
type Conflict = {tables:Table[];labels:string[];candidates:string[]};
/** Labels cannot bypass the source-table boundary by reusing an existing target. */
export function relationshipMergeScope(plan: Plan, sources: string[], target?: string): {reason:string;tables:Table[];conflicts?:Conflict[]} {
  const selected=new Set(sources);
  if (target && (plan.output.some(r=>r.relation===target) || plan.decisions?.some(d=>d.relations?.includes(target) || d.path_decisions?.some(p=>p.relationship===target)))) selected.add(target);
  if (selected.size<2) return {reason:'',tables:[] as {id:string;name:string}[]};
  const cases=new Map(plan.cases.map(c=>[c.candidate,c]));
  const pairs=new Map<string,{id:string;name:string}[]>(),found=new Set<string>();
  const conflicts=new Map<string,Conflict>();
  for (const row of plan.output) {
    if (!selected.has(row.relation)) continue;
    const c=cases.get(row.candidate),a=c?.left.source,b=c?.right.source;
    if (!c || !a || !b) return {reason:'Cannot merge: source-table identity is unavailable for these relationships.',tables:[]};
    if (a===b) return {reason:'Cannot merge: relationships must connect two distinct source tables.',tables:[]};
    const tables=[{id:a,name:c.left.name},{id:b,name:c.right.name}].sort((a,b)=>a.id.localeCompare(b.id));
    const key=JSON.stringify(tables.map(t=>t.id));
    pairs.set(key,tables);found.add(row.relation);
    const conflict=conflicts.get(key) || {tables,labels:[],candidates:[]};
    if (!conflict.labels.includes(row.relation)) conflict.labels.push(row.relation);
    if (!conflict.candidates.includes(row.candidate)) conflict.candidates.push(row.candidate);
    conflicts.set(key,conflict);
  }
  if ([...selected].some(label=>!found.has(label))) return {reason:'Cannot merge: every relationship needs output rows with identifiable source tables.',tables:[]};
  if (pairs.size!==1) return {reason:'Cannot merge: these labels or the existing target span different source-table pairs. Keep them separate or edit a table-pair scope in the Knowledge Graph.',tables:[],conflicts:[...conflicts.values()]};
  return {reason:'',tables:[...pairs.values()][0]};
}
