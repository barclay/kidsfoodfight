import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import {
  clampStickerCenter,
  normCenterToScreenTopLeft,
  resizeStickerFromCorner,
  type ResizeCorner,
} from '../lib/challengeStickerMath';
import { glyphForStickerId } from '../lib/challengeStickerPalette';

export type PlacedStickerState = {
  key: string;
  stickerId: string;
  cx: number;
  cy: number;
  widthFraction: number;
};

type Props = {
  sticker: PlacedStickerState;
  imgW: number;
  imgH: number;
  dispW: number;
  dispH: number;
  offX: number;
  offY: number;
  isSelected: boolean;
  onSelect: () => void;
  onInteractionLockChange: (locked: boolean) => void;
  onChange: (key: string, patch: Pick<PlacedStickerState, 'cx' | 'cy' | 'widthFraction'>) => void;
  onRemove: (key: string) => void;
};

const HANDLE = 28;
const MOVE_THRESHOLD = 5;
const TAP_THRESHOLD = 10;

function cornerPan(
  corner: ResizeCorner,
  stickerKey: string,
  resizeOriginRef: MutableRefObject<{ cx: number; cy: number; widthFraction: number }>,
  flushRef: MutableRefObject<{ cx: number; cy: number; widthFraction: number }>,
  setLocal: Dispatch<SetStateAction<{ cx: number; cy: number; widthFraction: number }>>,
  dispW: number,
  dispH: number,
  offX: number,
  offY: number,
  imgW: number,
  imgH: number,
  onChange: (key: string, patch: Pick<PlacedStickerState, 'cx' | 'cy' | 'widthFraction'>) => void,
  onInteractionLockChange: (locked: boolean) => void,
) {
  return PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onStartShouldSetPanResponderCapture: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      onInteractionLockChange(true);
      resizeOriginRef.current = { ...flushRef.current };
    },
    onPanResponderMove: (_, g) => {
      const next = resizeStickerFromCorner(
        corner,
        g.dx,
        g.dy,
        resizeOriginRef.current,
        dispW,
        dispH,
        offX,
        offY,
        imgW,
        imgH,
      );
      setLocal(next);
      flushRef.current = next;
    },
    onPanResponderRelease: () => {
      onInteractionLockChange(false);
      const v = flushRef.current;
      onChange(stickerKey, { cx: v.cx, cy: v.cy, widthFraction: v.widthFraction });
    },
    onPanResponderTerminate: () => {
      onInteractionLockChange(false);
      const v = flushRef.current;
      onChange(stickerKey, { cx: v.cx, cy: v.cy, widthFraction: v.widthFraction });
    },
  });
}

export function PlacedStickerView({
  sticker,
  imgW,
  imgH,
  dispW,
  dispH,
  offX,
  offY,
  isSelected,
  onSelect,
  onInteractionLockChange,
  onChange,
  onRemove,
}: Props) {
  const [local, setLocal] = useState({
    cx: sticker.cx,
    cy: sticker.cy,
    widthFraction: sticker.widthFraction,
  });

  useEffect(() => {
    setLocal({
      cx: sticker.cx,
      cy: sticker.cy,
      widthFraction: sticker.widthFraction,
    });
  }, [sticker.key, sticker.cx, sticker.cy, sticker.widthFraction]);

  const dragOrigin = useRef({ cx: 0, cy: 0 });
  const resizeOriginRef = useRef({ cx: 0, cy: 0, widthFraction: 0 });
  const flushRef = useRef(local);
  flushRef.current = local;

  const dragPan = useMemo(() => {
    const claimOnTouchDown = isSelected;
    return PanResponder.create({
      onStartShouldSetPanResponder: () => claimOnTouchDown,
      onStartShouldSetPanResponderCapture: () => claimOnTouchDown,
      onMoveShouldSetPanResponder: (_, g) =>
        claimOnTouchDown ||
        Math.abs(g.dx) > MOVE_THRESHOLD ||
        Math.abs(g.dy) > MOVE_THRESHOLD,
      onMoveShouldSetPanResponderCapture: (_, g) =>
        claimOnTouchDown ||
        Math.abs(g.dx) > MOVE_THRESHOLD ||
        Math.abs(g.dy) > MOVE_THRESHOLD,
      onPanResponderTerminationRequest: () => !claimOnTouchDown,
      onPanResponderGrant: () => {
        dragOrigin.current = { cx: flushRef.current.cx, cy: flushRef.current.cy };
        onInteractionLockChange(true);
      },
      onPanResponderMove: (_, g) => {
        const ncx = dragOrigin.current.cx + g.dx / dispW;
        const ncy = dragOrigin.current.cy + g.dy / dispH;
        setLocal((prev) => {
          const cl = clampStickerCenter(ncx, ncy, prev.widthFraction, imgW, imgH);
          const next = { ...prev, cx: cl.cx, cy: cl.cy, widthFraction: cl.widthFraction };
          flushRef.current = next;
          return next;
        });
      },
      onPanResponderRelease: (_, g) => {
        onInteractionLockChange(false);
        if (claimOnTouchDown && Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD) {
          onSelect();
        } else {
          const v = flushRef.current;
          onChange(sticker.key, { cx: v.cx, cy: v.cy, widthFraction: v.widthFraction });
        }
      },
      onPanResponderTerminate: (_, g) => {
        onInteractionLockChange(false);
        if (claimOnTouchDown && Math.abs(g.dx) < TAP_THRESHOLD && Math.abs(g.dy) < TAP_THRESHOLD) {
          onSelect();
        } else {
          const v = flushRef.current;
          onChange(sticker.key, { cx: v.cx, cy: v.cy, widthFraction: v.widthFraction });
        }
      },
    });
  }, [
    dispW,
    dispH,
    imgW,
    imgH,
    isSelected,
    onChange,
    onInteractionLockChange,
    onSelect,
    sticker.key,
  ]);

  const corners: ResizeCorner[] = ['nw', 'ne', 'sw', 'se'];
  const resizePans = useMemo(() => {
    return corners.map((c) =>
      cornerPan(
        c,
        sticker.key,
        resizeOriginRef,
        flushRef,
        setLocal,
        dispW,
        dispH,
        offX,
        offY,
        imgW,
        imgH,
        onChange,
        onInteractionLockChange,
      ),
    );
  }, [
    sticker.key,
    dispW,
    dispH,
    offX,
    offY,
    imgW,
    imgH,
    onChange,
    onInteractionLockChange,
  ]);

  const layout = normCenterToScreenTopLeft(
    local.cx,
    local.cy,
    local.widthFraction,
    imgW,
    imgH,
    dispW,
    dispH,
    offX,
    offY,
  );

  const glyph = glyphForStickerId(sticker.stickerId);
  const innerPad = 4;
  const glyphFont = Math.max(14, Math.floor(layout.size * 0.48 - innerPad));
  const glyphLine = Math.ceil(glyphFont * 1.12);
  const innerRadius = Math.min(14, Math.max(6, layout.size * 0.14));

  return (
    <View
      style={[
        styles.wrap,
        {
          left: layout.left,
          top: layout.top,
          width: layout.size,
          height: layout.size,
          zIndex: isSelected ? 50 : 3,
        },
      ]}
    >
      {isSelected && <View style={styles.bbox} pointerEvents="none" />}

      <Pressable style={styles.pressFill} onPress={isSelected ? undefined : onSelect}>
        <View style={styles.dragArea} {...dragPan.panHandlers}>
          <View style={[styles.stickerInner, { borderRadius: innerRadius }]}>
            <Text
              style={[styles.glyph, { fontSize: glyphFont, lineHeight: glyphLine }]}
              allowFontScaling={false}
            >
              {glyph}
            </Text>
          </View>
        </View>
      </Pressable>

      {isSelected &&
        corners.map((c, i) => (
          <View
            key={c}
            style={[
              styles.handleWrap,
              c === 'nw' && styles.hnw,
              c === 'ne' && styles.hne,
              c === 'sw' && styles.hsw,
              c === 'se' && styles.hse,
            ]}
            {...resizePans[i].panHandlers}
          >
            <View style={styles.handleDot} />
          </View>
        ))}

      {isSelected && (
        <Pressable
          style={styles.remove}
          hitSlop={10}
          onPress={() => onRemove(sticker.key)}
          accessibilityLabel="Remove sticker"
        >
          <Text style={styles.removeText}>×</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
  },
  bbox: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderColor: 'rgba(16, 158, 154, 0.95)',
    borderStyle: 'dashed',
    borderRadius: 4,
  },
  pressFill: {
    flex: 1,
  },
  dragArea: {
    flex: 1,
    minHeight: 44,
  },
  stickerInner: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 2,
    borderColor: 'rgba(0,0,0,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    textAlign: 'center',
  },
  handleWrap: {
    position: 'absolute',
    width: HANDLE,
    height: HANDLE,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 55,
  },
  hnw: { left: -HANDLE / 2, top: -HANDLE / 2 },
  hne: { right: -HANDLE / 2, top: -HANDLE / 2 },
  hsw: { left: -HANDLE / 2, bottom: -HANDLE / 2 },
  hse: { right: -HANDLE / 2, bottom: -HANDLE / 2 },
  handleDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'rgba(16, 158, 154, 0.95)',
  },
  remove: {
    position: 'absolute',
    top: -10,
    right: -10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 60,
  },
  removeText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    marginTop: -1,
  },
});
