import { useEffect, useState, type ReactNode } from 'react';
import { LakeProfile, type ProfileWorkflowState } from '../inference/LakeProfile';
import { InferenceReadiness } from '../inference/Readiness';
import { savedDemo, staticWorkspace } from '../mode';
import './workflow.css';
import {CandidatePairs} from '../inference/CandidatePairs';
import {ReviewScope} from '../inference/ReviewScope';
import {ProfileGraph} from '../inference/ProfileGraph';
import {DataJourneyButton} from '../journey/DataJourneyButton';
import {ScopeJourney} from '../journey/ScopeJourney';
import {SavedJourney} from '../journey/SavedJourney';

export function DataLakeWorkflow({ lakeId, lakeName, savedCount, queuedCount, children, onDiscover }: {
  lakeId: string; lakeName: string; savedCount: number; queuedCount: number;
  children: ReactNode; onDiscover: () => void;
}) {
  const storageKey = `idun:lake-workflow:${lakeId}`;
  const [step, setStep] = useState<'import' | 'profile' | 'explore' | 'review'>(() => {const saved=sessionStorage.getItem(storageKey);return saved==='profile'||saved==='explore'||saved==='review'?saved:'import';});
  const [profile, setProfile] = useState<ProfileWorkflowState>({ status: 'loading' });
  const [explorerOpened,setExplorerOpened]=useState(step==='explore');
  useEffect(() => { sessionStorage.setItem(storageKey, step); }, [storageKey, step]);
  const running = ['queued', 'running', 'cancelling'].includes(profile.jobStatus || '');
  const canProfile = savedCount > 0 || profile.status === 'ready' || running;
  const ready = profile.status === 'ready' && !running;
  return <section className="lake-workflow" aria-label="Data Lake workflow">
    <div className="lake-flow-heading journey-workspace-heading"><div><span className="eyebrow">DATA LAKE · {lakeName}</span>
      <h2>From Raw Files to Discovery</h2><p>Import your sources, understand their profiles, then explore where to look next.</p></div>
      <DataJourneyButton stage="Data Lake" disabled={!savedDemo&&!staticWorkspace&&!ready}>{savedDemo?<SavedJourney lakeId={lakeId}/>:<ScopeJourney lakeId={lakeId}/>}</DataJourneyButton></div>
    <nav className="lake-flow-steps" role="tablist" aria-label="Data Lake steps" onKeyDown={event => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      const tabs = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
      const index = tabs.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length-1 : (index+(event.key === 'ArrowRight' ? 1 : -1)+tabs.length)%tabs.length;
      event.preventDefault(); tabs[next]?.focus(); tabs[next]?.click();
    }}>
      <button role="tab" tabIndex={step === 'import' ? 0 : -1} id="lake-import-tab" aria-controls="lake-import-panel" aria-selected={step === 'import'} onClick={() => setStep('import')}><b>{savedCount ? '✓' : '01'}</b><span>Import<small>{savedCount ? `${savedCount} Saved Sources` : 'Add CSV and TXT Files'}</small></span></button>
      <button role="tab" tabIndex={step === 'profile' ? 0 : -1} id="lake-profile-tab" aria-controls="lake-profile-panel" aria-selected={step === 'profile'} disabled={!canProfile} onClick={() => setStep('profile')}><b>{ready ? '✓' : '02'}</b><span>Profile<small>{running ? 'Indexing In Progress' : ready ? 'Profile Ready' : profile.status === 'stale' ? 'Update Required' : 'Understand Your Sources'}</small></span></button>
      <button role="tab" id="lake-explore-tab" aria-controls="lake-explore-panel" tabIndex={step==='explore'?0:-1} aria-selected={step==='explore'} disabled={!ready||savedDemo} onClick={()=>{setExplorerOpened(true);setStep('explore');}}><b>03</b><span>Explore Links<small>Inspect and Select Candidate Pairs</small></span></button>
      <button role="tab" id="lake-review-tab" aria-controls="lake-review-panel" tabIndex={step==='review'?0:-1} aria-selected={step==='review'} disabled={!ready||savedDemo} onClick={()=>setStep('review')}><b>04</b><span>Review Scope<small>Confirm the Inference Boundary</small></span></button>
    </nav>
    <div className="lake-flow-summary" role="status">
      <span>{savedCount} saved sources · {queuedCount} staged files</span>
      <span>{running ? profile.phase || 'Indexing in progress' : profile.status === 'stale' ? 'Sources changed — refresh the profile' : ready ? `${profile.candidates ?? 0} profiled candidate pairs` : 'Profile not ready'}</span>
    </div>
    <div role="tabpanel" id="lake-import-panel" aria-labelledby="lake-import-tab" hidden={step !== 'import'}>
      {children}
      <div className="lake-flow-next"><p>Saved sources are ready for profiling. Staged files must be saved first.</p><button className="primary" disabled={!canProfile} onClick={() => setStep('profile')}>Continue to Profile →</button></div>
    </div>
    <div role="tabpanel" id="lake-profile-panel" aria-labelledby="lake-profile-tab" hidden={step !== 'profile'}>
      <LakeProfile onWorkflowState={setProfile} onBackToImport={() => setStep('import')} onExploreLinks={() => {setExplorerOpened(true);setStep('explore');}} onDiscover={onDiscover} />
      {ready && !savedDemo && <CandidatePairs revision={profile.revision} />}
      {!savedDemo && <details className="lake-flow-runtime"><summary>Model readiness and projected inputs</summary><InferenceReadiness /></details>}
    </div>
    <div role="tabpanel" id="lake-explore-panel" aria-labelledby="lake-explore-tab" hidden={step!=='explore'}>
      {ready&&!savedDemo&&explorerOpened?<ProfileGraph lakeId={lakeId} revision={profile.revision}/>:<p>Update the profile before exploring candidate links.</p>}
      <div className="lake-flow-next"><button className="primary" disabled={!ready||savedDemo} onClick={()=>setStep('review')}>Continue to Review Scope →</button></div>
    </div>
    <div role="tabpanel" id="lake-review-panel" aria-labelledby="lake-review-tab" hidden={step!=='review'}>{step==='review'&&ready&&!savedDemo&&<ReviewScope lakeId={lakeId} onDiscover={onDiscover}/>}</div>
  </section>;
}
