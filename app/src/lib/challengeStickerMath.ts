/** Display rect for `resizeMode="contain"` of an image in a box. */
export function containRect(
  containerW: number,
  containerH: number,
  imgW: number,
  imgH: number,
): { dispW: number; dispH: number; offX: number; offY: number } {
  if (containerW <= 0 || containerH <= 0 || imgW <= 0 || imgH <= 0) {
    return { dispW: 0, dispH: 0, offX: 0, offY: 0 };
  }
  const scale = Math.min(containerW / imgW, containerH / imgH);
  const dispW = imgW * scale;
  const dispH = imgH * scale;
  const offX = (containerW - dispW) / 2;
  const offY = (containerH - dispH) / 2;
  return { dispW, dispH, offX, offY };
}

/**
 * Editor stage for a photo at full viewport width: height follows image aspect so there is
 * no vertical letterboxing, unless the image is so tall that height is capped (then horizontal
 * letterboxing may appear inside the stage).
 */
export function photoEditorStageLayout(
  viewportW: number,
  windowH: number,
  imgW: number,
  imgH: number,
  maxHeightFraction = 0.62,
): { stageH: number; dispW: number; dispH: number; offX: number; offY: number } {
  const maxStageH = Math.round(windowH * maxHeightFraction);
  const minStageH = 120;
  if (viewportW <= 0 || imgW <= 0 || imgH <= 0) {
    const stageH = Math.max(280, Math.round(windowH * 0.45));
    const r = containRect(viewportW, stageH, 1, 1);
    return { stageH, dispW: r.dispW, dispH: r.dispH, offX: r.offX, offY: r.offY };
  }
  const idealH = (viewportW * imgH) / imgW;
  const stageH = Math.round(Math.min(maxStageH, Math.max(minStageH, idealH)));
  const r = containRect(viewportW, stageH, imgW, imgH);
  return { stageH, dispW: r.dispW, dispH: r.dispH, offX: r.offX, offY: r.offY };
}

/** Map touch in container coords → normalized image coords (0–1). */
export function screenToNorm(
  px: number,
  py: number,
  dispW: number,
  dispH: number,
  offX: number,
  offY: number,
): { nx: number; ny: number } {
  if (dispW <= 0 || dispH <= 0) {
    return { nx: 0.5, ny: 0.5 };
  }
  const nx = (px - offX) / dispW;
  const ny = (py - offY) / dispH;
  return {
    nx: Math.min(1, Math.max(0, nx)),
    ny: Math.min(1, Math.max(0, ny)),
  };
}

/** Normalized center → top-left in container px for a square sticker with width = wf * imgW mapped to display. */
export function normCenterToScreenTopLeft(
  cx: number,
  cy: number,
  widthFraction: number,
  imgW: number,
  imgH: number,
  dispW: number,
  dispH: number,
  offX: number,
  offY: number,
): { left: number; top: number; size: number } {
  const stickerPx = widthFraction * dispW;
  const left = offX + cx * dispW - stickerPx / 2;
  const top = offY + cy * dispH - stickerPx / 2;
  return { left, top, size: stickerPx };
}

/** Square sticker: half-width in norm X = wf/2; half-height in norm Y = (wf * imgW) / (2 * imgH). */
export function clampStickerCenter(
  cx: number,
  cy: number,
  widthFraction: number,
  imgW: number,
  imgH: number,
): { cx: number; cy: number; widthFraction: number } {
  const capFromX = 2 * Math.min(cx, 1 - cx);
  const capFromY = (2 * Math.min(cy, 1 - cy) * imgH) / imgW;
  const wf = Math.max(0.04, Math.min(widthFraction, capFromX, capFromY, 1));
  const hW = wf / 2;
  const hH = (wf * imgW) / (2 * imgH);
  return {
    cx: Math.min(1 - hW, Math.max(hW, cx)),
    cy: Math.min(1 - hH, Math.max(hH, cy)),
    widthFraction: wf,
  };
}

/** Corner being dragged for axis-aligned square resize (opposite corner stays fixed). */
export type ResizeCorner = 'nw' | 'ne' | 'sw' | 'se';

const MIN_STICKER_PX = 36;

/**
 * Resize a square sticker from one corner using cumulative dx/dy in screen pixels
 * from the gesture start (same convention as PanResponder dx/dy).
 */
export function resizeStickerFromCorner(
  corner: ResizeCorner,
  dx: number,
  dy: number,
  start: { cx: number; cy: number; widthFraction: number },
  dispW: number,
  dispH: number,
  offX: number,
  offY: number,
  imgW: number,
  imgH: number,
): { cx: number; cy: number; widthFraction: number } {
  if (dispW <= 0 || dispH <= 0) {
    return clampStickerCenter(start.cx, start.cy, start.widthFraction, imgW, imgH);
  }

  const s0 = start.widthFraction * dispW;
  const mcx = offX + start.cx * dispW;
  const mcy = offY + start.cy * dispH;
  const tl = { x: mcx - s0 / 2, y: mcy - s0 / 2 };
  const br = { x: mcx + s0 / 2, y: mcy + s0 / 2 };

  let s1: number;
  if (corner === 'se') {
    s1 = Math.min(br.x + dx - tl.x, br.y + dy - tl.y);
  } else if (corner === 'nw') {
    s1 = Math.min(br.x - (tl.x + dx), br.y - (tl.y + dy));
  } else if (corner === 'ne') {
    s1 = Math.min(br.x + dx - tl.x, br.y - (tl.y + dy));
  } else {
    s1 = Math.min(br.x - (tl.x + dx), br.y + dy - tl.y);
  }

  s1 = Math.max(MIN_STICKER_PX, s1);
  const wfRaw = s1 / dispW;

  let ncxScr: number;
  let ncyScr: number;
  if (corner === 'se') {
    ncxScr = tl.x + s1 / 2;
    ncyScr = tl.y + s1 / 2;
  } else if (corner === 'nw') {
    ncxScr = br.x - s1 / 2;
    ncyScr = br.y - s1 / 2;
  } else if (corner === 'ne') {
    ncxScr = tl.x + s1 / 2;
    ncyScr = br.y - s1 / 2;
  } else {
    ncxScr = br.x - s1 / 2;
    ncyScr = tl.y + s1 / 2;
  }

  const ncx = (ncxScr - offX) / dispW;
  const ncy = (ncyScr - offY) / dispH;
  return clampStickerCenter(ncx, ncy, wfRaw, imgW, imgH);
}
