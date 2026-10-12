import test from "node:test";
import assert from "node:assert/strict";
import { selectedChain, insidePolygon } from "./schemaSelection.ts";
const graph = {
  concepts: ["a", "b", "c", "d", "e", "f"].map((id) => ({ id })),
  relationships: [
    { id: "ab", source: "a", target: "b" },
    { id: "bc", source: "b", target: "c" },
    { id: "bd", source: "b", target: "d" },
    { id: "de", source: "d", target: "e" },
    { id: "ef", source: "e", target: "f" },
  ],
};
test("rectangle and concave lasso geometry include boundaries", () => {
  const square = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  assert.equal(insidePolygon({ x: 5, y: 5 }, square), true);
  assert.equal(insidePolygon({ x: 10, y: 5 }, square), true);
  assert.equal(insidePolygon({ x: 20, y: 5 }, square), false);
  assert.equal(
    insidePolygon({ x: 8, y: 8 }, [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 5, y: 5 },
      { x: 0, y: 10 },
    ]),
    false,
  );
});
test("unordered picks become an ordered reversible path", () => {
  const p = selectedChain(
    graph,
    { concepts: [], relationships: ["bc", "ab"] },
    "c",
  );
  assert.equal(p.start, "c");
  assert.deepEqual(p.steps, [
    { relationship: "bc", direction: "incoming", target: "b" },
    { relationship: "ab", direction: "incoming", target: "a" },
  ]);
});
test("selected concepts include their connecting edges; one concept starts an empty path", () => {
  assert.equal(
    selectedChain(graph, { concepts: ["c", "a", "b"], relationships: [] }).steps
      .length,
    2,
  );
  assert.deepEqual(
    selectedChain(graph, { concepts: ["b"], relationships: [] }),
    { start: "b", steps: [] },
  );
});
test("disconnected picks and foreign IDs are rejected without dropping picks", () => {
  for (const p of [
    { concepts: ["a", "f"], relationships: ["ab"] },
    { concepts: [], relationships: ["ab", "ef"] },
    { concepts: ["foreign"], relationships: [] },
  ])
    assert.throws(() => selectedChain(graph, p));
});
test("cycles preserve closing bindings; an explicitly selected self-edge remains usable", () => {
  const triangle = {
    concepts: graph.concepts,
    relationships: [
      ...graph.relationships,
      { id: "ca", source: "c", target: "a" },
    ],
  };
  const cycle = selectedChain(
    triangle,
    { concepts: ["a", "b", "c"], relationships: [] },
    "a",
  );
  assert.equal(cycle.steps.length, 3);
  assert.ok(cycle.steps.some((s) => s.target_binding !== undefined));

  const self = {
    concepts: [{ id: "a" }],
    relationships: [{ id: "aa", source: "a", target: "a" }],
  };
  assert.equal(
    selectedChain(self, { concepts: [], relationships: ["aa"] }).steps.length,
    1,
  );
});

test("a long connected selection retains every relationship without a four-step cap", () => {
  const concepts = Array.from({ length: 11 }, (_, i) => ({ id: `n${i}` }));
  const relationships = concepts
    .slice(1)
    .map((c, i) => ({ id: `e${i}`, source: concepts[i].id, target: c.id }));
  const result = selectedChain(
    { concepts, relationships },
    { concepts: [], relationships: relationships.map((e) => e.id).reverse() },
  );
  assert.equal(result.steps.length, 10);
  assert.equal(result.start, "n0");
  assert.equal(result.steps.at(-1)?.target, "n10");
});

test("branch selections preserve every edge and share explicit parent bindings", () => {
  const picked = {
    concepts: ["a", "b", "c", "d", "e", "f"],
    relationships: [],
  };
  const p = selectedChain(graph, picked, "b");
  assert.equal(p.start, "b");
  assert.equal(p.steps.length, 5);
  assert.deepEqual(
    p.steps.slice(0, 3).map((s) => s.parent),
    [-1, -1, -1],
  );
  assert.equal(p.steps[3].parent, 2);
  assert.equal(p.steps[4].parent, 3);
  assert.deepEqual(
    new Set(p.steps.map((s) => s.relationship)),
    new Set(graph.relationships.map((e) => e.id)),
  );
});

test("click picks use only explicit edges, including when parallel connections exist", () => {
  const graph = {
    concepts: [{ id: "a" }, { id: "b" }],
    relationships: [
      { id: "one", source: "a", target: "b" },
      { id: "two", source: "a", target: "b" },
    ],
  };
  const result = selectedChain(
    graph,
    { concepts: ["a", "b"], relationships: ["one"], explicitEdges: true },
    "a",
  );
  assert.deepEqual(
    result.steps.map((s) => s.relationship),
    ["one"],
  );
  assert.throws(
    () =>
      selectedChain(graph, {
        concepts: ["a", "b"],
        relationships: [],
        explicitEdges: true,
      }),
    /connected/,
  );
});

test("parallel edges bind the same endpoints instead of independent records", () => {
  const g = {
    concepts: [{ id: "a" }, { id: "b" }],
    relationships: [
      { id: "first", source: "a", target: "b" },
      { id: "second", source: "a", target: "b" },
    ],
  };
  const p = selectedChain(
    g,
    { concepts: [], relationships: ["first", "second"] },
    "a",
  );
  assert.equal(p.steps.length, 2);
  assert.equal(p.steps[1].parent, -1);
  assert.equal(p.steps[1].target_binding, 0);
});
