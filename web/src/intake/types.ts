export type Encoding =
  "auto" | "utf-8" | "utf-16le" | "utf-16be" | "windows-1252";
export type Preview = {
  kind: "csv" | "text";
  encoding: string;
  sampled: boolean;
  bytesRead: number;
  records: string[][];
  text: string;
  delimiter: string;
  warnings: string[];
  digest?: string;
  columns: number;
  clippedCells: boolean;
  clippedRecords: boolean;
};
export type Asset = {
  id: string;
  file: File;
  sourcePath: string;
  encoding: Encoding;
  inspection: "queued" | "inspecting" | "ready" | "failed";
  preview?: Preview;
  error?: string;
  transfer:
    "idle" | "queued" | "uploading" | "uploaded" | "failed" | "cancelled";
  progress: number;
  transferError?: string;
};
export function sizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}
export function statusLabel(asset: Asset): string {
  if (asset.inspection === "failed") return "Needs attention";
  if (asset.inspection === "queued") return "Queued for preview";
  if (asset.inspection === "inspecting") return "Reading preview";
  return (
    {
      idle: "Ready to save",
      queued: "Save queued",
      uploading: "Uploading / indexing",
      uploaded: "Saved to local lake",
      failed: "Save failed",
      cancelled: "Stopped locally / cancellation requested",
    } as const
  )[asset.transfer];
}
