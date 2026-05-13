import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { createFeedPost } from '../lib/feedPostsApi';
import type { ChallengesStackParamList } from '../navigation/types';
import { Colors } from '../lib/colors';

const MAX_PHOTOS = 6;

type Props = NativeStackScreenProps<ChallengesStackParamList, 'ChallengePost'>;

export default function ChallengePostScreen({ navigation, route }: Props) {
  const { challengeId, challengeTitle } = route.params;
  const { token } = useAuth();
  const [uris, setUris] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useLayoutEffect(() => {
    const t = challengeTitle;
    navigation.setOptions({
      title: t.length > 28 ? `${t.slice(0, 28)}…` : t,
    });
  }, [navigation, challengeTitle]);

  const pickFromLibrary = async () => {
    setError(null);
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Photo library access is needed to add images.');
      return;
    }
    const remaining = MAX_PHOTOS - uris.length;
    if (remaining <= 0) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: Platform.OS !== 'web',
      selectionLimit: remaining,
      quality: 0.85,
    });
    if (result.canceled) {
      return;
    }
    const next = result.assets.map((a) => a.uri).filter(Boolean);
    setUris((prev) => [...prev, ...next].slice(0, MAX_PHOTOS));
  };

  const takePhoto = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera', 'Use a device with the Expo app to take a photo, or choose from the library on web.');
      return;
    }
    setError(null);
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setError('Camera access is needed to take a photo.');
      return;
    }
    if (uris.length >= MAX_PHOTOS) {
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]?.uri) {
      return;
    }
    setUris((prev) => [...prev, result.assets[0].uri].slice(0, MAX_PHOTOS));
  };

  const removeAt = (index: number) => {
    setUris((prev) => prev.filter((_, i) => i !== index));
  };

  const submit = async () => {
    if (!token) {
      return;
    }
    const trimmed = comment.trim();
    if (uris.length === 0 && !trimmed) {
      setError('Add at least one photo or a short note for your submission.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await createFeedPost(token, {
        challengeId,
        comment: trimmed || undefined,
        fileUris: uris,
      });
      navigation.popToTop();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not submit.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) {
    return null;
  }

  const canSubmit = (uris.length > 0 || comment.trim().length > 0) && !submitting;

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.hint}>
          Add photos and/or a caption. Your post is reviewed before it appears on the feed.
        </Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => void pickFromLibrary()}
            disabled={uris.length >= MAX_PHOTOS}
          >
            <Text style={styles.secondaryBtnText}>Choose photos</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.secondaryBtn, pressed && styles.pressed]}
            onPress={() => void takePhoto()}
            disabled={uris.length >= MAX_PHOTOS}
          >
            <Text style={styles.secondaryBtnText}>Take photo</Text>
          </Pressable>
        </View>
        <Text style={styles.photoCount}>
          {uris.length}/{MAX_PHOTOS} photos
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbRow}>
          {uris.map((uri, index) => (
            <View key={`${uri}-${index}`} style={styles.thumbWrap}>
              <Image source={{ uri }} style={styles.thumb} />
              <Pressable style={styles.removeBtn} onPress={() => removeAt(index)} hitSlop={8}>
                <Text style={styles.removeBtnText}>×</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <Text style={styles.label}>Caption (optional)</Text>
        <TextInput
          style={styles.input}
          value={comment}
          onChangeText={setComment}
          placeholder="Tell us what you did…"
          placeholderTextColor={Colors.textMuted}
          multiline
          editable={!submitting}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [
            styles.submit,
            !canSubmit && styles.submitDisabled,
            pressed && canSubmit && styles.submitPressed,
          ]}
          onPress={() => void submit()}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Submit to challenge</Text>
          )}
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
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
  },
  hint: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
    marginBottom: 12,
  },
  error: {
    color: Colors.red,
    fontSize: 14,
    marginBottom: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  secondaryBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  pressed: {
    opacity: 0.88,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  photoCount: {
    fontSize: 13,
    color: Colors.textMuted,
    marginBottom: 10,
  },
  thumbRow: {
    gap: 10,
    paddingVertical: 8,
    marginBottom: 12,
  },
  thumbWrap: {
    position: 'relative',
  },
  thumb: {
    width: 96,
    height: 96,
    borderRadius: 10,
    backgroundColor: Colors.border,
  },
  removeBtn: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeBtnText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 22,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.surface,
    textAlignVertical: 'top',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  submit: {
    backgroundColor: Colors.teal,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  submitDisabled: {
    opacity: 0.45,
  },
  submitPressed: {
    opacity: 0.92,
  },
  submitText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
  },
});
