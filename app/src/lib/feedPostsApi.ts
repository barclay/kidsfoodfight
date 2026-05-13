import type { FeedPostCreated } from '../types/feedPost';

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
): Promise<FeedPostCreated> {
  const form = new FormData();
  form.append('challenge_id', args.challengeId);
  const trimmed = args.comment?.trim();
  if (trimmed) {
    form.append('comment', trimmed);
  }
  for (const uri of args.fileUris) {
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

  const response = await fetch(`${API_BASE_URL}/feed/posts`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(parseDetail(json));
  }
  if (typeof json !== 'object' || json === null || typeof (json as FeedPostCreated).id !== 'string') {
    throw new Error('Unexpected response from server');
  }
  return json as FeedPostCreated;
}
