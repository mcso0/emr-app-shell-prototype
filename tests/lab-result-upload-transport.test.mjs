import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

let scenario = "success";
let lastRequest;

class FakeXMLHttpRequest {
  upload = { addEventListener: (type, callback) => this.addListener(`upload:${type}`, callback) };
  listeners = new Map();
  headers = {};
  status = 0;

  addEventListener(type, callback) {
    const listeners = this.listeners.get(type) ?? [];
    listeners.push(callback);
    this.listeners.set(type, listeners);
  }

  addListener(type, callback) {
    this.addEventListener(type, callback);
  }

  open(method, url) { this.method = method; this.url = url; }
  setRequestHeader(name, value) { this.headers[name] = value; }

  send(body) {
    this.body = body;
    lastRequest = { method: this.method, url: this.url, withCredentials: this.withCredentials, headers: { ...this.headers }, body };
    if (scenario === "pending" || scenario === "indeterminate") {
      if (scenario === "indeterminate") this.emit("upload:progress", { lengthComputable: false, loaded: 0, total: 0 });
      return;
    }
    if (scenario === "http-error") {
      this.status = 500;
      this.emit("load");
      return;
    }
    const events = scenario === "clamp" ? [25, 50, 99, 101].map(loaded => ({ loaded, total: 100 }))
      : [1, 2, 3, 4].map(loaded => ({ loaded, total: 4 }));
    for (const event of events) {
      this.emit("upload:progress", { lengthComputable: true, ...event });
    }
    this.status = 204;
    this.emit("load");
  }

  abort() { this.emit("abort"); }
  emit(type, event = {}) { for (const listener of this.listeners.get(type) ?? []) listener(event); }
}

const source = readFileSync(new URL("../src/features/lab-imaging/components/lab-result-upload-transport.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const exports = {};
runInNewContext(outputText, { exports, XMLHttpRequest: FakeXMLHttpRequest, FormData, File });
const { uploadLabAttachmentToSignedUrl } = exports;

test("signed upload preserves SDK multipart semantics and reports measured progress", async () => {
  scenario = "success";
  lastRequest = undefined;
  const progress = [];
  const file = new File([new Uint8Array([1, 2, 3, 4])], "sample.csv", { type: "" });
  const request = uploadLabAttachmentToSignedUrl({
    file,
    mimeType: "text/csv",
    onProgress: percent => progress.push(percent),
    uploadUrl: "https://storage.example.test/signed/upload",
  });

  await request.promise;

  assert.equal(lastRequest.method, "PUT");
  assert.equal(lastRequest.url, "https://storage.example.test/signed/upload");
  assert.equal(lastRequest.withCredentials, false);
  assert.equal(lastRequest.headers["x-upsert"], "false");
  assert.equal(lastRequest.body.get("cacheControl"), "0");
  const uploaded = lastRequest.body.get("");
  assert.equal(uploaded.name, "sample.csv");
  assert.equal(uploaded.type, "text/csv");
  assert.deepEqual(progress, [25, 50, 75, 100]);
});

test("signed upload failures and user cancellation reject the pending transport", async () => {
  scenario = "http-error";
  const failed = uploadLabAttachmentToSignedUrl({
    file: new File(["x"], "sample.txt", { type: "text/plain" }),
    mimeType: "text/plain",
    onProgress: () => {},
    uploadUrl: "https://storage.example.test/signed/upload",
  });
  await assert.rejects(failed.promise, /업로드하지 못했습니다/);

  scenario = "pending";
  const cancelled = uploadLabAttachmentToSignedUrl({
    file: new File(["x"], "sample.txt", { type: "text/plain" }),
    mimeType: "text/plain",
    onProgress: () => {},
    uploadUrl: "https://storage.example.test/signed/upload",
  });
  cancelled.abort();
  await assert.rejects(cancelled.promise, /취소되었습니다/);
});

test("unknown upload totals stay indeterminate and measured percentages clamp at 100", async () => {
  scenario = "indeterminate";
  const progress = [];
  const request = uploadLabAttachmentToSignedUrl({
    file: new File(["x"], "sample.txt", { type: "text/plain" }),
    mimeType: "text/plain",
    onProgress: percent => progress.push(percent),
    uploadUrl: "https://storage.example.test/signed/upload",
  });
  assert.deepEqual(progress, []);
  request.abort();
  await assert.rejects(request.promise, /취소되었습니다/);

  scenario = "clamp";
  const measured = [];
  const complete = uploadLabAttachmentToSignedUrl({
    file: new File(["x"], "sample.txt", { type: "text/plain" }),
    mimeType: "text/plain",
    onProgress: percent => measured.push(percent),
    uploadUrl: "https://storage.example.test/signed/upload",
  });
  await complete.promise;
  assert.deepEqual(measured, [25, 50, 99, 100]);
});
