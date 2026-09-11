import { inspectFile } from "./inspect";
import type { Encoding } from "./types";
self.onmessage = async (
  event: MessageEvent<{ file: File; encoding: Encoding }>,
) => {
  try {
    self.postMessage({
      preview: await inspectFile(event.data.file, event.data.encoding),
    });
  } catch (error) {
    self.postMessage({
      error:
        error instanceof Error ? error.message : "Unable to read this file.",
    });
  }
};
