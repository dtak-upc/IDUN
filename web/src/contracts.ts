/**
 * Versioned neutral contracts for IDUN Stage 10.DA (Iteration DA-01).
 */
export const CONTRACT_VERSION = "idun-contracts-v1";
export const LEGACY_VERSION_V5_1 = "semantic-joins-v5.1";

export type Direction = "A_TO_B" | "B_TO_A" | "SYMMETRIC" | "UNSPECIFIED";
export type Basis = "text_supported" | "inferred" | "insufficient";
export type SupportState = "include" | "abstain" | "conflict";

export type RecordRef = {
  source: string;
  record_id: string;
  row_index: number;
  columns: string[];
  cells: string[];
  name?: string;
  version?: string;
  anchor_column?: number;
  summary?: string;
};

export type EvidencePath = {
  evidence_id: string;
  left_link: string;
  right_link: string;
  start: number;
  end: number;
  text: string;
  score: number;
  context_start?: number;
  context_end?: number;
  context_text?: string;
  ce_score?: number;
  anchors?: { left: string; right: string; start: number; end: number }[];
};

export type PairCandidate = {
  candidate_id: string;
  record_a: RecordRef;
  record_b: RecordRef;
  document: string;
  document_name: string;
  paths: EvidencePath[];
  score: number;
  cluster?: number;
  noise?: boolean;
  point?: number[];
};

export type RelationDecision = {
  evidence_id: string;
  relationship: string;
  direction: Direction;
  basis: Basis;
  reason: string;
  quote_a: string;
  quote_b: string;
};

export type CaseDecision = {
  candidate_id: string;
  status: SupportState;
  relations: string[];
  reason: string;
  validation: string;
  path_decisions: RelationDecision[];
};
