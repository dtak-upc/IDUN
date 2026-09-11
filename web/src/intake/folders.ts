export type SourceFile = { file: File; relativePath: string };
// Minimal Entries API contract, also usable by deterministic traversal tests.
export type Entry = {
  name: string;
  isFile: boolean;
  isDirectory: boolean;
  file?: (
    resolve: (file: File) => void,
    reject: (error: DOMException) => void,
  ) => void;
  createReader?: () => {
    readEntries: (
      resolve: (entries: Entry[]) => void,
      reject: (error: DOMException) => void,
    ) => void;
  };
};
export type FolderCollection = {
  sources: SourceFile[];
  skipped: number;
  errors: string[];
};
export async function collectEntries(
  entries: Entry[],
  signal: AbortSignal,
): Promise<FolderCollection> {
  const result: FolderCollection = { sources: [], skipped: 0, errors: [] };
  const queue = entries.map((entry) => ({ entry, parent: "" }));
  while (queue.length) {
    signal.throwIfAborted();
    const { entry, parent } = queue.pop()!;
    const path = parent ? `${parent}/${entry.name}` : entry.name;
    try {
      if (entry.isFile && entry.file) {
        if (!/\.(csv|txt)$/i.test(entry.name)) {
          result.skipped++;
          continue;
        }
        const file = await new Promise<File>((resolve, reject) =>
          entry.file!(resolve, reject),
        );
        result.sources.push({ file, relativePath: path });
      } else if (entry.isDirectory && entry.createReader) {
        const reader = entry.createReader();
        // Chromium returns directory entries in batches (often at most 100).
        while (true) {
          signal.throwIfAborted();
          const batch = await new Promise<Entry[]>((resolve, reject) =>
            reader.readEntries(resolve, reject),
          );
          if (!batch.length) break;
          queue.push(...batch.map((child) => ({ entry: child, parent: path })));
        }
      }
    } catch (error) {
      if (signal.aborted) throw error;
      result.errors.push(
        `Could not read ${path}. Try selecting this folder again.`,
      );
    }
  }
  signal.throwIfAborted();
  result.sources.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
  return result;
}
export function collectDrop(
  data: DataTransfer,
  signal: AbortSignal,
): Promise<FolderCollection> {
  // Capture entries synchronously while the drop event still grants access.
  const items = Array.from(data.items).filter((item) => item.kind === "file");
  const entries = items
    .map((item) => item.webkitGetAsEntry?.())
    .filter(Boolean) as unknown as Entry[];
  if (entries.length) return collectEntries(entries, signal);
  return Promise.resolve({
    sources: Array.from(data.files).map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    })),
    skipped: 0,
    errors: [],
  });
}
export function folderSelection(files: FileList | File[]): FolderCollection {
  const sources = Array.from(files)
    .filter((file) => /\.(csv|txt)$/i.test(file.name))
    .map((file) => ({
      file,
      relativePath: file.webkitRelativePath || file.name,
    }));
  return { sources, skipped: files.length - sources.length, errors: [] };
}
