import type { Encoding, Preview } from "./types";
export function inspectInWorker(
  file: File,
  encoding: Encoding,
  signal: AbortSignal,
): Promise<Preview> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Cancelled", "AbortError"));
      return;
    }
    const worker = new Worker(new URL("./inspect.worker.ts", import.meta.url), {
      type: "module",
    });
    const cleanup = () => {
      worker.terminate();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      cleanup();
      reject(new DOMException("Cancelled", "AbortError"));
    };
    signal.addEventListener("abort", abort, { once: true });
    worker.onmessage = (event) => {
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else resolve(event.data.preview);
    };
    worker.onerror = () => {
      cleanup();
      reject(new Error("File preview failed. Retry inspection."));
    };
    worker.postMessage({ file, encoding });
  });
}
