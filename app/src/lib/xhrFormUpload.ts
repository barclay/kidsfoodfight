/**
 * Multipart POST with upload progress (``fetch`` does not expose upload progress in RN).
 */

export type FormUploadProgress = (loaded: number, total: number, lengthComputable: boolean) => void;

export type FormUploadResult = {
  ok: boolean;
  status: number;
  json: unknown;
};

export function postFormDataWithProgress(
  url: string,
  form: FormData,
  headers: Record<string, string>,
  onProgress?: FormUploadProgress,
): Promise<FormUploadResult> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (ev) => {
      onProgress?.(ev.loaded, ev.total, ev.lengthComputable);
    };
    xhr.onerror = () => {
      reject(new Error('Network error'));
    };
    xhr.onload = () => {
      let json: unknown = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, json });
    };
    xhr.send(form as never);
  });
}
