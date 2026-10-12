import type {Snapshot,Link} from './snapshot';

// Receipts are derived only from stored artifacts, never from current local data.
export function integrationReceipt(s:Snapshot,id:string,query:URLSearchParams) {
  const plan=(s.plans||[s.plan]).find(p=>p.id===id);
  if(!plan)throw Error('Saved Integration run not found');
  const revision=plan.content_revision||`saved:${s.state.revision}:${id}`;
  if(query.get('revision')&&query.get('revision')!==revision)throw Error('Saved run changed. Reopen Data Journey.');
  const kind=query.get('kind')||'candidates',outcome=query.get('outcome')||'',relation=query.get('relation')||'';
  const offset=Math.max(0,Number(query.get('offset')||0));
  const decisions=new Map(plan.decisions.map(d=>[d.candidate,d]));
  const status=(candidate:string)=>{const v=decisions.get(candidate)?.status;return v&&['include','abstain','conflict'].includes(v)?v:'unreviewed';};
  const outcomes:Record<string,number>={include:0,abstain:0,conflict:0,unreviewed:0};
  plan.cases.forEach(c=>outcomes[status(c.candidate)]++);
  const groups=new Map<string,number>();plan.output.forEach(r=>groups.set(r.relation,(groups.get(r.relation)||0)+1));
  const lookup=new Map(plan.cases.map(c=>[c.candidate,c]));
  const items=kind==='tables'?plan.output.filter(r=>!relation||r.relation===relation).map(row=>{
    const c=lookup.get(row.candidate);return {...row,document_name:c?.document_name,
      left:{name:c?.left.name||'Source table',columns:row.left_columns,record:{record_id:row.left_record,cells:row.left_cells}},
      right:{name:c?.right.name||'Source table',columns:row.right_columns,record:{record_id:row.right_record,cells:row.right_cells}},paths:row.evidence};
  }):plan.cases.filter(c=>!outcome||status(c.candidate)===outcome).map(c=>({...c,status:status(c.candidate),decision:decisions.get(c.candidate)}));
  return {id,title:plan.title,revision,model:plan.model,materialized:plan.materialized,batch:plan.batch||{},
    input:plan.journey_input,parent_run_id:plan.parent_run_id,
    coverage:plan.coverage||{},outcomes,candidates:plan.cases.length,output_rows:plan.output.length,
    groups:[...groups].sort(([a],[b])=>a.localeCompare(b)).map(([relation,rows])=>({relation,rows})),curated:!!plan.curation?.length,
    page:{kind,total:items.length,offset,limit:12,items:items.slice(offset,offset+12)}};
}

export function savedLink(s:Snapshot,l:Link) {
  return {...l,table_name:s.sources[l.table]?.name||'Source table',text_name:s.sources[l.text]?.name||'Document',
    row_preview:s.sources[l.table]?.rows.find(r=>r.index===l.row_index)?.cells.join(' · ')||''};
}
