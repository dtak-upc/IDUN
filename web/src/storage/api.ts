let activeLake = "";
export function selectApiLake(id: string) { activeLake = id; }
export function apiUrl(path: string, lake = activeLake) {
  const global = /^\/(settings|health|lakes)(?:\/|$)/.test(path);
  return "/api/v1" + (lake && !global ? `/lakes/${encodeURIComponent(lake)}` : "") + path;
}
export type Job = {
  id: string;
  asset_id: string;
  name: string;
  path: string;
  status: string;
  size: number;
  received: number;
  records: number;
  version: string;
  error: string | null;
  encoding: string;
  dataset_id: string;
};
export async function api<T>(path: string, init?: RequestInit, lake = activeLake): Promise<T> {
  if (
    document
      .querySelector('meta[name="idun-mode"]')
      ?.getAttribute("content") === "showcase"
  ) {
    if (init?.method && init.method !== "GET")
      throw Error(
        "The public example is read-only. Request access for live inference.",
      );
    return (await import("../showcase/snapshot")).savedApi<T>(path);
  }
  let response: Response;
  try {
    response = await fetch(apiUrl(path, lake), init);
  } catch {
    throw Error(
      "Local storage is unavailable. Start the Python API with npm run api.",
    );
  }
  const data = await response.json().catch(() => ({
    error:
      "Local storage is unavailable. Start the Python API with npm run api.",
  }));
  if (!response.ok)
    throw Error(data.error || `Storage request failed (${response.status})`);
  return data;
}
export const post = <T>(path: string, data: unknown = {}) =>
  api<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
export async function ingest(
  file: File,
  path: string,
  id: string,
  encoding: string,
  datasetId: string,
  datasetName: string,
  signal: AbortSignal,
  progress: (n: number) => void,
) {
  const lake = activeLake;
  const read = <T>(path: string) => api<T>(path, undefined, lake);
  const send = <T>(path: string, data: unknown = {}) => api<T>(path, {method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(data)}, lake);
  const cancelled = () => new DOMException("Cancelled", "AbortError");
  const cancel = () => {
    void send("/jobs/" + id + "/cancel").catch(() => {});
  };
  if (signal.aborted) throw cancelled();
  signal.addEventListener("abort", cancel, { once: true });
  try {
    let job = await send<Job>("/jobs", {
      id,
      name: file.name,
      path,
      size: file.size,
      encoding,
      dataset_id: datasetId,
      dataset_name: datasetName,
    });
    if (signal.aborted) {
      cancel();
      throw cancelled();
    }
    if (["failed", "cancelled", "interrupted"].includes(job.status))
      job = await send<Job>("/jobs/" + id + "/retry", { encoding });
    if (job.status === "awaiting_upload") {
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const abort = () => {
          xhr.abort();
          reject(cancelled());
        };
        const cleanup = () => signal.removeEventListener("abort", abort);
        xhr.open("PUT", apiUrl("/jobs/" + id + "/raw", lake));
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            progress(Math.round((100 * e.loaded) / e.total));
        };
        xhr.onload = () => {
          cleanup();
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(Error("Upload failed. Inspect ingestion jobs or retry."));
        };
        xhr.onerror = () => {
          cleanup();
          reject(
            Error(
              "Upload connection failed. Retry when the local API is available.",
            ),
          );
        };
        xhr.onabort = cleanup;
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) {
          cleanup();
          reject(cancelled());
          return;
        }
        xhr.send(file);
      });
    }
    while (true) {
      if (signal.aborted) throw cancelled();
      job = await read<Job>("/jobs/" + id);
      if (job.status === "ready") {
        progress(100);
        return job;
      }
      if (["failed", "cancelled", "interrupted"].includes(job.status))
        throw Error(job.error || job.status);
      await new Promise<void>((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, 300);
        signal.addEventListener("abort", finish, { once: true });
      });
    }
  } finally {
    signal.removeEventListener("abort", cancel);
  }
}
