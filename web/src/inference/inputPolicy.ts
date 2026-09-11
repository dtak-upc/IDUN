/** Model inputs must be projected from source data, never spread from UI assets.
 * This helper excludes identifier columns and all unlisted source metadata.
 * Backend adapters must apply the same contract before any embeddings/inference.
 */
export const HIDDEN_MODEL_COLUMNS = new Set(["subject_id", "hadm_id"]);
export type ParsedTable = { columns: string[]; rows: string[][] };
export function projectModelTable(source: ParsedTable): ParsedTable {
  const included = source.columns
    .map((column, index) => ({ column, index }))
    .filter(
      ({ column }) =>
        !HIDDEN_MODEL_COLUMNS.has(
          column
            .replace(/^\uFEFF/, "")
            .trim()
            .toLowerCase(),
        ),
    );
  if (source.rows.some((row) => row.length !== source.columns.length))
    throw new Error("Model projection requires resolved field counts.");
  return {
    columns: included.map(({ column }) => column),
    rows: source.rows.map((row) => included.map(({ index }) => row[index])),
  };
}
