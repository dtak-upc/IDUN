import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertions,
  documents,
  evidence,
  sourceTables,
  highlightFor,
} from "./example.ts";
test("every evidence span resolves exactly to the original text and existing source rows", () => {
  const rowIds = new Set(sourceTables.flatMap((t) => t.rows.map((r) => r.id)));
  for (const e of evidence) {
    const d = documents.find((d) => d.id === e.documentId)!;
    assert.equal(d.text.slice(e.start, e.end), e.quote);
    assert(e.start >= 0 && e.end <= d.text.length);
    for (const id of e.rows) assert(rowIds.has(id));
  }
  for (const a of assertions) {
    for (const id of a.evidenceIds) assert(evidence.some((e) => e.id === id));
    for (const id of [...a.sourceRows, ...(a.seedRows ?? [])])
      assert(rowIds.has(id));
  }
});
test("selected multivalue maps to its exact span rather than the whole cell list", () => {
  const a = assertions.find((a) => a.id === "R4")!;
  assert.deepEqual(a.values, ["fever", "chills"]);
  const e = evidence.find((e) => e.id === a.evidenceIds[0])!;
  const d = documents.find((d) => d.id === e.documentId)!;
  for (const value of a.values) {
    const range = highlightFor(e, value);
    assert.equal(d.text.slice(range.start, range.end), value);
  }
});
test("conflicts retain competing evidence and unresolved records have no asserted value", () => {
  for (const a of assertions) {
    if (a.state === "Conflicting")
      assert(
        a.evidenceIds.some(
          (id) => evidence.find((e) => e.id === id)?.stance === "Competing",
        ),
      );
    if (a.state === "Unresolved") {
      assert.equal(a.evidenceIds.length, 0);
      assert.equal(a.values.length, 0);
    }
  }
});
test("example model-facing tables contain no patient/admission identifier columns", () => {
  for (const table of sourceTables)
    assert(
      table.headers.every(
        (h) => !["subject_id", "hadm_id"].includes(h.toLowerCase()),
      ),
    );
});
