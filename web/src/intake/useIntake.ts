import { useEffect, useRef, useState } from "react";
import type { Asset, Encoding } from "./types";
import { inspectInWorker } from "./services";
import { ingest } from "../storage/api";
export function useIntake() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [notice, setNotice] = useState("");
  const [datasetId, setDatasetId] = useState(() => crypto.randomUUID());
  const [datasetName, setDatasetName] = useState("Manual import");
  const work = useRef(new Map<string, AbortController>());
  const uploads = useRef(new Map<string, AbortController>());
  const update = (id: string, change: Partial<Asset>) =>
    setAssets((current) =>
      current.map((a) => (a.id === id ? { ...a, ...change } : a)),
    );
  useEffect(() => {
    for (const asset of assets) {
      if (
        asset.inspection === "queued" &&
        !work.current.has(asset.id) &&
        work.current.size < 2
      ) {
        const controller = new AbortController();
        work.current.set(asset.id, controller);
        update(asset.id, { inspection: "inspecting" });
        inspectInWorker(asset.file, asset.encoding, controller.signal)
          .then((preview) => {
            if (!controller.signal.aborted)
              update(asset.id, {
                inspection: "ready",
                preview,
                error: undefined,
              });
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              update(asset.id, { inspection: "failed", error: error.message });
          })
          .finally(() => {
            if (work.current.get(asset.id) === controller)
              work.current.delete(asset.id);
          });
      }
      if (
        asset.transfer === "queued" &&
        !uploads.current.has(asset.id) &&
        uploads.current.size < 2
      ) {
        const controller = new AbortController();
        uploads.current.set(asset.id, controller);
        update(asset.id, {
          transfer: "uploading",
          progress: 0,
          transferError: undefined,
        });
        ingest(
          asset.file,
          asset.sourcePath,
          asset.id,
          asset.encoding,
          datasetId,
          datasetName,
          controller.signal,
          (progress) => {
            if (!controller.signal.aborted) update(asset.id, { progress });
          },
        )
          .then(() => {
            if (!controller.signal.aborted) {
              update(asset.id, { transfer: "uploaded" });
              setNotice(
                "Saved to your local data lake. Original bytes and parsed records are persisted.",
              );
            }
          })
          .catch((error) => {
            if (!controller.signal.aborted)
              update(asset.id, {
                transfer: "failed",
                transferError: error.message,
              });
          })
          .finally(() => {
            if (uploads.current.get(asset.id) === controller)
              uploads.current.delete(asset.id);
          });
      }
    }
  }, [assets]);
  useEffect(
    () => () => {
      work.current.forEach((c) => c.abort());
      uploads.current.forEach((c) => c.abort());
    },
    [],
  );
  const add = (files: FileList | File[], sourcePaths?: string[]) => {
    if (!assets.length) {
      setDatasetId(crypto.randomUUID());
      const firstPath =
        sourcePaths?.[0] || Array.from(files)[0]?.webkitRelativePath || "";
      setDatasetName(
        firstPath.includes("/") ? firstPath.split("/")[0] : "Manual import",
      );
    }
    const entries = Array.from(files).map((file, index) => ({
      id: crypto.randomUUID(),
      file,
      sourcePath: sourcePaths?.[index] || file.webkitRelativePath || file.name,
      encoding: "auto" as const,
      inspection: "queued" as const,
      transfer: "idle" as const,
      progress: 0,
    }));
    setAssets((current) => [...current, ...entries]);
    setNotice(
      `${entries.length} file${entries.length === 1 ? "" : "s"} added for local inspection.`,
    );
  };
  const remove = (ids: string[]) => {
    ids.forEach((id) => {
      work.current.get(id)?.abort();
      work.current.delete(id);
      uploads.current.get(id)?.abort();
      uploads.current.delete(id);
    });
    setAssets((current) => current.filter((a) => !ids.includes(a.id)));
    setNotice(
      `${ids.length} file${ids.length === 1 ? "" : "s"} removed from this session.`,
    );
  };
  const retry = (id: string, encoding: Encoding) => {
    work.current.get(id)?.abort();
    work.current.delete(id);
    update(id, {
      inspection: "queued",
      encoding,
      error: undefined,
      preview: undefined,
    });
  };
  const start = (ids: string[]) =>
    setAssets((current) => {
      return current.map((a) => {
        if (
          !ids.includes(a.id) ||
          a.inspection !== "ready" ||
          ["queued", "uploading", "uploaded"].includes(a.transfer)
        )
          return a;

        return {
          ...a,
          transfer: "queued",
          progress: 0,
          transferError: undefined,
        };
      });
    });
  const cancel = (id: string) => {
    uploads.current.get(id)?.abort();
    uploads.current.delete(id);
    update(id, {
      transfer: "cancelled",
      progress: 0,
      transferError: undefined,
    });
  };
  return {
    assets,
    notice,
    add,
    remove,
    retry,
    start,
    cancel,
    datasetName,
    setDatasetName,
    datasetLocked: assets.some((a) => a.transfer !== "idle"),
  };
}
export type Intake = ReturnType<typeof useIntake>;
