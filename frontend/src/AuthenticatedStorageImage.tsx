import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { apiFetch, mediaPathFromStoragePath } from './api';

export type AuthenticatedStorageImageProps = {
  storageUrl: string;
  alt?: string;
  width?: number;
  height?: number;
  style?: CSSProperties;
};

/**
 * Loads ``/api/v1/media/...`` with the admin JWT (``apiFetch``) and displays a blob URL.
 * Plain ``<img src={mediaUrlFromStoragePath}>`` does not send ``Authorization`` and returns 401.
 */
export function AuthenticatedStorageImage({
  storageUrl,
  alt = '',
  width,
  height,
  style,
}: AuthenticatedStorageImageProps) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setFailed(false);
    setSrc(null);
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    (async () => {
      const res = await apiFetch(mediaPathFromStoragePath(storageUrl));
      if (cancelled) return;
      if (!res.ok) {
        setFailed(true);
        return;
      }
      const blob = await res.blob();
      if (cancelled) return;
      const u = URL.createObjectURL(blob);
      urlRef.current = u;
      setSrc(u);
    })();

    return () => {
      cancelled = true;
      if (urlRef.current) {
        URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
      }
    };
  }, [storageUrl]);

  const w = width ?? 120;
  const h = height ?? 120;

  if (failed || !src) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: w,
          height: h,
          background: '#f3f4f6',
          borderRadius: 6,
          fontSize: 12,
          color: '#9ca3af',
          ...style,
        }}
      >
        {failed ? 'No preview' : '…'}
      </span>
    );
  }

  return <img src={src} alt={alt} width={width} height={height} style={style} />;
}
