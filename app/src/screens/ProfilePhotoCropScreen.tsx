import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImageManipulator from 'expo-image-manipulator';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useUploadToast } from '../context/UploadToastContext';
import { uploadProfilePhoto } from '../lib/profilePhotoApi';
import type { ProfileStackParamList } from '../navigation/types';
import { Colors } from '../lib/colors';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfilePhotoCrop'>;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function displaySize(imgNatural: { w: number; h: number }, side: number, zoom: number): { w: number; h: number } {
  if (side <= 0) {
    return { w: 0, h: 0 };
  }
  const base = side / Math.min(imgNatural.w, imgNatural.h);
  const scale = base * zoom;
  return { w: imgNatural.w * scale, h: imgNatural.h * scale };
}

function touchDistance(a: { pageX: number; pageY: number }, b: { pageX: number; pageY: number }): number {
  const dx = a.pageX - b.pageX;
  const dy = a.pageY - b.pageY;
  return Math.sqrt(dx * dx + dy * dy);
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;

export default function ProfilePhotoCropScreen({ navigation, route }: Props) {
  const { imageUri } = route.params;
  const { token, refreshMe } = useAuth();
  const { enqueueUpload } = useUploadToast();
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  zoomRef.current = zoom;
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const pinchAnchorRef = useRef<{ startDist: number; startZoom: number } | null>(null);
  const lastSinglePageRef = useRef<{ x: number; y: number } | null>(null);
  const wasMultiTouchRef = useRef(false);
  const cropWindowRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const cropLayoutRef = useRef<View>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const didCenterRef = useRef(false);

  const side = useMemo(() => {
    if (layout.w <= 0 || layout.h <= 0) {
      return 0;
    }
    return Math.min(layout.w, layout.h) * 0.86;
  }, [layout.w, layout.h]);

  const top = layout.h > 0 && side > 0 ? (layout.h - side) / 2 : 0;
  const left = layout.w > 0 && side > 0 ? (layout.w - side) / 2 : 0;

  const display = useMemo(() => {
    if (!imgNatural || side <= 0) {
      return { w: 0, h: 0 };
    }
    return displaySize(imgNatural, side, zoom);
  }, [imgNatural, side, zoom]);

  useEffect(() => {
    Image.getSize(
      imageUri,
      (w, h) => {
        setImgNatural({ w, h });
        didCenterRef.current = false;
      },
      () => setError('Could not read image size.'),
    );
  }, [imageUri]);

  useEffect(() => {
    if (!imgNatural || side <= 0 || didCenterRef.current) {
      return;
    }
    const d = displaySize(imgNatural, side, MIN_ZOOM);
    if (d.w <= 0) {
      return;
    }
    didCenterRef.current = true;
    setZoom(MIN_ZOOM);
    setPan({
      x: (side - d.w) / 2,
      y: (side - d.h) / 2,
    });
  }, [imgNatural, side]);

  const measureCropWindow = useCallback(() => {
    cropLayoutRef.current?.measureInWindow((x, y, w, h) => {
      cropWindowRef.current = { x, y, w, h };
    });
  }, []);

  const clampPan = useCallback(
    (p: { x: number; y: number }, dw: number, dh: number) => ({
      x: clamp(p.x, side - dw, 0),
      y: clamp(p.y, side - dh, 0),
    }),
    [side],
  );

  const focalInCrop = useCallback(
    (touches: readonly { pageX: number; pageY: number }[]) => {
      const win = cropWindowRef.current;
      if (!win || touches.length < 2) {
        return null;
      }
      const mx = (touches[0].pageX + touches[1].pageX) / 2;
      const my = (touches[0].pageY + touches[1].pageY) / 2;
      return {
        x: clamp(mx - win.x, 0, win.w),
        y: clamp(my - win.y, 0, win.h),
      };
    },
    [],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          pinchAnchorRef.current = null;
          lastSinglePageRef.current = null;
        },
        onPanResponderMove: (evt) => {
          if (!imgNatural || side <= 0) {
            return;
          }
          const touches = evt.nativeEvent.touches;
          if (touches.length >= 2) {
            wasMultiTouchRef.current = true;
            lastSinglePageRef.current = null;
            const d = touchDistance(touches[0], touches[1]);
            if (d < 1) {
              return;
            }
            if (!pinchAnchorRef.current) {
              pinchAnchorRef.current = { startDist: d, startZoom: zoomRef.current };
            }
            const { startDist, startZoom } = pinchAnchorRef.current;
            const nextZ = clamp(startZoom * (d / startDist), MIN_ZOOM, MAX_ZOOM);
            const focal = focalInCrop(touches);
            if (!focal) {
              return;
            }
            const prevZ = zoomRef.current;
            const prevPan = panRef.current;
            const Dw0 = displaySize(imgNatural, side, prevZ).w;
            const Dh0 = displaySize(imgNatural, side, prevZ).h;
            const Dw1 = displaySize(imgNatural, side, nextZ).w;
            const Dh1 = displaySize(imgNatural, side, nextZ).h;
            const u = (focal.x - prevPan.x) / Dw0;
            const v = (focal.y - prevPan.y) / Dh0;
            const nextPan = clampPan(
              {
                x: focal.x - u * Dw1,
                y: focal.y - v * Dh1,
              },
              Dw1,
              Dh1,
            );
            setZoom(nextZ);
            setPan(nextPan);
          } else if (touches.length === 1) {
            pinchAnchorRef.current = null;
            const t = touches[0];
            if (wasMultiTouchRef.current) {
              wasMultiTouchRef.current = false;
              lastSinglePageRef.current = { x: t.pageX, y: t.pageY };
              return;
            }
            if (!lastSinglePageRef.current) {
              lastSinglePageRef.current = { x: t.pageX, y: t.pageY };
              return;
            }
            const ddx = t.pageX - lastSinglePageRef.current.x;
            const ddy = t.pageY - lastSinglePageRef.current.y;
            lastSinglePageRef.current = { x: t.pageX, y: t.pageY };
            const dw = displaySize(imgNatural, side, zoomRef.current).w;
            const dh = displaySize(imgNatural, side, zoomRef.current).h;
            setPan(
              clampPan(
                {
                  x: panRef.current.x + ddx,
                  y: panRef.current.y + ddy,
                },
                dw,
                dh,
              ),
            );
          }
        },
        onPanResponderRelease: () => {
          pinchAnchorRef.current = null;
          lastSinglePageRef.current = null;
        },
        onPanResponderTerminate: () => {
          pinchAnchorRef.current = null;
          lastSinglePageRef.current = null;
        },
      }),
    [imgNatural, side, clampPan, focalInCrop],
  );

  const onRootLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setLayout({ w: width, h: height });
  };

  const onSave = async () => {
    if (!token || !imgNatural || side <= 0 || display.w <= 0) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const scaleOrig = imgNatural.w / display.w;
      const originX = Math.round(-pan.x * scaleOrig);
      const originY = Math.round(-pan.y * scaleOrig);
      const cw = Math.round(side * scaleOrig);
      const ch = Math.round(side * scaleOrig);
      const ox = clamp(originX, 0, Math.max(0, imgNatural.w - cw));
      const oy = clamp(originY, 0, Math.max(0, imgNatural.h - ch));
      const wCrop = clamp(cw, 1, imgNatural.w - ox);
      const hCrop = clamp(ch, 1, imgNatural.h - oy);

      const manipulated = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ crop: { originX: ox, originY: oy, width: wCrop, height: hCrop } }],
        { compress: 0.92, format: ImageManipulator.SaveFormat.JPEG },
      );
      const croppedUri = manipulated.uri;
      enqueueUpload({
        title: 'Uploading profile photo',
        successMessage: 'Profile photo updated',
        run: async (onProgress) => {
          await uploadProfilePhoto(token, croppedUri, onProgress);
          await refreshMe();
        },
      });
      navigation.goBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setSaving(false);
    }
  };

  if (!token) {
    return null;
  }

  const dimTop = top;
  const dimBottom = layout.h - top - side;
  const dimLeftW = left;
  const dimRightW = layout.w - left - side;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.root} onLayout={onRootLayout}>
        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <View style={StyleSheet.absoluteFill} {...panResponder.panHandlers}>
          <View style={[styles.dim, { height: dimTop }]} />
          <View style={{ flexDirection: 'row', height: side }}>
            <View style={[styles.dim, { width: dimLeftW }]} />
            <View
              ref={cropLayoutRef}
              onLayout={() => {
                requestAnimationFrame(() => measureCropWindow());
              }}
              style={{ width: side, height: side, overflow: 'hidden', backgroundColor: '#000' }}
            >
              {imgNatural && display.w > 0 ? (
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    position: 'absolute',
                    left: pan.x,
                    top: pan.y,
                    width: display.w,
                    height: display.h,
                  }}
                  resizeMode="cover"
                />
              ) : null}
            </View>
            <View style={[styles.dim, { width: dimRightW }]} />
          </View>
          <View style={[styles.dim, { height: dimBottom }]} />
        </View>

        <View style={styles.toolbar} pointerEvents="box-none">
          <Text style={styles.hint}>Pinch to zoom inside the square. Drag the photo to frame your shot.</Text>
          <Text style={styles.zoomHint}>{Math.round(zoom * 100)}%</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancel} onPress={() => navigation.goBack()} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.save, saving && styles.saveDisabled]}
              onPress={() => void onSave()}
              disabled={saving || !imgNatural}
            >
              {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Save</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#000',
  },
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  dim: {
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  errorBanner: {
    position: 'absolute',
    top: 48,
    left: 16,
    right: 16,
    zIndex: 20,
    color: '#fff',
    backgroundColor: 'rgba(180,30,30,0.9)',
    padding: 10,
    borderRadius: 8,
    overflow: 'hidden',
  },
  toolbar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingBottom: 16,
    paddingTop: 12,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  hint: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 6,
  },
  zoomHint: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  cancel: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
  },
  cancelText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  save: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: Colors.orange,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  saveDisabled: {
    opacity: 0.6,
  },
  saveText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
  },
});
