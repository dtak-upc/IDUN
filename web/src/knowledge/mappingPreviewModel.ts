export type MappingGraph = {
  concepts: {id:string;label:string}[];
  relationships: {id:string;label:string;source:string;target:string;direction:string}[];
  attributes?: {id:string;concept:string;name:string;datatype:string}[];
};
export type MappingProposal = {family?:string;source:string;target:string;kind:string};
type Element = {data:{id:string;label:string;kind:string;source?:string;target?:string;directed?:number};position?:{x:number;y:number}};

/** A comparison view: repeated endpoint roles are views of classes, not new classes. */
export function mappingPreview(graph:MappingGraph, proposal:MappingProposal):Element[] {
  const result:Element[]=[];
  const name=(id:string)=>graph.concepts.find(c=>c.id===id)?.label??'Unavailable concept';
  const node=(id:string,label:string,kind:string,x:number,y:number)=>result.push({data:{id,label,kind},position:{x,y}});
  const edge=(id:string,source:string,target:string,label:string,kind:string,directed=0)=>result.push({data:{id,source,target,label,kind,directed}});
  const family=proposal.family??'concept';
  if(family==='concept') {
    if(![proposal.source,proposal.target].every(id=>graph.concepts.some(c=>c.id===id)))return [];
    node('left',name(proposal.source),'concept',100,100);
    node('right',name(proposal.target),'concept',500,100);
    edge('proposal','left','right',proposal.kind==='subclass'?'subclass of':'equivalent class','proposal',Number(proposal.kind==='subclass'));
  } else if(family==='property') {
    const selected=[proposal.source,proposal.target].map(id=>graph.relationships.find(e=>e.id===id));
    if(selected.some(e=>!e))return [];
    selected.forEach((e,i)=>{
      if(!e)return;
      node(`${i}s`,name(e.source),'concept',100,80+i*210);
      node(`${i}t`,name(e.target),'concept',500,80+i*210);
      edge(`existing${i}`,`${i}s`,`${i}t`,e.label,'existing',Number(e.direction==='directed'));
    });
    const inverse=proposal.kind==='inverse';
    edge('proposal-source','0s',inverse?'1t':'1s','source role','proposal');
    edge('proposal-target','0t',inverse?'1s':'1t','target role','proposal');
  } else if(family==='attribute') {
    const selected=[proposal.source,proposal.target].map(id=>graph.attributes?.find(a=>a.id===id));
    if(selected.some(a=>!a))return [];
    selected.forEach((a,i)=>{
      if(!a)return;
      node(`${i}c`,name(a.concept),'concept',100+i*400,50);
      node(`${i}a`,`${a.name}\n${a.datatype}`,'attribute',100+i*400,220);
      edge(`owner${i}`,`${i}c`,`${i}a`,'attribute','existing');
    });
    edge('proposal','0a','1a','equivalent attribute','proposal');
  }
  return result;
}
