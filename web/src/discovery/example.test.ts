import { test } from "node:test";
import assert from "node:assert/strict";
import { concepts, connections, sources, proposals } from "./example.ts";
test("every concept, connection and proposal refers to existing example sources", () => {
  const ids = new Set(sources.map((s) => s.id));
  const conceptIds = new Set(concepts.map((c) => c.id));
  for (const c of concepts) for (const id of c.sources) assert(ids.has(id));
  for (const c of connections) {
    assert(conceptIds.has(c.from));
    assert(conceptIds.has(c.to));
    for (const id of c.sourceIds) assert(ids.has(id));
  }
  for (const p of proposals) {
    for (const id of p.sourceIds) assert(ids.has(id));
    for (const id of p.concepts) assert(conceptIds.has(id));
    assert(
      p.grain && p.fields.length && p.steps.length && p.openQuestions.length,
    );
  }
});
test("unresolved sources are not silently used as supported proposal sources", () => {
  const unresolved = new Set(
    sources.filter((s) => s.unresolved).map((s) => s.id),
  );
  assert.equal(unresolved.size, 3);
  for (const p of proposals)
    for (const id of p.sourceIds) assert(!unresolved.has(id));
});
