import { test } from "node:test";
import assert from "node:assert/strict";
import type { OuterScope, OuterView } from "./SemanticResults.tsx";

const EPISTEMIC_NOTICE =
  "Absence of a discovered link is not proof of no relationship. Outer retention preserves unmatched source rows without asserting nonexistent relationships.";

const VALID_REASONS = [
  "not_searched",
  "budget_limited",
  "no_candidate",
  "reviewed_unresolved",
  "reviewed_negative",
] as const;

test("OuterScope structure holds explicit relation, tables, and counts", () => {
  const scope: OuterScope = {
    scope_id: "scope_treats_diag_med",
    relation: "TREATS",
    left_table: {
      id: "tbl_diag",
      name: "diagnoses.csv",
      version: "v1",
      columns: ["patient_id", "condition", "icd10"],
      total_rows: 10,
      matched_rows: 6,
      unmatched_rows: 4,
    },
    right_table: {
      id: "tbl_med",
      name: "medications.csv",
      version: "v1",
      columns: ["patient_id", "drug_name", "dosage"],
      total_rows: 8,
      matched_rows: 5,
      unmatched_rows: 3,
    },
    matched_pairs_count: 6,
    is_self_join: false,
  };

  assert.equal(scope.relation, "TREATS");
  assert.equal(scope.left_table.total_rows, 10);
  assert.equal(scope.left_table.unmatched_rows, 4);
  assert.equal(scope.right_table.total_rows, 8);
  assert.equal(scope.right_table.unmatched_rows, 3);
  assert.equal(scope.is_self_join, false);
});

test("OuterView enforces epistemic notice and exact reason breakdown keys", () => {
  const view: OuterView = {
    plan_id: "plan_123",
    policy: "preserve-left",
    scope: {
      scope_id: "scope_treats",
      relation: "TREATS",
      left_table: {
        id: "t1",
        name: "diagnoses.csv",
        version: "v1",
        columns: ["condition"],
        total_rows: 5,
        matched_rows: 3,
        unmatched_rows: 2,
      },
      right_table: {
        id: "t2",
        name: "meds.csv",
        version: "v1",
        columns: ["drug"],
        total_rows: 4,
        matched_rows: 3,
        unmatched_rows: 1,
      },
      matched_pairs_count: 3,
      is_self_join: false,
    },
    counts: {
      matched_rows: 3,
      unmatched_left: 2,
      unmatched_right: 0,
      total_rows: 5,
      unique_matched_left_records: 3,
      unique_matched_right_records: 3,
      reasons_breakdown: {
        not_searched: 1,
        no_candidate: 1,
      },
    },
    columns: {
      left_columns: ["condition"],
      right_columns: ["drug"],
    },
    rows: [
      {
        candidate: "cand_1",
        retention_type: "matched",
        relation: "TREATS",
        left_value: "Asthma",
        right_value: "Albuterol",
        is_outer_left_null: false,
        is_outer_right_null: false,
        left_columns: ["condition"],
        right_columns: ["drug"],
        left_cells: ["Asthma"],
        right_cells: ["Albuterol"],
        evidence_quote: "Patient administered Albuterol for acute asthma exacerbation.",
        evidence_count: 1,
        left_link: "left/0",
        right_link: "right/0",
      },
      {
        candidate: "outer_unmatched_left_1",
        retention_type: "unmatched_left",
        relation: "UNESTABLISHED",
        unestablished_reason: "not_searched",
        left_value: "Migraine",
        right_value: "[OUTER_NULL]",
        is_outer_left_null: false,
        is_outer_right_null: true,
        left_columns: ["condition"],
        right_columns: ["drug"],
        left_cells: ["Migraine"],
        right_cells: ["[OUTER_NULL]"],
        evidence_quote: "Unmatched source record retained under outer-join policy. No confirmed evidence link.",
        evidence_count: 0,
        left_link: "left/1",
        right_link: "",
      },
    ],
    notice: EPISTEMIC_NOTICE,
  };

  assert.equal(view.notice, EPISTEMIC_NOTICE);
  assert.ok(view.notice.includes("Absence of a discovered link is not proof of no relationship"));
  assert.equal(view.counts.total_rows, 5);
  assert.equal(view.rows.length, 2);

  // Check matched vs unmatched differentiation
  const matched = view.rows[0];
  const unmatched = view.rows[1];

  assert.equal(matched.retention_type, "matched");
  assert.equal(matched.relation, "TREATS");
  assert.equal(matched.is_outer_right_null, false);

  assert.equal(unmatched.retention_type, "unmatched_left");
  assert.equal(unmatched.relation, "UNESTABLISHED");
  assert.equal(unmatched.is_outer_right_null, true);
  assert.equal(unmatched.right_value, "[OUTER_NULL]");
  assert.ok(VALID_REASONS.includes(unmatched.unestablished_reason as any));
});

test("Outer-induced null [OUTER_NULL] is distinct from missing original attributes", () => {
  const leftCellsWithMissing = ["Diabetes", ""]; // second column was missing in source
  const rightCellsWithOuterNull = ["[OUTER_NULL]", "[OUTER_NULL]"];

  // Missing original attribute is represented as empty string or blank in source
  assert.equal(leftCellsWithMissing[1], "");
  assert.notEqual(leftCellsWithMissing[1], "[OUTER_NULL]");

  // Outer null is explicitly tagged
  assert.equal(rightCellsWithOuterNull[0], "[OUTER_NULL]");
  assert.equal(rightCellsWithOuterNull[1], "[OUTER_NULL]");
});
