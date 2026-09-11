import { test } from "node:test";
import assert from "node:assert/strict";
import { inspectFile, PREVIEW_BYTES, HASH_BYTES } from "./inspect.ts";
const file = (name: string, text: string) => new File([text], name);
test("CSV preserves raw first row, quoted commas/newlines and leading zeros", async () => {
  const p = await inspectFile(
    file("raw.csv", 'id,note\r\n001,"hello, world\nnext line"'),
  );
  assert.deepEqual(p.records, [
    ["id", "note"],
    ["001", "hello, world\nnext line"],
  ]);
});
test("auto detects semicolon and preserves duplicate headers", async () => {
  const p = await inspectFile(file("raw.csv", "name;name\nx;y"));
  assert.equal(p.delimiter, ";");
  assert.deepEqual(p.records[0], ["name", "name"]);
});
test("invalid, empty, binary and malformed files report errors", async () => {
  await assert.rejects(inspectFile(file("raw.json", "{}")), /Unsupported/);
  await assert.rejects(inspectFile(file("raw.txt", "")), /empty/);
  await assert.rejects(inspectFile(file("raw.txt", "a\0b")), /binary/);
  await assert.rejects(
    inspectFile(file("raw.csv", 'a,b\n1,"unclosed')),
    /parsed/,
  );
});
test("UTF-16 BOM detection and explicit legacy encoding recovery", async () => {
  const bytes = Buffer.concat([
    Buffer.from([255, 254]),
    Buffer.from("name\nZoë", "utf16le"),
  ]);
  const p = await inspectFile(new File([bytes], "utf16.txt"));
  assert.equal(p.encoding, "utf-16le");
  assert.equal(p.text, "name\nZoë");
  const legacy = new File([new Uint8Array([99, 97, 102, 233])], "legacy.txt");
  await assert.rejects(inspectFile(legacy), /decode/);
  assert.equal((await inspectFile(legacy, "windows-1252")).text, "café");
});
test("full content digest distinguishes names from bytes", async () => {
  const [a, b, c] = await Promise.all([
    inspectFile(file("same.txt", "a")),
    inspectFile(file("different.txt", "a")),
    inspectFile(file("same.txt", "b")),
  ]);
  assert.equal(a.digest, b.digest);
  assert.notEqual(a.digest, c.digest);
});
test("large previews are bounded and do not hash partial content as a full match", async () => {
  const p = await inspectFile(file("large.txt", "a".repeat(HASH_BYTES + 1)));
  assert.equal(p.bytesRead, PREVIEW_BYTES);
  assert.equal(p.text.length, 6000);
  assert.equal(p.digest, undefined);
  assert.equal(p.sampled, true);
});
test("truncation in first quoted record is not treated as a valid record", async () => {
  await assert.rejects(
    inspectFile(file("large.csv", '"' + "a".repeat(PREVIEW_BYTES) + '"')),
    /No complete/,
  );
});
test("bounds raw records, fields, and displayed cell length", async () => {
  const row = Array.from({ length: 15 }, () => "x".repeat(300)).join(",");
  const p = await inspectFile(
    file("wide.csv", Array.from({ length: 30 }, () => row).join("\n")),
  );
  assert.equal(p.records.length, 20);
  assert.equal(p.records[0].length, 12);
  assert.equal(p.records[0][0].length, 240);
  assert.equal(p.clippedCells, true);
});
