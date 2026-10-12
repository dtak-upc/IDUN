/** Synthetic UI adapter. Never reads a lake or calls a model. */
export const snapshots = [
  {
    id: "s1",
    title: "Initial connections",
    date: "2026-07-01",
    model: "Example model A",
  },
  {
    id: "s2",
    title: "Geography extension",
    date: "2026-07-12",
    model: "Example model B",
  },
  {
    id: "s3",
    title: "Reviewed update",
    date: "2026-08-01",
    model: "Example model B",
  },
];
export const classes = [
  { id: "organization", label: "Organization", x: 130, y: 170 },
  { id: "city", label: "City", x: 420, y: 170 },
  { id: "district", label: "District", x: 715, y: 170 },
  { id: "municipality", label: "Municipality", x: 420, y: 395 },
];
export const properties = [
  {
    id: "operates",
    label: "OPERATES_IN",
    source: "organization",
    target: "city",
  },
  { id: "part", label: "PART_OF", source: "city", target: "district" },
  {
    id: "hq",
    label: "HEADQUARTERED_IN",
    source: "organization",
    target: "municipality",
  },
];
export type Fact = {
  id: string;
  property: string;
  subject: string;
  object: string;
  introduced: number;
  retired?: number;
  retirement?: "superseded" | "retracted";
  updatedPassage?: string;
  validFrom?: string;
  validTo?: string;
  passage: string;
};
export const facts: Fact[] = [
  {
    id: "f1",
    property: "operates",
    subject: "Northstar Cooperative",
    object: "Eastport",
    introduced: 0,
    retired: 2,
    retirement: "superseded",
    validFrom: "2026-01-01",
    validTo: "2026-08-01",
    passage: "Northstar has operated in Eastport since 1 January 2026.",
    updatedPassage:
      "Northstar operated in Eastport until the move on 1 August 2026.",
  },
  {
    id: "f2",
    property: "part",
    subject: "Eastport",
    object: "Coastal district",
    introduced: 1,
    passage:
      "Eastport belongs to the Coastal district. No validity date is stated.",
  },
  {
    id: "f3",
    property: "hq",
    subject: "Northstar Cooperative",
    object: "Eastport council record",
    introduced: 1,
    retired: 2,
    retirement: "retracted",
    passage:
      "The council record lists Northstar's headquarters in Eastport. No validity date is stated.",
    updatedPassage:
      "The headquarters assertion was explicitly withdrawn during review; its real-world validity dates remain unknown.",
  },
  {
    id: "f4",
    property: "operates",
    subject: "Northstar Cooperative",
    object: "Westhaven",
    introduced: 2,
    validFrom: "2026-08-01",
    passage: "Northstar moved its operations to Westhaven on 1 August 2026.",
  },
];
export function knownFacts(at: number, layers: number[]) {
  return facts
    .filter((f) => layers.includes(f.introduced) && f.introduced <= at)
    .map((f) => {
      const updateKnown =
        f.retired !== undefined &&
        f.retired <= at &&
        layers.includes(f.retired);
      return {
        ...f,
        retired: updateKnown ? f.retired : undefined,
        validTo: updateKnown ? f.validTo : undefined,
        passage: updateKnown ? f.updatedPassage || f.passage : f.passage,
        updatedPassage: undefined,
      };
    });
}
export function visibleFacts(at: number, layers: number[]) {
  return knownFacts(at, layers).filter((f) => f.retired === undefined);
}
export function validFacts(at: number, layers: number[], date: string) {
  // Superseded facts may still describe the past. Retracted claims are not answers.
  return knownFacts(at, layers).filter(
    (f) =>
      !(f.retired !== undefined && f.retirement === "retracted") &&
      f.validFrom &&
      f.validFrom <= date &&
      (!f.validTo || date < f.validTo),
  );
}
export function changeFor(
  property: string,
  at: number,
  base: number,
  layers: number[],
) {
  const ids = (n: number) =>
    visibleFacts(n, layers)
      .filter((f) => f.property === property)
      .map((f) => f.id)
      .sort();
  const now = ids(at),
    before = ids(base);
  if (!before.length && now.length) return "added";
  if (before.length && !now.length) return "withdrawn";
  return JSON.stringify(now) !== JSON.stringify(before)
    ? "changed"
    : "unchanged";
}
