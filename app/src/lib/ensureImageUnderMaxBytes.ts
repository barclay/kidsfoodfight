import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';

/** Must match ``_MAX_PHOTO_BYTES`` in ``backend/app/routers/feed.py`` (8 MiB). */
export const MAX_UPLOAD_IMAGE_BYTES = 8 * 1024 * 1024;

export async function getUriByteLength(uri: string): Promise<number> {
  const res = await fetch(uri);
  if (!res.ok) {
    throw new Error('Could not read image file');
  }
  const blob = await res.blob();
  return blob.size;
}

async function getImageDimensions(uri: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ w: width, h: height }),
      (e) => reject(e instanceof Error ? e : new Error('Could not read image dimensions')),
    );
  });
}

/**
 * Returns a ``file://`` JPEG URI at most ``maxBytes`` (re-encoded/resized as needed).
 * Throws if the image cannot be brought under the limit after several attempts.
 */
export async function ensureImageUnderMaxBytes(
  uri: string,
  maxBytes: number = MAX_UPLOAD_IMAGE_BYTES,
): Promise<string> {
  let current = uri;
  let bytes = await getUriByteLength(current);
  if (bytes <= maxBytes) {
    return current;
  }

  let compress = 0.85;
  let maxSideHint = 2400;

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const { w, h } = await getImageDimensions(current);
    const maxSide = Math.max(w, h);
    const targetSide = Math.max(480, Math.min(maxSideHint, Math.floor(maxSide * 0.88)));
    const scale = targetSide / maxSide;
    const resize =
      w >= h
        ? { resize: { width: Math.max(1, Math.round(w * scale)) } }
        : { resize: { height: Math.max(1, Math.round(h * scale)) } };

    const out = await ImageManipulator.manipulateAsync(current, [resize], {
      compress,
      format: ImageManipulator.SaveFormat.JPEG,
    });
    current = out.uri;
    bytes = await getUriByteLength(current);
    if (bytes <= maxBytes) {
      return current;
    }
    maxSideHint = Math.max(480, Math.floor(maxSideHint * 0.82));
    compress = Math.max(0.48, compress - 0.05);
  }

  const mb = Math.round(maxBytes / (1024 * 1024));
  throw new Error(`Photo must be under ${mb} MB after compression. Try a smaller image.`);
}
