export type WorkbenchView = "treatments" | "medication-details" | "recovery";
export type SourceRow = { id: string; cells: string[] };
export const sourceTables = [
  {
    id: "A",
    title: "Condition records",
    headers: ["Condition", "Type", "Reported signs"],
    rows: [
      { id: "A1", cells: ["MRSA infection", "Diagnosis", ""] },
      { id: "A2", cells: ["Acute kidney injury", "Diagnosis", ""] },
      { id: "A3", cells: ["Hypertension", "Diagnosis", ""] },
      { id: "A4", cells: ["Other infection", "Diagnosis", "fever, chills"] },
    ],
  },
  {
    id: "B",
    title: "Medication records",
    headers: ["Medication", "Route"],
    rows: [
      { id: "B1", cells: ["Vancomycin", "Intravenous"] },
      { id: "B2", cells: ["Lisinopril", "Oral"] },
    ],
  },
] satisfies {
  id: string;
  title: string;
  headers: string[];
  rows: SourceRow[];
}[];
export const documents = [
  {
    id: "D1",
    title: "Care narrative",
    text: "CLINICAL COURSE\n\nVancomycin was started for the documented MRSA infection.\nThe MRSA infection was accompanied by fever and chills.\nVancomycin was administered intravenously.\n\nREASSESSMENT\n\nAcute kidney injury developed during treatment; the team considered vancomycin a possible contributor.\nTreatment was reassessed as further observations became available.\n\nPLAN\n\nFollow-up with the care team was recommended.\nThe recommendation describes intended care, not a completed visit.",
  },
  {
    id: "D2",
    title: "Subsequent narrative",
    text: "SUBSEQUENT REVIEW\n\nA later note attributed the kidney injury to dehydration and did not confirm a drug reaction.\nThe differing interpretations remained unresolved in this illustrative record.",
  },
];
export type Evidence = {
  id: string;
  documentId: string;
  quote: string;
  start: number;
  end: number;
  stance: "Supporting" | "Competing";
  rows: string[];
};
const anchor = (
  id: string,
  documentId: string,
  quote: string,
  rows: string[],
  stance: Evidence["stance"] = "Supporting",
): Evidence => {
  const document = documents.find((d) => d.id === documentId)!;
  const start = document.text.indexOf(quote);
  if (start < 0) throw Error("Example quote does not exist in its source");
  return {
    id,
    documentId,
    quote,
    start,
    end: start + quote.length,
    rows,
    stance,
  };
};
export const evidence: Evidence[] = [
  anchor(
    "E1",
    "D1",
    "Vancomycin was started for the documented MRSA infection.",
    ["A1", "B1"],
  ),
  anchor(
    "E2",
    "D1",
    "Acute kidney injury developed during treatment; the team considered vancomycin a possible contributor.",
    ["A2", "B1"],
  ),
  anchor(
    "E3",
    "D2",
    "A later note attributed the kidney injury to dehydration and did not confirm a drug reaction.",
    ["A2", "B1"],
    "Competing",
  ),
  anchor(
    "E4",
    "D1",
    "The MRSA infection was accompanied by fever and chills.",
    ["A1"],
  ),
  anchor("E5", "D1", "Vancomycin was administered intravenously.", ["B1"]),
  anchor("E6", "D1", "Follow-up with the care team was recommended.", ["A1"]),
];
export type Assertion = {
  id: string;
  view: WorkbenchView;
  context: string;
  target: string;
  attribute: string;
  values: string[];
  state: "Supported" | "Conflicting" | "Unresolved";
  evidenceIds: string[];
  sourceRows: string[];
  explanation: string;
  seedRows?: string[];
};
export const assertions: Assertion[] = [
  {
    id: "R1",
    view: "treatments",
    context: "MRSA infection",
    target: "Vancomycin",
    attribute: "Relationship",
    values: ["Treats"],
    state: "Supported",
    evidenceIds: ["E1"],
    sourceRows: ["A1", "B1"],
    explanation:
      "The narrative explicitly states the treatment indication. The relation is scoped to this example context; co-occurrence by itself would not justify it.",
  },
  {
    id: "R2",
    view: "treatments",
    context: "Acute kidney injury",
    target: "Vancomycin",
    attribute: "Relationship",
    values: ["Possible adverse effect"],
    state: "Conflicting",
    evidenceIds: ["E2", "E3"],
    sourceRows: ["A2", "B1"],
    explanation:
      "One passage considers the medication a possible contributor; another attributes the injury to dehydration. Keep the relation uncertain and expose both interpretations.",
  },
  {
    id: "R3",
    view: "treatments",
    context: "Hypertension",
    target: "Lisinopril",
    attribute: "Relationship",
    values: [],
    state: "Unresolved",
    evidenceIds: [],
    sourceRows: ["A3", "B2"],
    explanation:
      "The raw records are present, but this example has no statement connecting them. No relation is asserted from medical plausibility or co-occurrence.",
  },
  {
    id: "R4",
    view: "medication-details",
    context: "MRSA infection",
    target: "Condition record",
    attribute: "Reported signs",
    values: ["fever", "chills"],
    state: "Supported",
    evidenceIds: ["E4"],
    sourceRows: ["A1"],
    seedRows: ["A4"],
    explanation:
      "Observed qualitative examples in the raw table supply candidate signs. The narrative supports two separate values for the target condition. This is a fixture illustration of augmentation, not an executed THOR result.",
  },
  {
    id: "R5",
    view: "medication-details",
    context: "Vancomycin",
    target: "Medication record",
    attribute: "Route",
    values: ["Intravenous"],
    state: "Supported",
    evidenceIds: ["E5"],
    sourceRows: ["B1"],
    explanation:
      "The narrative corroborates the existing route value; it is not counted as a newly filled cell or independent evidence from another source.",
  },
  {
    id: "R6",
    view: "recovery",
    context: "Care context",
    target: "Follow-up",
    attribute: "Temporal status",
    values: ["Recommended"],
    state: "Supported",
    evidenceIds: ["E6"],
    sourceRows: ["A1"],
    explanation:
      "The passage supports a recommendation. It does not establish that a follow-up visit took place. The source association is illustrative and not inferred from patient identifiers.",
  },
];
export const viewTitles: Record<WorkbenchView, string> = {
  treatments: "Conditions & treatments",
  "medication-details": "Augmentation details",
  recovery: "Care & follow-up",
};
export function highlightFor(item: Evidence, value?: string) {
  const local = value
    ? item.quote.toLowerCase().indexOf(value.toLowerCase())
    : -1;
  return local >= 0
    ? { start: item.start + local, end: item.start + local + value!.length }
    : { start: item.start, end: item.end };
}
