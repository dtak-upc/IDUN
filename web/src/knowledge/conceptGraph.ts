export type GraphClass = {
  id: string;
  label: string;
  attributes?: { name: string; datatype: string }[];
};
export type GraphProperty = {
  id: string;
  label: string;
  source?: string;
  target?: string;
  direction?: string;
  property_id?: string;
  count?: number;
  members?: string[];
};
export function groupConceptPreview(
  classes: GraphClass[],
  properties: GraphProperty[],
) {
  const groups = new Map<string, GraphClass>(),
    lookup = new Map<string, string>();
  for (const c of classes) {
    const key = c.label.trim().toLowerCase() || c.id;
    let group = groups.get(key);
    if (!group) {
      group = { ...c, attributes: [] };
      groups.set(key, group);
    }
    lookup.set(c.id, group.id);
    for (const a of c.attributes || [])
      if (
        !group.attributes!.some(
          (v) => v.name === a.name && v.datatype === a.datatype,
        )
      )
        group.attributes!.push(a);
  }
  const edges = new Map<string, GraphProperty>();
  for (const p of properties) {
    let source = lookup.get(p.source || "") || p.source,
      target = lookup.get(p.target || "") || p.target;
    if (p.direction !== "directed") [source, target] = [source, target].sort();
    const key = JSON.stringify([
      p.property_id || p.label,
      source,
      target,
      p.direction,
    ]);
    const old = edges.get(key);
    if (old) {
      old.count = (old.count || 0) + (p.count || 0);
      old.members!.push(p.id);
    } else edges.set(key, { ...p, source, target, members: [p.id] });
  }
  return { classes: [...groups.values()], properties: [...edges.values()] };
}
