import { test } from "node:test";
import assert from "node:assert/strict";
import { changes, sources, assess } from "./model.ts";
test("withdrawal removes only unsupported values and retains independent support", () => {
  const r = assess(changes[0], ["N1"]);
  assert.equal(r.state, "Partially supported");
  assert.deepEqual(r.reviewValues, ["chills"]);
  assert.equal(r.values[0].active.length, 0);
  assert.equal(r.values[1].active[0].source, "N3");
});
test("withdrawing all support leaves original data intact and restoration is reversible", () => {
  assert.deepEqual(assess(changes[1], ["N1", "N2", "N3"]).reviewValues, [
    "Oral",
  ]);
  assert.equal(assess(changes[0], ["N1", "N3"]).state, "Unsupported");
  assert.deepEqual(assess(changes[0], []).reviewValues, ["fever", "chills"]);
});
test("contradiction is not auto-resolved by removing contrary narrative", () => {
  assert.equal(assess(changes[1], []).state, "Conflicting");
  assert.equal(assess(changes[1], ["N2"]).state, "Review required");
  assert.deepEqual(assess(changes[1], ["N2"]).reviewValues, ["Oral"]);
});
test("all fixture spans resolve to nonempty source text within bounds", () => {
  for (const c of changes)
    for (const v of [...c.proposals, ...c.contrary])
      for (const s of v.support) {
        const text = sources.find((d) => d.id === s.source)!.text;
        assert.ok(s.start >= 0 && s.end > s.start && s.end <= text.length);
        assert.ok(text.slice(s.start, s.end).trim());
      }
});
