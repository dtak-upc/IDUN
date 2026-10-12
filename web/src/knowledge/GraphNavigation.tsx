import type { RefObject } from "react";
import type { Core } from "cytoscape";

export function GraphNavigation({
  getGraph,
  wide,
  onToggle,
  expandButton,
  expandLabel = "Expand graph",
  closeLabel = "Close expanded view · Esc",
  zoomInLabel = "Zoom in",
  zoomOutLabel = "Zoom out",
}: {
  getGraph: () => Core | undefined;
  wide: boolean;
  onToggle: () => void;
  expandButton: RefObject<HTMLButtonElement | null>;
  expandLabel?: string;
  closeLabel?: string;
  zoomInLabel?: string;
  zoomOutLabel?: string;
}) {
  function zoom(factor: number) {
    const g = getGraph();
    if (g)
      g.zoom({
        level: g.zoom() * factor,
        renderedPosition: { x: g.width() / 2, y: g.height() / 2 },
      });
  }
  function fit() {
    const g = getGraph();
    if (!g) return;
    g.resize();
    g.fit(undefined, 50);
    if (g.zoom() > 1.2) g.zoom(1.2);
    g.center();
  }
  return (
    <div className="kg-canvas-icon-tools">
      <button
        aria-label={zoomInLabel}
        title="Zoom in"
        onClick={() => zoom(1.2)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
      <button
        aria-label={zoomOutLabel}
        title="Zoom out"
        onClick={() => zoom(1 / 1.2)}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14" />
        </svg>
      </button>
      <button aria-label="Fit schema" title="Fit schema" onClick={fit}>
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" />
          <rect x="8" y="8" width="8" height="8" rx="1" />
        </svg>
      </button>
      <button
        ref={expandButton}
        aria-label={wide ? closeLabel : expandLabel}
        title={wide ? closeLabel : expandLabel}
        aria-expanded={wide}
        onClick={onToggle}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d={
              wide
                ? "M3 9h6V3m12 6h-6V3M3 15h6v6m12-6h-6v6"
                : "M9 3H3v6m12-6h6v6M3 15v6h6m6 0h6v-6"
            }
          />
        </svg>
      </button>
    </div>
  );
}
