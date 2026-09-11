import { test } from "node:test";
import assert from "node:assert/strict";
import { projectModelTable } from "./inputPolicy.ts";
test("model projection excludes identifier columns and preserves clinical values", () => {
  const source = {
    columns: ["subject_id", "diagnosis", " HADM_ID ", "age"],
    rows: [["123456", "example", "654321", "62"]],
    filename: "123456.csv",
    sourcePath: "patient/admission",
    annotations: ["hidden"],
  };
  assert.deepEqual(projectModelTable(source), {
    columns: ["diagnosis", "age"],
    rows: [["example", "62"]],
  });
  assert.equal(source.rows[0][0], "123456");
});
test("every duplicated identifier column is excluded, including a BOM", () => {
  assert.deepEqual(
    projectModelTable({
      columns: ["subject_id", "\uFEFFsubject_id", "hadm_id"],
      rows: [["1", "1", "2"]],
    }),
    { columns: [], rows: [[]] },
  );
});
test("ragged tables cannot shift identifiers into allowed fields", () => {
  assert.throws(
    () =>
      projectModelTable({
        columns: ["subject_id", "diagnosis"],
        rows: [["1"]],
      }),
    /resolved field counts/,
  );
});
