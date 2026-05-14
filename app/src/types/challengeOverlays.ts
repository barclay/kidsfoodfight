/**
 * Client → server overlay instructions (raw photos unchanged; server composites later).
 * Coordinates are normalized 0–1 to the **original** image pixel width/height.
 * `photos[i]` matches multipart `files` order (same index as `fileUris`).
 */

export type OverlayStickerPayload = {
  /** Stable id for the sticker asset (e.g. `sticker_a`); replace with your PNG set keys. */
  sticker_id: string;
  /** Center X in 0–1 relative to full source image width. */
  center_x: number;
  /** Center Y in 0–1 relative to full source image height. */
  center_y: number;
  /**
   * Sticker width as a fraction of the full image width (height follows 1:1 aspect for placeholders).
   * Server can interpret aspect from asset metadata.
   */
  width_fraction: number;
  /** Rotation in radians (counter-clockwise, +X = right). */
  rotation: number;
};

export type ChallengeOverlaysPayload = {
  version: 1;
  photos: OverlayStickerPayload[][];
};
