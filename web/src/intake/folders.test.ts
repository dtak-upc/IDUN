import { test } from "node:test";
import assert from "node:assert/strict";
import { collectEntries, folderSelection, type Entry } from "./folders.ts";
const leaf = (name: string): Entry => ({
  name,
  isFile: true,
  isDirectory: false,
  file: (resolve) => resolve(new File(["raw"], name)),
});
const dir = (name: string, children: Entry[]): Entry => ({
  name,
  isFile: false,
  isDirectory: true,
  createReader: () => {
    let index = 0;
    return {
      readEntries: (resolve) => {
        const batch = children.slice(index, index + 100);
        index += 100;
        resolve(batch);
      },
    };
  },
});
test("multiple roots, nested admissions and directory batches beyond 100 are collected", async () => {
  const r = await collectEntries(
    [
      dir("patient-a", [
        dir(
          "admission-a",
          Array.from({ length: 123 }, (_, i) => leaf(`${i}.csv`)),
        ),
      ]),
      dir("patient-b", [leaf("note.TXT"), leaf("ignore.json")]),
    ],
    new AbortController().signal,
  );
  assert.equal(r.sources.length, 124);
  assert.equal(r.skipped, 1);
  assert.equal(r.errors.length, 0);
  assert(
    r.sources.some((s) => s.relativePath === "patient-a/admission-a/122.csv"),
  );
  assert(r.sources.some((s) => s.relativePath === "patient-b/note.TXT"));
});
test("empty folders and unreadable files are reported without losing readable siblings", async () => {
  const broken: Entry = {
    name: "blocked.txt",
    isFile: true,
    isDirectory: false,
    file: (_, reject) => reject(new DOMException("denied")),
  };
  const r = await collectEntries(
    [dir("empty", []), broken, leaf("ok.txt")],
    new AbortController().signal,
  );
  assert.equal(r.sources.length, 1);
  assert.equal(r.errors.length, 1);
});
test("cancelled traversal does not return a partial collection", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(collectEntries([leaf("a.csv")], controller.signal), {
    name: "AbortError",
  });
});
test("folder picker retains nested paths and filters unrelated files", () => {
  const file = new File(["a"], "a.csv");
  Object.defineProperty(file, "webkitRelativePath", {
    value: "root/patient/admission/a.csv",
  });
  const r = folderSelection([file, new File(["{}"], "metadata.json")]);
  assert.equal(r.sources[0].relativePath, "root/patient/admission/a.csv");
  assert.equal(r.skipped, 1);
});
