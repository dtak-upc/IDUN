import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import './journey.css';
import {journeyStages,useJourneyNavigation} from './Navigation';
import {savedDemo} from '../mode';

export function DataJourneyButton({ stage, children, disabled = false }: {
  stage: string; children: ReactNode; disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null), trigger = useRef<HTMLButtonElement>(null);
  const title = useRef<HTMLHeadingElement>(null), id = useId();
  const navigation=useJourneyNavigation(),seenVisit=useRef<number|undefined>(undefined);
  useEffect(()=>{
    if(!navigation?.visit||navigation.visit.stage!==stage||seenVisit.current===navigation.visit.token)return;
    seenVisit.current=navigation.visit.token;
    navigation.consume(navigation.visit.token);
    if(!disabled)setOpen(true);
  },[navigation?.visit,stage,disabled]);
  useEffect(() => {
    if (!open || !dialog.current) return;
    const node = dialog.current, previous = document.body.style.overflow;
    node.showModal(); document.body.style.overflow = 'hidden'; title.current?.focus();
    return () => { node.close(); document.body.style.overflow = previous; trigger.current?.focus(); };
  }, [open]);
  return <><button ref={trigger} type="button" className="data-journey-trigger" disabled={disabled}
    aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)} title={`Inspect ${stage} inputs, scores and data`}>
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M4 8h16l-1.5 12h-13L4 8Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2M8 13h8M8 13v3m8-3v3"/><circle cx="8" cy="17" r="1"/><circle cx="16" cy="17" r="1"/></svg>
    <span>Data Journey</span><span className="data-journey-open" aria-hidden="true">↗</span>
  </button>{open && createPortal(<dialog ref={dialog} className="data-journey-dialog" aria-labelledby={id}
    onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const targets = [...e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),summary,[tabindex]:not([tabindex="-1"])')]
        .filter(node => node.getClientRects().length > 0);
      const index = targets.indexOf(document.activeElement as HTMLElement);
      if (index < 0 || (!e.shiftKey && index === targets.length - 1) || (e.shiftKey && index === 0)) {
        e.preventDefault(); (e.shiftKey ? targets.at(-1) : targets[0])?.focus();
      }
    }}
    onCancel={e => { e.preventDefault(); setOpen(false); }} onClick={e => { if (e.target === e.currentTarget) {
      const r=e.currentTarget.getBoundingClientRect(); if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setOpen(false);
    } }}>
    <div className="data-journey-dialog-heading"><div><span className="data-journey-eyebrow">YOUR WORKING DATA</span><h2 id={id} ref={title} tabIndex={-1}>Data Journey <span>· {stage}</span></h2><p>Inspect what arrived, what changed and what moves forward.</p></div>
      <button type="button" className="data-journey-close" onClick={() => setOpen(false)} aria-label="Close Data Journey"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </div>{navigation&&<div className="journey-navigation"><div><strong>{navigation.lakeName}</strong><small>Each stage keeps its own selected inputs and saved results.</small></div><nav aria-label="Follow the Data Journey">{journeyStages.filter(name=>!savedDemo||['Data Lake','Discovery','Integration'].includes(name)).map((name,index)=><button type="button" key={name} aria-current={name===stage?'step':undefined} onClick={()=>{if(name!==stage){setOpen(false);navigation.navigate(name);}}}><span className="journey-navigation-index" aria-hidden="true">{index+1}</span>{name}</button>)}</nav></div>}<div className="data-journey-dialog-content">{children}</div>
  </dialog>, document.body)}</>;
}
