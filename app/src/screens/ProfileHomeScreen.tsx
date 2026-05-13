import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { mediaUrlForStorageKey } from '../lib/mediaUrl';
import type { ProfileStackParamList } from '../navigation/types';
import { Colors } from '../lib/colors';

type Nav = NativeStackNavigationProp<ProfileStackParamList, 'ProfileHome'>;

export default function ProfileHomeScreen() {
  const navigation = useNavigation<Nav>();
  const { token, me, refreshMe, signOut } = useAuth();

  const pickAndCrop = async () => {
    if (!token) {
      return;
    }
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      navigation.navigate('ProfilePhotoCrop', { imageUri: result.assets[0].uri });
    }
  };

  if (!token) {
    return null;
  }

  const photoUrl = me?.profile_photo_storage_url ? mediaUrlForStorageKey(me.profile_photo_storage_url) : null;
  const initial = (me?.display_name ?? '?').trim().charAt(0).toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
      </View>

      <View style={styles.body}>
        {!me ? (
          <ActivityIndicator size="large" color={Colors.orange} style={{ marginTop: 24 }} />
        ) : (
          <>
            <Pressable style={styles.avatarWrap} onPress={() => void pickAndCrop()}>
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl, headers: { Authorization: `Bearer ${token}` } }}
                  style={styles.avatarImg}
                />
              ) : (
                <View style={styles.avatarFallback}>
                  <Text style={styles.avatarLetter}>{initial}</Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Text style={styles.avatarBadgeText}>Edit</Text>
              </View>
            </Pressable>

            <Text style={styles.displayName}>{me.display_name}</Text>
            <Text style={styles.email}>{me.email}</Text>
            <Text style={styles.meta}>Time zone: {me.timezone}</Text>

            <Pressable style={styles.secondaryBtn} onPress={() => void pickAndCrop()}>
              <Text style={styles.secondaryBtnText}>Change profile photo</Text>
            </Pressable>
            <Pressable style={styles.secondaryBtn} onPress={() => void refreshMe()}>
              <Text style={styles.secondaryBtnText}>Refresh profile</Text>
            </Pressable>
          </>
        )}

        <View style={{ flex: 1 }} />

        <Pressable
          style={({ pressed }) => [styles.signOut, pressed && styles.signOutPressed]}
          onPress={() => void signOut()}
        >
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const AV = 112;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  body: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 28,
    alignItems: 'center',
  },
  avatarWrap: {
    width: AV,
    height: AV,
    borderRadius: AV / 2,
    overflow: 'hidden',
    marginBottom: 16,
    borderWidth: 3,
    borderColor: Colors.border,
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    backgroundColor: Colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    fontSize: 44,
    fontWeight: '800',
    color: '#fff',
  },
  avatarBadge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    paddingVertical: 4,
    alignItems: 'center',
  },
  avatarBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  displayName: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  email: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  meta: {
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: 20,
  },
  secondaryBtn: {
    alignSelf: 'stretch',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    marginBottom: 10,
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.teal,
  },
  signOut: {
    marginTop: 'auto',
    marginBottom: 24,
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    alignSelf: 'stretch',
    alignItems: 'center',
  },
  signOutPressed: {
    opacity: 0.85,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
});
