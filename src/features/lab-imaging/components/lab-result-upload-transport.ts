export type LabAttachmentUploadRequest = {
  promise: Promise<void>;
  abort: () => void;
};

/**
 * Send the same signed-storage multipart request used by Supabase Storage's
 * uploadToSignedUrl, while exposing native upload progress to the result sheet.
 */
export function uploadLabAttachmentToSignedUrl({
  file,
  mimeType,
  onProgress,
  uploadUrl,
}: {
  file: File;
  mimeType: string;
  onProgress: (percent: number) => void;
  uploadUrl: string;
}): LabAttachmentUploadRequest {
  const xhr = new XMLHttpRequest();
  let lastProgress = -1;
  const reportProgress = (percent: number) => {
    const bounded = Math.max(0, Math.min(100, percent));
    if (bounded === lastProgress) return;
    lastProgress = bounded;
    onProgress(bounded);
  };
  const promise = new Promise<void>((resolve, reject) => {
    xhr.open("PUT", uploadUrl);
    xhr.withCredentials = false;
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      if (!event.lengthComputable || event.total <= 0) return;
      reportProgress(Math.floor((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        reportProgress(100);
        resolve();
      } else {
        reject(new Error("파일을 업로드하지 못했습니다."));
      }
    });
    xhr.addEventListener("error", () => reject(new Error("파일을 업로드하지 못했습니다.")));
    xhr.addEventListener("abort", () => reject(new Error("업로드가 취소되었습니다.")));

    const form = new FormData();
    form.append("cacheControl", "0");
    // The SDK uses the Blob's MIME type for this field, so normalize File.type
    // before sending rather than relying on the ignored contentType option.
    form.append("", new File([file], file.name, { type: mimeType }));
    xhr.send(form);
  });

  return { promise, abort: () => xhr.abort() };
}
