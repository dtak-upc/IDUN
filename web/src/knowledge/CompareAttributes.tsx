import type { PathAttribute } from "./PathStepCondition";
export type Operand = {
  binding: number;
  attribute: string;
  mode: "exact" | "aligned";
  values: "original" | "reviewed";
};
export type Comparison = { left: Operand; right: Operand; operator: string };
export const comparisonFamily = (type: string) =>
  [
    "number",
    "numeric",
    "integer",
    "int",
    "float",
    "double",
    "real",
    "decimal",
  ].includes(type.toLowerCase())
    ? "number"
    : ["boolean", "bool"].includes(type.toLowerCase())
      ? "boolean"
      : ["string", "text", "varchar", "char"].includes(type.toLowerCase())
        ? "text"
        : "unknown";
export function CompareAttributes({
  roles,
  attributes,
  comparisons,
  disabled,
  onChange,
  focus,
}: {
  roles: { binding: number; concept: string; label: string }[];
  attributes: PathAttribute[];
  comparisons: Comparison[];
  disabled: boolean;
  onChange: (comparisons: Comparison[]) => void;
  focus: number;
}) {
  const update = (i: number, value: Comparison) =>
    onChange(comparisons.map((c, j) => (i === j ? value : c)));
  return (
    <section
      className="kg-value-comparisons"
      aria-label="Compare record attributes"
    >
      <h4>Compare attributes</h4>
      <p className="kg-traversal-note">
        Compare values on the start or a numbered step. All comparisons must
        match.
      </p>
      {comparisons.map((c, i) => (
        <div className="kg-condition-card" key={i}>
          <div className="kg-step-intro">
            <strong>Comparison {i + 1}</strong>
            <button
              disabled={disabled}
              onClick={() => onChange(comparisons.filter((_, j) => j !== i))}
            >
              Remove comparison
            </button>
          </div>
          {(["left", "right"] as const).map((side) => (
            <div className="kg-comparison-operand" key={side}>
              <strong>
                {side === "left" ? "First value" : "Compare with"}
              </strong>
              <label>
                Record
                <select
                  aria-label={`Comparison ${i + 1} ${side} record`}
                  disabled={disabled}
                  value={c[side].binding}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      [side]: {
                        ...c[side],
                        binding: Number(e.target.value),
                        attribute: "",
                      },
                    })
                  }
                >
                  {!roles.some((r) => r.binding === c[side].binding) && (
                    <option value={c[side].binding}>
                      Step removed — choose a record
                    </option>
                  )}
                  {roles.map((r) => (
                    <option key={r.binding} value={r.binding}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Attribute
                <select
                  aria-label={`Comparison ${i + 1} ${side} attribute`}
                  value={c[side].attribute}
                  disabled={disabled}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      operator: "eq",
                      [side]: { ...c[side], attribute: e.target.value },
                    })
                  }
                >
                  <option value="">Choose attribute</option>
                  {attributes
                    .filter(
                      (a) =>
                        a.concept ===
                          roles.find((r) => r.binding === c[side].binding)
                            ?.concept &&
                        comparisonFamily(a.datatype) !== "unknown",
                    )
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {a.datatype}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Attribute matching
                <select
                  aria-label={`Comparison ${i + 1} ${side} matching`}
                  value={c[side].mode}
                  disabled={disabled}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      [side]: {
                        ...c[side],
                        mode: e.target.value as Operand["mode"],
                      },
                    })
                  }
                >
                  <option value="exact">Exact attribute</option>
                  <option value="aligned">Reviewed equivalents</option>
                </select>
              </label>
              <label>
                Value source
                <select
                  aria-label={`Comparison ${i + 1} ${side} values`}
                  value={c[side].values}
                  disabled={disabled}
                  onChange={(e) =>
                    update(i, {
                      ...c,
                      [side]: {
                        ...c[side],
                        values: e.target.value as Operand["values"],
                      },
                    })
                  }
                >
                  <option value="original">Original values</option>
                  <option value="reviewed">Include reviewed claims</option>
                </select>
              </label>
            </div>
          ))}
          <label>
            Comparison
            <select
              aria-label={`Comparison ${i + 1} operator`}
              value={c.operator}
              disabled={disabled}
              onChange={(e) => update(i, { ...c, operator: e.target.value })}
            >
              {Object.entries({
                eq: "Equals",
                ne: "Does not equal",
                ...(comparisonFamily(
                  attributes.find((a) => a.id === c.left.attribute)?.datatype ??
                    "",
                ) === "number" &&
                comparisonFamily(
                  attributes.find((a) => a.id === c.right.attribute)
                    ?.datatype ?? "",
                ) === "number"
                  ? {
                      gt: "Greater than",
                      gte: "At least",
                      lt: "Less than",
                      lte: "At most",
                    }
                  : {}),
              }).map(([op, label]) => (
                <option key={op} value={op}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      ))}
      <button
        className="kg-condition-add"
        disabled={disabled || !roles.length || comparisons.length >= 64}
        onClick={() =>
          onChange([
            ...comparisons,
            {
              left: {
                binding: focus,
                attribute: "",
                mode: "exact",
                values: "original",
              },
              right: {
                binding: -1,
                attribute: "",
                mode: "exact",
                values: "original",
              },
              operator: "eq",
            },
          ])
        }
      >
        + Compare two attributes
      </button>
      <small className="kg-traversal-note">
        Missing values do not satisfy comparisons. Text equality is
        case-sensitive; numeric units are not converted.
      </small>
    </section>
  );
}
