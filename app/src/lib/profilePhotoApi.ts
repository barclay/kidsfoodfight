import type { UserMe } from '../types/userMe';
import { ensureImageUnderMaxBytes } from './ensureImageUnderMaxBytes';
import { postFormDataWithProgress } from './xhrFormUpload';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000/api/v1';

function parseDetail(raw: unknown): string {
  if (typeof raw !== 'object' || raw === null || !('detail' in raw)) {
    return 'Request failed';
  }
  const detail = (raw as { detail: unknown }).detail;
  if (typeof detail === 'string') {
    return detail;
  }
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === 'object' && item !== null && 'msg' in item) {
          return String((item as { msg: unknown }).msg);
        }
        return JSON.stringify(item);
      })
      .join(' ');
  }
  return 'Request failed';
}

export async function uploadProfilePhoto(
  token: string,
  imageUri: string,
  onProgress?: (fraction: number) => void,
): Promise<UserMe> {
  const normalizedUri = await ensureImageUnderMaxBytes(imageUri);
  const form = new FormData();
  form.append('file', {
    uri: normalizedUri,
    name: 'profile.jpg',
    type: 'image/jpeg',
  } as unknown as Blob);

  const { ok, json } = await postFormDataWithProgress(
    `${API_BASE_URL}/me/profile-photo`,
    form,
    { Authorization: `Bearer ${token}` },
    (loaded, total, lengthComputable) => {
      if (!onProgress) {
        return;
      }
      if (lengthComputable && total > 0) {
        onProgress(loaded / total);
      } else {
        onProgress(-1);
      }
    },
  );

  if (!ok) {
    throw new Error(parseDetail(json));
  }
  if (typeof json !== 'object' || json === null || typeof (json as UserMe).id !== 'string') {
    throw new Error('Unexpected response from server');
  }
  return json as UserMe;
}
