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
import { uploadProfilePhoto } from '../lib/profilePhotoApi';
import type { ProfileStackParamList } from '../navigation/types';
import { Colors } from '../lib/colors';

type Props = NativeStackScreenProps<ProfileStackParamList, 'ProfilePhotoCrop'>;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default function ProfilePhotoCropScreen({ navigation, route }: Props) {
  const { imageUri } = route.params;
  const { token, refreshMe } = useAuth();
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [imgNatural, setImgNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef(pan);
  panRef.current = pan;
  const dragOrigin = useRef({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const base = side / Math.min(imgNatural.w, imgNatural.h);
    const scale = base * zoom;
    return { w: imgNatural.w * scale, h: imgNatural.h * scale };
  }, [imgNatural, side, zoom]);

  useEffect(() => {
    Image.getSize(
      imageUri,
      (w, h) => setImgNatural({ w, h }),
      () => setError('Could not read image size.'),
    );
  }, [imageUri]);

  useEffect(() => {
    if (side <= 0 || display.w <= 0) {
      return;
    }
    setPan({
      x: (side - display.w) / 2,
      y: (side - display.h) / 2,
    });
  }, [imgNatural, side, zoom, display.w, display.h]);

  const clampPan = useCallback(
    (p: { x: number; y: number }) => ({
      x: clamp(p.x, side - display.w, 0),
      y: clamp(p.y, side - display.h, 0),
    }),
    [side, display.w, display.h],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          dragOrigin.current = { ...panRef.current };
        },
        onPanResponderMove: (_, g) => {
          setPan(
            clampPan({
              x: dragOrigin.current.x + g.dx,
              y: dragOrigin.current.y + g.dy,
            }),
          );
        },
      }),
    [clampPan],
  );

  const zoomOut = () => setZoom((z) => clamp(z / 1.12, 1, 4));
  const zoomIn = () => setZoom((z) => clamp(z * 1.12, 1, 4));

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
      await uploadProfilePhoto(token, manipulated.uri);
      await refreshMe();
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
            <View style={{ width: side, height: side, overflow: 'hidden', backgroundColor: '#000' }}>
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
          <Text style={styles.hint}>Drag to frame your shot. Use zoom to fill the square.</Text>
          <View style={styles.zoomRow}>
            <Pressable style={styles.zoomBtn} onPress={zoomOut} disabled={zoom <= 1 || saving}>
              <Text style={styles.zoomBtnText}>−</Text>
            </Pressable>
            <Text style={styles.zoomLabel}>{Math.round(zoom * 100)}%</Text>
            <Pressable style={styles.zoomBtn} onPress={zoomIn} disabled={zoom >= 4 || saving}>
              <Text style={styles.zoomBtnText}>+</Text>
            </Pressable>
          </View>
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
    marginBottom: 10,
  },
  zoomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    marginBottom: 14,
  },
  zoomBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '500',
    lineHeight: 32,
  },
  zoomLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    minWidth: 56,
    textAlign: 'center',
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
