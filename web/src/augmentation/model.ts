export const sources = [
  {
    id: "N1",
    name: "Care narrative",
    text: "The infection was accompanied by fever and chills.\nThe medication was administered intravenously.\nFollow-up with the care team was recommended.",
  },
  {
    id: "N2",
    name: "Medication summary",
    text: "The medication route was recorded as oral.",
  },
  {
    id: "N3",
    name: "Independent observation",
    text: "Chills were also documented in the observation record.",
  },
];
export type Support = { source: string; start: number; end: number };
function span(source: string, quote: string): Support {
  const text = sources.find((s) => s.id === source)!.text;
  const start = text.indexOf(quote);
  if (start < 0) throw Error("Missing fixture quote");
  return { source, start, end: start + quote.length };
}
export type Claim = { value: string; support: Support[] };
export type Change = {
  id: string;
  record: string;
  field: string;
  original: string[];
  proposals: Claim[];
  contrary: Claim[];
  note: string;
};
export const changes: Change[] = [
  {
    id: "C1",
    record: "Condition record A1",
    field: "Reported signs",
    original: [],
    proposals: [
      { value: "fever", support: [span("N1", "fever")] },
      {
        value: "chills",
        support: [span("N1", "chills"), span("N3", "Chills")],
      },
    ],
    contrary: [],
    note: "Separate values are attributed to the target record. A value can keep support from an independent source when another is withdrawn.",
  },
  {
    id: "C2",
    record: "Medication record B1",
    field: "Route",
    original: ["Oral"],
    proposals: [
      {
        value: "Intravenous",
        support: [span("N1", "The medication was administered intravenously.")],
      },
    ],
    contrary: [
      {
        value: "Oral",
        support: [span("N2", "The medication route was recorded as oral.")],
      },
    ],
    note: "The proposed route differs from the original value. Review is required even if the contrary narrative is withdrawn; original data is never overwritten automatically.",
  },
  {
    id: "C3",
    record: "Care record A1",
    field: "Follow-up status",
    original: [],
    proposals: [
      {
        value: "Recommended",
        support: [span("N1", "Follow-up with the care team was recommended.")],
      },
    ],
    contrary: [],
    note: "A recommendation is not evidence that a visit occurred. The temporal meaning stays attached to the proposed value.",
  },
];
export function assess(change: Change, withdrawn: string[]) {
  const values = change.proposals.map((claim) => ({
    ...claim,
    active: claim.support.filter((s) => !withdrawn.includes(s.source)),
  }));
  const active = values.filter((v) => v.active.length > 0);
  const competing = change.contrary.flatMap((c) =>
    c.support.filter((s) => !withdrawn.includes(s.source)),
  );
  const differs = active.some(
    (c) => change.original.length > 0 && !change.original.includes(c.value),
  );
  const state = !active.length
    ? "Unsupported"
    : competing.length && active.length
      ? "Conflicting"
      : differs
        ? "Review required"
        : active.length < values.length
          ? "Partially supported"
          : "Supported";
  return {
    values,
    active,
    competing,
    state,
    reviewValues: [
      ...change.original,
      ...active
        .filter(
          (c) =>
            !change.original.includes(c.value) && !differs && !competing.length,
        )
        .map((c) => c.value),
    ],
  };
}
export type HistoryEvent = {
  id: number;
  kind: string;
  message: string;
  withdrawn: string[];
};
export function sameSelection(a: string[], b: string[]) {
  return a.length === b.length && a.every((id) => b.includes(id));
}
