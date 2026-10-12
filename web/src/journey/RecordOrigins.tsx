import {useSourcePeek} from './SourcePeek';

type RecordSource={name:string;reference?:string};
export function recordOrigin(record:RecordSource) {
  // References are source ID : saved version : original record index.
  // Never infer identity from a filename or replace a missing saved version.
  const match=record.reference?.match(/^(.+):([^:]+):(\d+)$/);
  if(!match)return undefined;
  const row=Number(match[3]);
  if(!Number.isSafeInteger(row)||row<2||!match[1])return undefined;
  return {id:match[1],version:match[2],row,name:`${record.name} · Row ${row}`};
}

export function RecordOrigins({lakeId,context,records}:{lakeId:string;context:string;records:RecordSource[]}) {
  const peek=useSourcePeek(lakeId,context+JSON.stringify(records));
  const origins=records.map(record=>({record,origin:recordOrigin(record)}));
  return <section className="journey-record-origins" aria-label="Trace source records">
    <div className="journey-origin-actions"><strong>Source records</strong>{origins.map(({record,origin},i)=>origin?<span key={i}>{peek.link(origin)}</span>:<small key={i}>{record.name} · source revision unrecorded</small>)}</div>
    <small>Inspect the saved source version without changing this result or its processing scope.</small>
    {peek.view}
  </section>;
}
