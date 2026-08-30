// Keep chart write concurrency off HTTP If-Match. An intermediary may evaluate
// that standard precondition after the handler has already committed the write.
export const chartOrderExpectedEtagHeader =
  "X-Clair-Order-Expected-ETag";
