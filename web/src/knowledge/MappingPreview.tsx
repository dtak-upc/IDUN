import {useEffect,useMemo,useRef,useState} from 'react';
import cytoscape,{type Core} from 'cytoscape';
import {mappingPreview,type MappingGraph,type MappingProposal} from './mappingPreviewModel';

export function MappingPreview({graph,proposal}:{graph:MappingGraph;proposal:MappingProposal}) {
  const host=useRef<HTMLDivElement>(null),cy=useRef<Core|undefined>(undefined);
  const [overlay,setOverlay]=useState(true);
  const elements=useMemo(()=>mappingPreview(graph,proposal),[graph,proposal]);
  useEffect(()=>{
    if(!host.current||!elements.length)return;
    const g=cytoscape({container:host.current,elements,layout:{name:'preset'},minZoom:.2,maxZoom:2.5,
      userZoomingEnabled:false,style:[
        {selector:'node',style:{label:'data(label)',shape:'round-rectangle',width:170,height:64,'background-color':'#3b4cca',color:'#fff','font-size':14,'font-weight':600,'text-valign':'center','text-wrap':'wrap','text-max-width':'155px'}},
        {selector:'node[kind="attribute"]',style:{shape:'ellipse','background-color':'#0f766e'}},
        {selector:'edge',style:{label:'data(label)','curve-style':'bezier','line-color':'#7c3aed','target-arrow-color':'#7c3aed',width:2,'font-size':12,'text-background-opacity':1,'text-background-padding':'4px'}},
        {selector:'edge[directed=1]',style:{'target-arrow-shape':'triangle'}},
        {selector:'edge[kind="proposal"]',style:{'line-style':'dashed','line-color':'#0d9488','target-arrow-color':'#0d9488',width:3}},
        {selector:'#proposal-source',style:{'text-margin-y':-18}},
        {selector:'#proposal-target',style:{'text-margin-y':18}},
      ]});cy.current=g;
    const fit=()=>{g.resize();g.fit(undefined,45);if(g.zoom()>1)g.zoom(1);g.center();};
    const observer=new ResizeObserver(fit);observer.observe(host.current);fit();
    const theme=()=>{const dark=document.documentElement.dataset.theme==='dark';g.style().selector('edge').style({'text-background-color':dark?'#172337':'#fff',color:dark?'#ede9fe':'#4c1d95'}).update();};
    theme();const watcher=new MutationObserver(theme);watcher.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    return()=>{observer.disconnect();watcher.disconnect();g.destroy();cy.current=undefined;};
  },[elements]);
  useEffect(()=>{cy.current?.edges('[kind="proposal"]').style('opacity',overlay?1:0);},[overlay,elements]);
  return <section className="kg-mapping-visual" aria-label="Proposed schema mapping">
    <header><div><strong>{overlay?'With proposed mapping':'Current structure'}</strong><p>Preview only · your saved graph has not changed</p></div><div className="kg-suggestion-actions"><button aria-pressed={overlay} onClick={()=>setOverlay(v=>!v)}>{overlay?'Hide proposed links':'Show proposed links'}</button><button onClick={()=>{cy.current?.fit(undefined,45);cy.current?.center();}}>Fit</button></div></header>
    <div ref={host} className="kg-mapping-canvas" role="img" aria-label={`${proposal.kind} ${proposal.family??'concept'} mapping comparison`}/>
    {!elements.length&&<p>These schema items are no longer available. Refresh the suggestion.</p>}
    <p className="kg-mapping-legend"><span>Solid violet: existing structure</span><span>Dashed teal: proposed correspondence</span></p>
    {proposal.family==='property'&&<p>Each row shows one existing relationship. {proposal.kind==='inverse'?'Crossed links compare the source of one relationship with the target of the other.':'Vertical links compare matching source and target roles.'} Repeated concept labels represent endpoint roles, not separate classes. These links do not assert class equivalence.</p>}
  </section>;
}
