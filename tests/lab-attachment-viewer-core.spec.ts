import { expect, test } from "@playwright/test";
import { attachmentReadStatus, decodeAttachmentText, parseAttachmentCsv } from "../src/features/lab-imaging/lab-attachment-preview-core";

test("CSV preserves leading zeroes, units, formula-like strings and quoted records", () => {
  const data = parseAttachmentCsv('\uFEFFcode,value,note\r\n001,3.5 mg/dL,"comma, quote ""yes""\nand newline"\r\n=1+1,,end,\r\n');
  expect(data.rows).toEqual([["code", "value", "note"], ["001", "3.5 mg/dL", 'comma, quote "yes"\nand newline'], ["=1+1", "", "end", ""]]);
  expect(data.rowCount).toBe(3);
  expect(data.columnCount).toBe(4);
  expect(data.malformed).toBe(false);
});

test("CSV detects semicolon and tab delimiters outside quotes", () => {
  expect(parseAttachmentCsv('"a,b";001;\r\n"c,d";2;').rows).toEqual([["a,b", "001", ""], ["c,d", "2", ""]]);
  expect(parseAttachmentCsv("a\tb\n01\t02").delimiter).toBe("\t");
});

test("CSV preserves empty cells and lines, and flags malformed quotes", () => {
  expect(parseAttachmentCsv("").rows).toEqual([]);
  expect(parseAttachmentCsv("\n").rows).toEqual([[""]]);
  expect(parseAttachmentCsv(",\n\n,").rows).toEqual([["", ""], [""], ["", ""]]);
  expect(parseAttachmentCsv('a,"unterminated\nvalue').malformed).toBe(true);
  expect(parseAttachmentCsv('a,"quoted"tail').malformed).toBe(true);
});

test("CSV bounds display storage while counting full records and columns", () => {
  const source = Array.from({ length: 205 }, (_, i) => Array.from({ length: 52 }, (_, col) => col === 0 ? String(i).padStart(4, "0") : "value").join(",")).join("\n");
  const data = parseAttachmentCsv(source);
  expect(data.rows).toHaveLength(200);
  expect(data.rows[0]).toHaveLength(50);
  expect(data.rows[0][0]).toBe("0000");
  expect(data.rowCount).toBe(205);
  expect(data.columnCount).toBe(52);
  expect(data.partial).toBe(true);
  expect(parseAttachmentCsv("x".repeat(5000)).rows[0][0]).toHaveLength(4000);
});

test("CSV still validates quotes after the display bound", () => {
  const source = `${"a,b\n".repeat(200)}unquoted"bad,b`;
  expect(parseAttachmentCsv(source).malformed).toBe(true);
});

test("text decodes UTF-8 BOM and legacy Korean without replacing undecodable bytes", () => {
  expect(decodeAttachmentText(new TextEncoder().encode("\uFEFF합성 텍스트 <script>").buffer)).toEqual({ text: "합성 텍스트 <script>", encoding: "UTF-8" });
  expect(decodeAttachmentText(new Uint8Array([0xc7, 0xd1, 0xb1, 0xdb]).buffer)).toEqual({ text: "한글", encoding: "EUC-KR" });
  expect(() => decodeAttachmentText(new Uint8Array([0xff]).buffer)).toThrow();
});

test("protected read statuses distinguish access denial, unavailable files and recoverable failures", () => {
  expect([401, 403].map(attachmentReadStatus)).toEqual(["denied", "denied"]);
  expect([404, 410].map(attachmentReadStatus)).toEqual(["unavailable", "unavailable"]);
  expect([429, 500, 503].map(attachmentReadStatus)).toEqual(["error", "error", "error"]);
});
