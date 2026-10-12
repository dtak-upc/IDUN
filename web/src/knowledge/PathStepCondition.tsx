import type { AttributeCondition } from "./AttributeQueryFilter";
export type PathAttribute = {
  id: string;
  concept: string;
  name: string;
  datatype: string;
};
const labels: Record<string, string> = {
  eq: "Equals",
  contains: "Contains text",
  gt: "Greater than",
  gte: "At least",
  lt: "Less than",
  lte: "At most",
  present: "Has a value",
  missing: "Is null or blank",
};
export function PathStepCondition({
  index,
  target,
  attributes,
  condition,
  disabled,
  onChange,
  originalOnly = false,
  labelPrefix,
}: {
  index: number;
  target: string;
  attributes: PathAttribute[];
  condition?: AttributeCondition;
  disabled: boolean;
  originalOnly?: boolean;
  labelPrefix?: string;
  onChange: (c?: AttributeCondition) => void;
}) {
  const attribute = attributes.find((a) => a.id === condition?.attribute),
    numeric = [
      "integer",
      "int",
      "float",
      "double",
      "real",
      "decimal",
      "number",
      "numeric",
    ].includes(attribute?.datatype.toLowerCase() ?? ""),
    boolean = ["bool", "boolean"].includes(
      attribute?.datatype.toLowerCase() ?? "",
    ),
    unknown = ["unknown", "conflicting", ""].includes(
      attribute?.datatype.toLowerCase() ?? "",
    );
  const prefix = labelPrefix ?? (index < 0 ? "Starting record" : `Step ${index + 1}`);
  const operators = unknown
    ? ["present", "missing"]
    : numeric
      ? ["eq", "gt", "gte", "lt", "lte", "present", "missing"]
      : boolean
        ? ["eq", "present", "missing"]
        : ["eq", "contains", "present", "missing"];
  if (!condition)
    return (
      <div className="kg-path-condition">
        <button
          disabled={disabled || !target}
          onClick={() =>
            onChange({
              attribute: "",
              operator: "present",
              value: "",
              mode: "exact",
              values: "original",
            })
          }
        >
          {index < 0
            ? "+ Condition on starting record"
            : "+ Condition on reached record"}
        </button>
      </div>
    );
  return (
    <section
      className="kg-path-condition"
      aria-label={
        index < 0
          ? "Starting record attribute condition"
          : `Step ${index + 1} attribute condition`
      }
    >
      <div className="kg-step-intro">
        <strong>
          {index < 0
            ? "Condition on the starting record"
            : "Condition on this step’s reached record"}
        </strong>
        <button disabled={disabled} onClick={() => onChange(undefined)}>
          Remove condition
        </button>
      </div>
      <div className="kg-path-condition-fields">
        <label>
          Attribute
          <select
            aria-label={`${prefix} filter attribute`}
            value={condition.attribute}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...condition,
                attribute: e.target.value,
                operator: "present",
                value: "",
              })
            }
          >
            <option value="">Choose target attribute</option>
            {condition.attribute &&
              !attributes.some(
                (a) => a.id === condition.attribute && a.concept === target,
              ) && (
                <option value={condition.attribute}>
                  Attribute outside selected target
                </option>
              )}
            {attributes
              .filter((a) => a.concept === target)
              .map((a) => (
                <option value={a.id} key={a.id}>
                  {a.name} · {a.datatype}
                </option>
              ))}
          </select>
        </label>
        <label>
          Condition
          <select
            aria-label={`${prefix} attribute operator`}
            value={condition.operator}
            disabled={disabled || !attribute}
            onChange={(e) =>
              onChange({ ...condition, operator: e.target.value, value: "" })
            }
          >
            {operators.map((op) => (
              <option key={op} value={op}>
                {labels[op]}
              </option>
            ))}
          </select>
        </label>
        {!["present", "missing"].includes(condition.operator) && (
          <label>
            Value
            <input
              aria-label={`${prefix} attribute value`}
              maxLength={1000}
              value={condition.value}
              disabled={disabled}
              onChange={(e) =>
                onChange({ ...condition, value: e.target.value })
              }
            />
          </label>
        )}
        <label>
          Attribute matching
          <select
            aria-label={`${prefix} attribute matching`}
            value={condition.mode}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...condition,
                mode: e.target.value as AttributeCondition["mode"],
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
            aria-label={`${prefix} attribute values`}
            value={condition.values ?? "original"}
            disabled={disabled}
            onChange={(e) =>
              onChange({
                ...condition,
                values: e.target.value as AttributeCondition["values"],
              })
            }
          >
            <option value="original">Original values only</option>
            {!originalOnly && (
              <option value="reviewed">Include enabled reviewed claims</option>
            )}
          </select>
        </label>
      </div>
      <p className="kg-traversal-note">
        {index < 0
          ? "This condition applies only to the starting record."
          : `This condition applies only to the record reached at step ${index + 1}.`}{" "}
        Unavailable columns do not count as missing.{" "}
        {originalOnly
          ? "Values and attribute mappings come from the captured view."
          : "Reviewed claims retain provenance; unit-bearing numeric claims are excluded from numeric comparisons."}
      </p>
    </section>
  );
}
