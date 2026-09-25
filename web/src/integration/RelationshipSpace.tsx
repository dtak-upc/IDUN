import { useEffect, useMemo, useRef, useState } from 'react';

type Pair = { candidate: string; point?: number[]; cluster: number; noise: boolean };
type Decision = { candidate: string; status: string; relations: string[] };
const initial = { yaw: -.5, pitch: .35, zoom: 1 };
const clampZoom = (value: number) => Math.max(.25, Math.min(8, value));

export function RelationshipSpace({ cases, decisions, focus, onSelect }: {
  cases: Pair[]; decisions: Decision[]; focus: string; onSelect: (id: string) => void;
}) {
  const [camera, setCamera] = useState(initial);
  const [separate, setSeparate] = useState(true);
  const plot = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = plot.current;
    if (!element) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientHeight : 1);
      const factor = Math.exp(-Math.max(-400, Math.min(400, pixels)) * .0015);
      setCamera(c => ({ ...c, zoom: clampZoom(c.zoom * factor) }));
    };
    // A non-passive listener keeps scrolling over the plot inside the camera.
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, []);
  const drag = useRef<{ x: number; y: number; moved: boolean; active: boolean } | null>(null);
  const valid = useMemo(() => cases.filter(c => c.point && c.point.length >= 2 &&
    c.point.slice(0, 3).every(Number.isFinite)), [cases]);
  const decisionMap = useMemo(() => new Map(decisions.map(d => [d.candidate, d])), [decisions]);
  const normalized = useMemo(() => {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const c of valid) for (let a = 0; a < 3; a++) {
      const v = c.point![a] ?? 0; lo[a] = Math.min(lo[a], v); hi[a] = Math.max(hi[a], v);
    }
    const centered = valid.map(c => ({ ...c, xyz: lo.map((v, a) => (c.point![a] ?? 0) - (v + hi[a]) / 2) }));
    const radius = centered.reduce((max, c) => Math.max(max, Math.hypot(...c.xyz)), 1e-9);
    return centered.map(c => ({ ...c, xyz: c.xyz.map(v => v / radius) }));
  }, [valid]);
  const project = ([x, y, z]: number[]) => {
    const rx = x * Math.cos(camera.yaw) + z * Math.sin(camera.yaw);
    const rz = z * Math.cos(camera.yaw) - x * Math.sin(camera.yaw);
    const ry = y * Math.cos(camera.pitch) - rz * Math.sin(camera.pitch);
    const depth = y * Math.sin(camera.pitch) + rz * Math.cos(camera.pitch);
    const perspective = 4 / (4 - depth);
    return { x: 240 + rx * 78 * camera.zoom * perspective, y: 145 - ry * 78 * camera.zoom * perspective, depth };
  };
  const projected = normalized.map(c => ({ ...c, ...project(c.xyz) }));
  const groups = new Map<string, typeof projected>();
  for (const p of projected) {
    const key = `${Math.round(p.x / 3)},${Math.round(p.y / 3)}`;
    const group = groups.get(key) || []; group.push(p); groups.set(key, group);
  }
  let overlaps = 0;
  for (const group of groups.values()) if (group.length > 1) {
    overlaps += group.length;
    if (separate) group.forEach((p, i) => {
      const angle = i * 2.399963; const radius = Math.min(48, 7 * Math.sqrt(i + 1));
      p.x += Math.cos(angle) * radius;
      p.y += Math.sin(angle) * radius;
    });
  }
  projected.sort((a, b) => Number(a.candidate === focus) - Number(b.candidate === focus) || a.depth - b.depth);
  const zoom = (factor: number) => setCamera(c => ({ ...c, zoom: clampZoom(c.zoom * factor) }));
  return <>
    <div className="space-toolbar">
      <strong>{valid.length} / {cases.length} pairs plotted</strong>
      <div><button type="button" aria-label="Zoom out relationship space" onClick={() => zoom(.8)}>−</button>
        <span aria-label="Relationship space zoom" style={{ alignSelf: 'center', minWidth: 34, textAlign: 'center' }}>{Math.round(camera.zoom * 100)}%</span>
        <button type="button" aria-label="Zoom in relationship space" onClick={() => zoom(1.25)}>+</button>
        <button type="button" onClick={() => setCamera(initial)}>Reset view</button></div>
    </div>
    <div className="semantic-map relationship-space-3d">
      <svg ref={plot} viewBox="0 0 480 290" role="group" aria-label="3D relationship space" tabIndex={0}
        onKeyDown={e => {
          if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
          e.preventDefault(); setCamera(c => ({ ...c, yaw: c.yaw + (e.key === 'ArrowLeft' ? -.12 : e.key === 'ArrowRight' ? .12 : 0), pitch: c.pitch + (e.key === 'ArrowUp' ? .12 : e.key === 'ArrowDown' ? -.12 : 0) }));
        }}
        onPointerDown={e => { if (e.button !== 0) return; drag.current = { x: e.clientX, y: e.clientY, moved: false, active: true }; }}
        onPointerMove={e => {
          const d = drag.current; if (!d?.active) return;
          const dx = e.clientX - d.x, dy = e.clientY - d.y;
          if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
          d.moved = true; d.x = e.clientX; d.y = e.clientY;
          e.currentTarget.setPointerCapture(e.pointerId);
          setCamera(c => ({ ...c, yaw: c.yaw + dx * .008, pitch: c.pitch + dy * .008 }));
        }}
        onPointerUp={e => { if (drag.current) drag.current.active = false; if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); }}
        onPointerCancel={() => { drag.current = null; }}
        onClick={() => { drag.current = null; }}>
        {['X', 'Y', 'Z'].map((label, axis) => {
          const start = [0, 0, 0], end = [0, 0, 0];
          start[axis] = -1.15; end[axis] = 1.15;
          const p = project(start), q = project(end);
          return <g key={label} className="space-axis" pointerEvents="none" aria-hidden="true">
            <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} stroke="#52718c" strokeWidth="1" strokeOpacity=".45" strokeDasharray="5 5" />
            <text x={q.x + 6} y={q.y - 6} fill="#94a3b8" fillOpacity=".7" fontSize="10">{label}</text>
          </g>;
        })}
        {projected.map(p => {
          const d = decisionMap.get(p.candidate), selected = p.candidate === focus;
          return <circle key={p.candidate} className={`space-point ${d?.status || ''} ${selected ? 'selected' : ''}`}
            cx={p.x} cy={p.y} r={selected ? 6 : 4} role="button" tabIndex={0}
            aria-label={`Review pair ${p.candidate}`} aria-pressed={selected}
            onClick={e => { if (!drag.current?.moved) onSelect(p.candidate); e.stopPropagation(); drag.current = null; }}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(p.candidate); } }}>
            <title>{p.candidate} · cluster {p.cluster}{p.noise ? ' · singleton/noise' : ''} · {d?.relations.join(', ') || d?.status || 'unreviewed'}</title>
          </circle>;
        })}
      </svg>
      {!cases.length && <span className="space-empty">No reviewed pairs in this run.</span>}
    </div>
    <div className="space-toolbar"><label><input type="checkbox" checked={separate} onChange={e => setSeparate(e.target.checked)} /> Separate overlaps</label>
      <span>{overlaps} overlapping points</span></div>
    <label className="space-pair-picker">Select any pair
      <select aria-label="Select relationship pair" value={cases.some(c => c.candidate === focus) ? focus : ''} onChange={e => { if(e.target.value) onSelect(e.target.value); }}>
        <option value="">Choose a pair…</option>
        {cases.map(c => <option key={c.candidate} value={c.candidate}>{c.candidate} · {decisionMap.get(c.candidate)?.relations.join(', ') || decisionMap.get(c.candidate)?.status || 'unreviewed'}</option>)}
      </select>
    </label>
    <div className="space-legend"><span><i className="include" />Included</span><span><i className="conflict" />Conflicting</span><span><i />Withheld / unreviewed</span></div>
    <small>Drag or use arrow keys to rotate. Scroll to zoom; reset to fit the view. Select a point to review its evidence. Each point represents a reviewed row pair; position is a projection, not a relation score. Overlap separation only offsets markers on screen.</small>
    {valid.some(c => c.point!.length < 3) && <small>Legacy 2D coordinates are shown on a plane; a new integration run produces 3D coordinates.</small>}
    {valid.length < cases.length && <small>{cases.length - valid.length} pairs have no valid coordinates; select them from the list above.</small>}
  </>;
}
