export type Concept = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  sources: string[];
  x: number;
  y: number;
};
export type Source = {
  id: string;
  kind: "CSV" | "TXT";
  title: string;
  description: string;
  unresolved?: string;
};
export type Connection = {
  id: string;
  from: string;
  to: string;
  label: string;
  sourceIds: string[];
  evidence: string;
  caveat: string;
};
export type Proposal = {
  id: string;
  title: string;
  subtitle: string;
  concepts: string[];
  sourceIds: string[];
  grain: string;
  fields: string[];
  steps: string[];
  openQuestions: string[];
};
// Hand-authored interface example. Never derived from the active intake or a model run.
export const sources: Source[] = [
  {
    id: "S01",
    kind: "CSV",
    title: "Recorded conditions",
    description: "Raw condition descriptions and clinical context.",
  },
  {
    id: "S02",
    kind: "CSV",
    title: "Medication records",
    description: "Drug names, routes and recorded dose details.",
  },
  {
    id: "S03",
    kind: "TXT",
    title: "Care narrative",
    description:
      "Illustrative text discussing a condition, its treatment and subsequent course.",
  },
  {
    id: "S04",
    kind: "TXT",
    title: "Follow-up narrative",
    description:
      "Illustrative recovery observations and follow-up instructions.",
  },
  {
    id: "S05",
    kind: "CSV",
    title: "Observation records",
    description:
      "Measurements and observations that may contextualize a care episode.",
  },
  {
    id: "S06",
    kind: "TXT",
    title: "Unassigned clinical text",
    description: "A narrative with an overlapping clinical topic.",
    unresolved:
      "Topic overlap alone does not establish which care episode this document describes.",
  },
  {
    id: "S07",
    kind: "CSV",
    title: "Reference values",
    description: "A small table of reference ranges.",
    unresolved:
      "These appear to be general reference values, not observations about a particular episode.",
  },
  {
    id: "S08",
    kind: "TXT",
    title: "Administrative text",
    description: "Operational notes with no established clinical association.",
    unresolved:
      "No supported connection to the current concepts has been established.",
  },
];
export const concepts: Concept[] = [
  {
    id: "conditions",
    name: "Conditions",
    subtitle: "What is documented",
    description:
      "Condition descriptions provide candidate clinical concepts. Their relevance to a specific episode still needs supporting context.",
    sources: ["S01", "S03"],
    x: 20,
    y: 27,
  },
  {
    id: "medications",
    name: "Medications",
    subtitle: "What was prescribed",
    description:
      "Medication records can be related to conditions through narrative evidence. Co-occurrence alone does not establish a treatment relationship.",
    sources: ["S02", "S03"],
    x: 76,
    y: 27,
  },
  {
    id: "course",
    name: "Clinical course",
    subtitle: "How care progressed",
    description:
      "Narrative observations and tabular measurements may describe the same course of care. Conflicting context must remain visible.",
    sources: ["S03", "S05"],
    x: 20,
    y: 75,
  },
  {
    id: "followup",
    name: "Follow-up",
    subtitle: "What comes next",
    description:
      "Follow-up instructions add context about planned care. A recommendation does not prove an action happened.",
    sources: ["S04"],
    x: 76,
    y: 75,
  },
];
export const connections: Connection[] = [
  {
    id: "treatment",
    from: "conditions",
    to: "medications",
    label: "Treatment context",
    sourceIds: ["S01", "S02", "S03"],
    evidence:
      "The example narrative explicitly connects a documented condition to a treatment. That statement motivates a candidate relation between the two tables.",
    caveat:
      "A medication listed elsewhere in the episode must not inherit this relation without evidence.",
  },
  {
    id: "progress",
    from: "conditions",
    to: "course",
    label: "Course of care",
    sourceIds: ["S01", "S03", "S05"],
    evidence:
      "The example care narrative describes how the documented condition changed alongside observations.",
    caveat:
      "Temporal context and episode attribution are still required before materializing a result.",
  },
  {
    id: "continuity",
    from: "course",
    to: "followup",
    label: "Follow-up context",
    sourceIds: ["S03", "S04", "S05"],
    evidence:
      "The example follow-up narrative refers to the preceding course of care.",
    caveat: "Text about planned care must remain distinct from completed care.",
  },
];
export const proposals: Proposal[] = [
  {
    id: "treatments",
    title: "Conditions & treatments",
    subtitle: "Bring clinical intent into medication records.",
    concepts: ["conditions", "medications"],
    sourceIds: ["S01", "S02", "S03"],
    grain:
      "One supported condition–medication relationship within a care episode.",
    fields: ["Condition", "Medication", "Relationship", "Supporting evidence"],
    steps: [
      "Retrieve condition and medication candidates from raw tables.",
      "Find narrative statements connecting the candidates.",
      "Validate the relation and its episode context before creating a row.",
    ],
    openQuestions: [
      "Some co-occurring medications may have no stated indication.",
      "Episode attribution must be established without patient/admission identifiers.",
    ],
  },
  {
    id: "recovery",
    title: "Care & follow-up",
    subtitle: "Explore the course of care alongside next steps.",
    concepts: ["course", "followup"],
    sourceIds: ["S03", "S04", "S05"],
    grain:
      "One supported observation or follow-up statement within a care episode.",
    fields: [
      "Observation",
      "Care context",
      "Follow-up instruction",
      "Temporal status",
      "Supporting evidence",
    ],
    steps: [
      "Find observations and related narrative passages.",
      "Separate reported events from future instructions.",
      "Assemble compatible statements while retaining their source context.",
    ],
    openQuestions: [
      "A similar clinical topic can occur in a different episode.",
      "Instructions describe intended actions, not confirmed outcomes.",
    ],
  },
  {
    id: "medication-details",
    title: "Augmentation opportunities",
    subtitle: "Augment existing records with narrative detail.",
    concepts: ["conditions", "medications"],
    sourceIds: ["S01", "S02", "S03"],
    grain: "One supported attribute for a condition or medication record.",
    fields: [
      "Medication",
      "Attribute",
      "Extracted value",
      "Supporting evidence",
    ],
    steps: [
      "Identify eligible concepts and seed values from observed data.",
      "Locate candidate narrative details for those concepts.",
      "Attribute supported values to the record and retain the original evidence.",
    ],
    openQuestions: [
      "A narrative mention may not support filling every missing field.",
    ],
  },
];
export const activity = [
  {
    id: "a1",
    label: "Concepts emerged across tables and text",
    detail: "Four provisional concepts organize this illustrative collection.",
    target: "conditions",
    kind: "concept",
  },
  {
    id: "a2",
    label: "A narrative provides a bridge",
    detail: "Treatment context connects condition and medication sources.",
    target: "treatment",
    kind: "connection",
  },
  {
    id: "a3",
    label: "A useful dataset takes shape",
    detail:
      "A condition–treatment view can be proposed from the supported route.",
    target: "treatments",
    kind: "proposal",
  },
  {
    id: "a4",
    label: "Three sources remain unresolved",
    detail: "Unassigned and unrelated content stays available for inspection.",
    target: "unresolved",
    kind: "unresolved",
  },
] as const;
