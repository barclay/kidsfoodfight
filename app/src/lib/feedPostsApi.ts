import type { FeedPostCreated } from '../types/feedPost';
import { ensureImageUnderMaxBytes } from './ensureImageUnderMaxBytes';
import { postFormDataWithProgress } from './xhrFormUpload';

/** Must match ``_MAX_PHOTOS_PER_POST`` in ``backend/app/routers/feed.py``. */
export const MAX_FEED_POST_PHOTOS = 6;

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

export async function createFeedPost(
  token: string,
  args: { challengeId: string; comment?: string; fileUris: string[] },
  onProgress?: (fraction: number) => void,
): Promise<FeedPostCreated> {
  const form = new FormData();
  form.append('challenge_id', args.challengeId);
  const trimmed = args.comment?.trim();
  if (trimmed) {
    form.append('comment', trimmed);
  }
  const uris = args.fileUris.slice(0, MAX_FEED_POST_PHOTOS);
  const preparedUris: string[] = [];
  for (const uri of uris) {
    preparedUris.push(await ensureImageUnderMaxBytes(uri));
  }
  for (const uri of preparedUris) {
    const nameFromUri = uri.split('/').pop() ?? 'photo.jpg';
    const ext = nameFromUri.includes('.') ? nameFromUri.split('.').pop()?.toLowerCase() : '';
    const mime =
      ext === 'png'
        ? 'image/png'
        : ext === 'webp'
          ? 'image/webp'
          : ext === 'gif'
            ? 'image/gif'
            : 'image/jpeg';
    const name = ext ? nameFromUri : `${nameFromUri}.jpg`;
    form.append('files', { uri, name, type: mime } as unknown as Blob);
  }

  const { ok, json } = await postFormDataWithProgress(
    `${API_BASE_URL}/feed/posts`,
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
  if (typeof json !== 'object' || json === null || typeof (json as FeedPostCreated).id !== 'string') {
    throw new Error('Unexpected response from server');
  }
  return json as FeedPostCreated;
}
