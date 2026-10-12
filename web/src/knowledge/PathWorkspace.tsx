import {useState} from 'react';
import {KnowledgeTraversal} from './KnowledgeTraversal';
import {TypedPathBuilder} from './TypedPathBuilder';
type Props=Parameters<typeof TypedPathBuilder>[0];
export function PathWorkspace(props:Props){const [mode,setMode]=useState('explore');return <section aria-label="Record path workspace"><div className="kg-task-tabs" aria-label="Path query modes"><button aria-pressed={mode==='explore'} onClick={()=>setMode('explore')}>Explore neighborhood</button><button aria-pressed={mode==='pattern'} onClick={()=>setMode('pattern')}>Build a typed path</button></div>{mode==='pattern'?<TypedPathBuilder {...props}/>:<KnowledgeTraversal {...props} revision={props.graph.revision}/>}</section>;}
