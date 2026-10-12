import { PathStepCondition, type PathAttribute } from "./PathStepCondition";
import type { AttributeCondition } from "./AttributeQueryFilter";
export type VisualCondition =
  AttributeCondition | { all: AttributeCondition[] };
export const conditionList = (
  condition?: VisualCondition,
): AttributeCondition[] =>
  !condition ? [] : "all" in condition ? condition.all : [condition];
export const packConditions = (
  all: AttributeCondition[],
): VisualCondition | undefined =>
  all.length === 0 ? undefined : all.length === 1 ? all[0] : { all };
export function VisualConditions({
  index,
  target,
  attributes,
  condition,
  disabled,
  onChange,
}: {
  index: number;
  target: string;
  attributes: PathAttribute[];
  condition?: VisualCondition;
  disabled: boolean;
  onChange: (condition?: VisualCondition) => void;
}) {
  const all = conditionList(condition),
    prefix = index < 0 ? "Starting record" : `Step ${index + 1}`;
  return (
    <section
      className="kg-visual-conditions"
      aria-label={`${prefix} conditions`}
    >
      {all.length > 1 && (
        <p className="kg-condition-summary">
          <strong>Match all {all.length} conditions</strong>
          <small>Each applies to this same record.</small>
        </p>
      )}
      {all.map((c, i) => (
        <div className="kg-condition-card" key={i}>
          <small className="kg-condition-number">Condition {i + 1}</small>
          <PathStepCondition
            index={index}
            target={target}
            attributes={attributes}
            condition={c}
            disabled={disabled}
            labelPrefix={i ? `${prefix} condition ${i + 1}` : undefined}
            onChange={(value) =>
              onChange(
                packConditions(
                  all.flatMap((old, j) =>
                    j === i ? (value ? [value] : []) : [old],
                  ),
                ),
              )
            }
          />
        </div>
      ))}
      <button
        className="kg-condition-add"
        disabled={
          disabled ||
          !target ||
          !attributes.some((a) => a.concept === target) ||
          all.length >= 64
        }
        onClick={() =>
          onChange(
            packConditions([
              ...all,
              {
                attribute: "",
                operator: "present",
                value: "",
                mode: "exact",
                values: "original",
              },
            ]),
          )
        }
      >
        {all.length
          ? "+ Add another condition"
          : index < 0
            ? "+ Condition on starting record"
            : "+ Condition on reached record"}
      </button>
    </section>
  );
}
