import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PlacedStickerView, type PlacedStickerState } from '../components/PlacedStickerView';
import { useAuth } from '../context/AuthContext';
import { useUploadToast } from '../context/UploadToastContext';
import { CHALLENGE_STICKER_PALETTE } from '../lib/challengeStickerPalette';
import { containRect, photoEditorStageLayout, screenToNorm } from '../lib/challengeStickerMath';
import { createFeedPost } from '../lib/feedPostsApi';
import { Colors } from '../lib/colors';
import type { ChallengesStackParamList } from '../navigation/types';
import type { ChallengeOverlaysPayload } from '../types/challengeOverlays';

type Props = NativeStackScreenProps<ChallengesStackParamList, 'ChallengePhotoEditor'>;

const DEFAULT_WIDTH_FR = 0.2;

export default function ChallengePhotoEditorScreen({ navigation, route }: Props) {
  const { challengeId, challengeTitle, imageUris, comment } = route.params;
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { token } = useAuth();
  const { enqueueUpload } = useUploadToast();

  const [photoIndex, setPhotoIndex] = useState(0);
  const [activeStickerId, setActiveStickerId] = useState<string | null>(CHALLENGE_STICKER_PALETTE[0].id);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [stickersByPhoto, setStickersByPhoto] = useState<PlacedStickerState[][]>(() =>
    imageUris.map(() => []),
  );
  const [selectedStickerKey, setSelectedStickerKey] = useState<string | null>(null);
  const [pagerLocked, setPagerLocked] = useState(false);
  /** Measured width of the photo pager; use for layout + stickers so it matches `useWindowDimensions` width. */
  const [editorViewportW, setEditorViewportW] = useState(screenW);

  useEffect(() => {
    setEditorViewportW(screenW);
  }, [screenW]);

  useEffect(() => {
    setSelectedStickerKey(null);
  }, [photoIndex]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const next: Record<string, { w: number; h: number }> = {};
      for (const uri of imageUris) {
        try {
          await new Promise<void>((resolve, reject) => {
            Image.getSize(
              uri,
              (w, h) => {
                next[uri] = { w, h };
                resolve();
              },
              reject,
            );
          });
        } catch {
          next[uri] = { w: 1, h: 1 };
        }
      }
      if (!cancelled) {
        setSizes(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [imageUris]);

  const updateSticker = useCallback((photoIdx: number, key: string, patch: Partial<PlacedStickerState>) => {
    setStickersByPhoto((prev) => {
      const copy = prev.map((row) => [...row]);
      const row = copy[photoIdx];
      const i = row.findIndex((s) => s.key === key);
      if (i < 0) {
        return prev;
      }
      row[i] = { ...row[i], ...patch };
      copy[photoIdx] = row;
      return copy;
    });
  }, []);

  const removeSticker = useCallback((photoIdx: number, key: string) => {
    setSelectedStickerKey((sel) => (sel === key ? null : sel));
    setStickersByPhoto((prev) =>
      prev.map((row, ri) => (ri === photoIdx ? row.filter((s) => s.key !== key) : [...row])),
    );
  }, []);

  const addStickerAt = useCallback(
    (photoIdx: number, nx: number, ny: number) => {
      if (!activeStickerId) {
        return;
      }
      const key = `s-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const next: PlacedStickerState = {
        key,
        stickerId: activeStickerId,
        cx: nx,
        cy: ny,
        widthFraction: DEFAULT_WIDTH_FR,
      };
      setStickersByPhoto((prev) => {
        const copy = prev.map((row) => [...row]);
        copy[photoIdx] = [...copy[photoIdx], next];
        return copy;
      });
      setSelectedStickerKey(key);
    },
    [activeStickerId],
  );

  const clearCurrentPhoto = useCallback(() => {
    setSelectedStickerKey(null);
    setStickersByPhoto((prev) => prev.map((row, i) => (i === photoIndex ? [] : [...row])));
  }, [photoIndex]);

  const onStickerPagerLock = useCallback((locked: boolean) => {
    setPagerLocked(locked);
  }, []);

  const submit = useCallback(() => {
    if (!token) {
      return;
    }
    const photos: ChallengeOverlaysPayload['photos'] = imageUris.map((_, i) =>
      stickersByPhoto[i].map((s) => ({
        sticker_id: s.stickerId,
        center_x: s.cx,
        center_y: s.cy,
        width_fraction: s.widthFraction,
        rotation: 0,
      })),
    );
    const overlays: ChallengeOverlaysPayload = { version: 1, photos };
    enqueueUpload({
      title: 'Posting your challenge',
      successMessage: 'Submission sent',
      run: (onProgress) =>
        createFeedPost(
          token,
          {
            challengeId,
            comment,
            fileUris: [...imageUris],
            overlays,
          },
          onProgress,
        ),
    });
    navigation.popToTop();
  }, [token, imageUris, stickersByPhoto, challengeId, comment, enqueueUpload, navigation]);

  const onPhotoPress = useCallback(
    (idx: number, lx: number, ly: number, uri: string) => {
      if (selectedStickerKey !== null) {
        setSelectedStickerKey(null);
        return;
      }
      if (!activeStickerId) {
        return;
      }
      const isz = sizes[uri] ?? { w: 1, h: 1 };
      const layout = photoEditorStageLayout(editorViewportW, screenH, isz.w, isz.h);
      const { nx, ny } = screenToNorm(lx, ly, layout.dispW, layout.dispH, layout.offX, layout.offY);
      addStickerAt(idx, nx, ny);
    },
    [activeStickerId, editorViewportW, screenH, sizes, addStickerAt, selectedStickerKey],
  );

  const renderPage = useCallback(
    ({ item: uri, index }: { item: string; index: number }) => {
      const isz = sizes[uri] ?? { w: 1, h: 1 };
      const layout = photoEditorStageLayout(editorViewportW, screenH, isz.w, isz.h);
      const list = stickersByPhoto[index] ?? [];
      return (
        <View
          style={[
            styles.pageCell,
            {
              width: editorViewportW,
            },
          ]}
        >
          <Pressable
            style={[
              styles.imageStage,
              { width: editorViewportW, height: layout.stageH },
            ]}
            onPress={(e) => {
              const lx = e.nativeEvent.locationX;
              const ly = e.nativeEvent.locationY;
              onPhotoPress(index, lx, ly, uri);
            }}
          >
            <Image
              source={{ uri }}
              style={{
                position: 'absolute',
                left: layout.offX,
                top: layout.offY,
                width: layout.dispW,
                height: layout.dispH,
              }}
              resizeMode="contain"
            />
            {list.map((st) => (
              <PlacedStickerView
                key={st.key}
                sticker={st}
                imgW={isz.w}
                imgH={isz.h}
                dispW={layout.dispW}
                dispH={layout.dispH}
                offX={layout.offX}
                offY={layout.offY}
                isSelected={selectedStickerKey === st.key}
                onSelect={() =>
                  setSelectedStickerKey((prev) => (prev === st.key ? null : st.key))
                }
                onInteractionLockChange={onStickerPagerLock}
                onChange={(key, patch) =>
                  updateSticker(index, key, {
                    cx: patch.cx,
                    cy: patch.cy,
                    widthFraction: patch.widthFraction,
                  })
                }
                onRemove={(key) => removeSticker(index, key)}
              />
            ))}
          </Pressable>
        </View>
      );
    },
    [
      editorViewportW,
      onPhotoPress,
      onStickerPagerLock,
      removeSticker,
      screenH,
      selectedStickerKey,
      sizes,
      stickersByPhoto,
      updateSticker,
    ],
  );

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>
          {challengeTitle.length > 36 ? `${challengeTitle.slice(0, 36)}…` : challengeTitle}
        </Text>
        <Text style={styles.sub}>Choose a sticker, and tap to place it</Text>
      </View>

      <View
        style={styles.pagerHost}
        onLayout={(e) => {
          const w = Math.round(e.nativeEvent.layout.width);
          if (w > 0 && w !== editorViewportW) {
            setEditorViewportW(w);
          }
        }}
      >
        <FlatList
          data={imageUris}
          horizontal
          pagingEnabled
          scrollEnabled={!pagerLocked}
          keyExtractor={(u, i) => `${i}-${u}`}
          renderItem={renderPage}
          showsHorizontalScrollIndicator={false}
          extraData={`${editorViewportW}-${Object.keys(sizes).length}`}
          style={styles.photoPager}
          getItemLayout={(_, index) => ({
            length: editorViewportW,
            offset: editorViewportW * index,
            index,
          })}
          onMomentumScrollEnd={(ev) => {
            const x = ev.nativeEvent.contentOffset.x;
            const idx = Math.round(x / editorViewportW);
            setPhotoIndex(Math.max(0, Math.min(imageUris.length - 1, idx)));
          }}
        />
      </View>

      <View style={styles.pageDots}>
        {imageUris.map((_, i) => (
          <View key={String(i)} style={[styles.dot, i === photoIndex ? styles.dotOn : styles.dotOff]} />
        ))}
      </View>

      <View style={styles.palette}>
        {CHALLENGE_STICKER_PALETTE.map((s) => (
          <Pressable
            key={s.id}
            style={[styles.paletteItem, activeStickerId === s.id && styles.paletteItemOn]}
            onPress={() => setActiveStickerId(s.id)}
          >
            <Text style={styles.paletteGlyph}>{s.glyph}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.toolbar}>
        <Pressable style={styles.secondary} onPress={clearCurrentPhoto}>
          <Text style={styles.secondaryText}>Clear this photo</Text>
        </Pressable>
        <Pressable style={styles.primary} onPress={submit}>
          <Text style={styles.primaryText}>Submit challenge</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  pagerHost: {
    flex: 1,
    minHeight: 200,
  },
  pageCell: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
  },
  photoPager: {
    flex: 1,
  },
  imageStage: {
    alignSelf: 'center',
    backgroundColor: Colors.background,
    overflow: 'visible',
  },
  pageDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotOn: {
    backgroundColor: Colors.orange,
  },
  dotOff: {
    backgroundColor: Colors.border,
  },
  palette: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  paletteItem: {
    width: 56,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paletteItemOn: {
    borderColor: Colors.teal,
    backgroundColor: 'rgba(16, 158, 154, 0.12)',
  },
  paletteGlyph: {
    fontSize: 30,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  secondary: {
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  secondaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  primary: {
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: Colors.teal,
    alignItems: 'center',
  },
  primaryText: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
});
