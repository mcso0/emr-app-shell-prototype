import { expect, test } from "@playwright/test";
import { labResultAttachmentPath, matchesLabResultAttachmentBytes, validateLabResultAttachment } from "../src/features/lab-imaging/lab-result-attachment-core";

test("lab attachment metadata accepts only approved types and per-type size limits", () => {
  expect(validateLabResultAttachment({ name: "result.pdf", mimeType: "application/pdf", size: 20 * 1024 * 1024 }).ok).toBe(true);
  expect(validateLabResultAttachment({ name: "result.pdf", mimeType: "application/pdf", size: 20 * 1024 * 1024 + 1 }).ok).toBe(false);
  expect(validateLabResultAttachment({ name: "sample.csv", mimeType: "text/csv", size: 5 * 1024 * 1024 }).ok).toBe(true);
  expect(validateLabResultAttachment({ name: "sample.csv", mimeType: "text/csv", size: 5 * 1024 * 1024 + 1 }).ok).toBe(false);
  expect(validateLabResultAttachment({ name: "x.exe", mimeType: "application/octet-stream", size: 10 }).ok).toBe(false);
  expect(validateLabResultAttachment({ name: "bad\nname.png", mimeType: "image/png", size: 10 }).ok).toBe(false);
});

test("lab attachment finalization checks bytes and immutable scoped path", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7\n1 0 obj\n%%EOF");
  expect(matchesLabResultAttachmentBytes("application/pdf", pdf)).toBe(true);
  expect(matchesLabResultAttachmentBytes("image/png", pdf)).toBe(false);
  expect(matchesLabResultAttachmentBytes("text/plain", new Uint8Array([0, 65]))).toBe(false);
  expect(matchesLabResultAttachmentBytes("text/csv", new TextEncoder().encode("name,value\nA,1\n"))).toBe(true);
  expect(labResultAttachmentPath("workspace-a", "entry-a", "file-a", "application/pdf"))
    .toBe("workspace-a/entry-a/file-a.pdf");
});
