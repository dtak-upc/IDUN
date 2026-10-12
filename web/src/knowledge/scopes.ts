export type GraphScopes = { visible: string[]; query: string[] };
export function restoreScopes(value: unknown, available: string[]): GraphScopes {
  const fallback = available.slice(0,1);
  if (!value || typeof value !== 'object') return {visible:fallback,query:[...fallback]};
  const input=value as Partial<GraphScopes>;
  const valid=(list:unknown) => Array.isArray(list) ? [...new Set(list.filter((id):id is string=>typeof id==='string'&&available.includes(id)))] : [...fallback];
  return {visible:valid(input.visible),query:valid(input.query)};
}
export function toggleScope(list:string[],id:string,enabled:boolean):string[] {
  return enabled ? [...new Set([...list,id])] : list.filter(v=>v!==id);
}
export function excludeFromViews(scopes:GraphScopes,id:string):GraphScopes {
  return {visible:scopes.visible.filter(run=>run!==id),query:scopes.query.filter(run=>run!==id)};
}
export function applyRecordSelection(scopes:GraphScopes,ids:string[]):GraphScopes {
  return {visible:[...new Set([...scopes.visible,...ids])],query:[...new Set(ids)]};
}
