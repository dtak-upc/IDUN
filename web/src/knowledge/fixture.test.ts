import { test } from "node:test";
import assert from "node:assert/strict";
import { knownFacts, visibleFacts, validFacts, changeFor } from "./fixture.ts";
test("past snapshots do not reveal later evidence or validity end", () => {
  const old = knownFacts(0, [0, 1, 2]);
  assert.equal(old.length, 1);
  assert.equal(old[0].validTo, undefined);
  assert.equal(old[0].retired, undefined);
  assert.equal(old[0].passage.includes("August"), false);
});
test("a valid-time query can recover a superseded historical assertion", () => {
  assert.equal(
    visibleFacts(2, [0, 1, 2]).some((f) => f.id === "f1"),
    false,
  );
  assert.deepEqual(
    validFacts(2, [0, 1, 2], "2026-07-15").map((f) => f.id),
    ["f1"],
  );
  assert.deepEqual(
    validFacts(2, [0, 1, 2], "2026-08-01").map((f) => f.id),
    ["f4"],
  );
});
test("unknown validity is excluded rather than treated as timeless", () => {
  assert.equal(
    validFacts(1, [0, 1], "2026-07-15").some(
      (f) => f.id === "f2" || f.id === "f3",
    ),
    false,
  );
});
test("hidden update cannot change earlier claims", () => {
  const old = visibleFacts(2, [0, 1]);
  assert.equal(old.length, 3);
  assert.equal(old.find((f) => f.id === "f1")?.validTo, undefined);
});
test("run comparison detects a replacement even with equal counts", () => {
  assert.equal(changeFor("operates", 2, 0, [0, 1, 2]), "changed");
  assert.equal(changeFor("hq", 2, 1, [0, 1, 2]), "withdrawn");
  assert.equal(changeFor("part", 1, 0, [0, 1, 2]), "added");
});
test("no layers means no answers; earlier snapshots exclude new claims", () => {
  assert.equal(visibleFacts(2, []).length, 0);
  assert.equal(
    validFacts(0, [0, 1, 2], "2026-08-15").some((f) => f.id === "f4"),
    false,
  );
});
