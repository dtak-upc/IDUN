import Papa from "papaparse";
import type { Encoding, Preview } from "./types";
export const PREVIEW_BYTES = 256 * 1024;
export const HASH_BYTES = 4 * 1024 * 1024;

export async function inspectFile(
  file: File,
  preference: Encoding = "auto",
): Promise<Preview> {
  if (!/\.(csv|txt)$/i.test(file.name))
    throw new Error("Unsupported file type. Choose a CSV or TXT file.");
  if (!file.size)
    throw new Error(
      "This file is empty. Choose a file containing text or table records.",
    );
  const bytes = new Uint8Array(
    await file.slice(0, PREVIEW_BYTES).arrayBuffer(),
  );
  const sampled = file.size > bytes.length;
  let encoding: string = preference;
  if (preference === "auto") {
    encoding =
      bytes[0] === 255 && bytes[1] === 254
        ? "utf-16le"
        : bytes[0] === 254 && bytes[1] === 255
          ? "utf-16be"
          : "utf-8";
  }
  let decoded: string;
  try {
    decoded = new TextDecoder(encoding, { fatal: true }).decode(bytes, {
      stream: sampled,
    });
  } catch {
    throw new Error(
      "Could not decode this file. Choose a preview encoding below and retry.",
    );
  }
  if (/[\x00-\x08\x0e-\x1f]/.test(decoded))
    throw new Error(
      "The preview contains binary control bytes. Check the file or choose its text encoding.",
    );
  if (!decoded.trim())
    throw new Error(
      sampled
        ? "No readable content in the first 256 KiB. Full-file inspection is not available in this preview."
        : "This file contains only whitespace.",
    );
  const preview: Preview = {
    kind: /\.csv$/i.test(file.name) ? "csv" : "text",
    encoding,
    sampled,
    bytesRead: bytes.length,
    records: [],
    text: "",
    delimiter: "",
    warnings: [],
    columns: 0,
    clippedCells: false,
    clippedRecords: false,
  };
  if (sampled)
    preview.warnings.push(
      "Only the first 256 KiB were inspected. Later content has not been validated.",
    );
  if (preview.kind === "text") {
    preview.text = decoded.slice(0, 6000);
    if (decoded.length > 6000 || sampled)
      preview.warnings.push("Showing an excerpt of up to 6,000 characters.");
  } else {
    const parsed = Papa.parse<string[]>(decoded, {
      header: false,
      dynamicTyping: false,
      preview: 21,
      skipEmptyLines: false,
    });
    let rows = parsed.data;
    // A byte-limited sample can end inside a quoted record. Never show that final partial record.
    const partialLast = sampled && !parsed.meta.truncated;
    if (partialLast) rows = rows.slice(0, -1);
    const invalid = parsed.errors.filter(
      (e) =>
        e.code !== "UndetectableDelimiter" &&
        !(partialLast && e.row === parsed.data.length - 1),
    );
    if (invalid.length)
      throw new Error(`CSV preview could not be parsed: ${invalid[0].message}`);
    if (!rows.length)
      throw new Error(
        "No complete CSV record fits in the preview. Full-file inspection is needed.",
      );
    preview.delimiter = parsed.meta.delimiter;
    preview.columns = Math.max(...rows.map((row) => row.length));
    preview.clippedRecords =
      rows.length > 20 || sampled || parsed.meta.truncated;
    preview.clippedCells = rows.some(
      (row) => row.length > 12 || row.some((cell) => cell.length > 240),
    );
    preview.records = rows
      .slice(0, 20)
      .map((row) => row.slice(0, 12).map((cell) => cell.slice(0, 240)));
    if (parsed.errors.some((e) => e.code === "UndetectableDelimiter"))
      preview.warnings.push(
        "Delimiter could not be determined confidently; displayed as comma-separated records.",
      );
    if (rows.some((row) => row.length !== rows[0].length))
      preview.warnings.push(
        "Preview records have different field counts. No header or schema is assumed.",
      );
    if (preview.clippedCells)
      preview.warnings.push(
        "Display limited to 12 fields per record and 240 characters per field. Original files are unchanged.",
      );
    if (preview.clippedRecords)
      preview.warnings.push(
        "Showing up to 20 complete records. Later records have not been validated; this is not a full-file row count.",
      );
  }
  if (file.size <= HASH_BYTES) {
    const digest = await crypto.subtle.digest(
      "SHA-256",
      await file.arrayBuffer(),
    );
    preview.digest = Array.from(new Uint8Array(digest), (x) =>
      x.toString(16).padStart(2, "0"),
    ).join("");
  } else
    preview.warnings.push(
      "Exact-content comparison was not performed: this file exceeds 4 MiB.",
    );
  return preview;
}
