export type PickedSchema = {
  concepts: string[];
  relationships: string[];
  explicitEdges?: boolean;
};
type Edge = { id: string; source: string; target: string };
type Graph = { concepts: { id: string }[]; relationships: Edge[] };
export function insidePolygon(
  point: { x: number; y: number },
  points: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[i],
      b = points[j],
      cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (
      Math.abs(cross) < 0.001 &&
      point.x >= Math.min(a.x, b.x) &&
      point.x <= Math.max(a.x, b.x) &&
      point.y >= Math.min(a.y, b.y) &&
      point.y <= Math.max(a.y, b.y)
    )
      return true;
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function selectedChain(
  graph: Graph,
  picked: PickedSchema,
  preferred = "",
): {
  start: string;
  steps: {
    relationship: string;
    direction: "outgoing" | "incoming";
    target: string;
    parent?: number;
    target_binding?: number;
  }[];
} {
  const concepts = new Set(picked.concepts),
    ids = new Set(picked.relationships);
  if (
    [...concepts].some((id) => !graph.concepts.some((c) => c.id === id)) ||
    [...ids].some((id) => !graph.relationships.some((e) => e.id === id))
  )
    throw new Error("Selection changed. Pick from the current schema again.");
  const edges = graph.relationships.filter(
    (e) =>
      ids.has(e.id) ||
      (!picked.explicitEdges &&
        e.source !== e.target &&
        concepts.has(e.source) &&
        concepts.has(e.target)),
  );
  if (!edges.length) {
    if (concepts.size === 1) return { start: [...concepts][0], steps: [] };
    throw new Error("Pick a connected chain of concepts and relationships.");
  }
  const adjacent = new Map<string, Edge[]>();
  for (const e of edges)
    for (const node of [e.source, e.target])
      adjacent.set(node, [...(adjacent.get(node) || []), e]);
  if ([...concepts].some((id) => !adjacent.has(id)))
    throw new Error(
      "Selection includes disconnected concepts. Remove them or select one connected path.",
    );
  if (edges.length === 1 && edges[0].source === edges[0].target)
    return {
      start: edges[0].source,
      steps: [
        {
          relationship: edges[0].id,
          direction: "outgoing" as const,
          target: edges[0].target,
        },
      ],
    };
  if (preferred && !adjacent.has(preferred))
    throw new Error("Choose a starting concept within the selection.");
  const ends = [...adjacent.keys()]
    .filter((n) => adjacent.get(n)!.length === 1)
    .sort();
  const start = preferred || ends[0] || [...adjacent.keys()].sort()[0];
  const bindings = new Map<string, number>([[start, -1]]);
  const visited = new Set([start]),
    used = new Set<string>();
  const steps: {
    relationship: string;
    direction: "outgoing" | "incoming";
    target: string;
    parent?: number;
    target_binding?: number;
  }[] = [];
  const queue = [{ concept: start, parent: -1 }];
  for (let q = 0; q < queue.length; q++) {
    const current = queue[q];
    for (const edge of adjacent.get(current.concept) || []) {
      if (used.has(edge.id)) continue;
      used.add(edge.id);
      const direction =
        edge.source === current.concept ? "outgoing" : "incoming";
      const target = direction === "outgoing" ? edge.target : edge.source;
      const bound = bindings.get(target);
      visited.add(target);
      const index = steps.length;
      steps.push({
        relationship: edge.id,
        direction,
        target,
        parent: current.parent,
        ...(bound !== undefined ? { target_binding: bound } : {}),
      });
      if (bound === undefined) {
        bindings.set(target, index);
        queue.push({ concept: target, parent: index });
      }
    }
  }
  if (used.size !== edges.length)
    throw new Error(
      "Selection contains disconnected groups. Select one connected query.",
    );
  // Keep the existing linear payload when every step continues the preceding one.
  const branching = steps.some(
    (s, i) => s.parent !== i - 1 || s.target_binding !== undefined,
  );
  return {
    start,
    steps: branching ? steps : steps.map(({ parent, ...s }) => s),
  };
}
