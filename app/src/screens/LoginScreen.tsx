import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../lib/colors';
import type { RootStackParamList } from '../navigation/types';

export default function LoginScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'Login'>>();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError(t('login.errorMissing'));
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('login.errorFailed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerBlock}>
            <Text style={styles.wordmark}>{t('brand.title')}</Text>
            <Text style={styles.tagline}>{t('login.tagline')}</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>{t('login.email')}</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder={t('login.emailPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              editable={!submitting}
            />

            <Text style={styles.label}>{t('login.password')}</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('login.passwordPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textContentType="password"
              autoComplete="password"
              editable={!submitting}
              onSubmitEditing={() => void onSubmit()}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                (pressed || submitting) && styles.primaryButtonPressed,
              ]}
              onPress={() => void onSubmit()}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.primaryButtonText}>{t('login.signIn')}</Text>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.linkWrap, pressed && styles.linkWrapPressed]}
              onPress={() => navigation.navigate('Signup')}
              disabled={submitting}
            >
              <Text style={styles.linkText}>{t('login.createAccount')}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 32,
    justifyContent: 'center',
  },
  headerBlock: {
    marginBottom: 36,
    alignItems: 'center',
  },
  wordmark: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  tagline: {
    marginTop: 8,
    fontSize: 16,
    color: Colors.textSecondary,
  },
  form: {
    width: '100%',
    maxWidth: 400,
    alignSelf: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === 'ios' ? 14 : 12,
    fontSize: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.background,
    marginBottom: 16,
  },
  error: {
    color: Colors.red,
    fontSize: 14,
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: Colors.orange,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  linkWrap: {
    marginTop: 20,
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkWrapPressed: {
    opacity: 0.7,
  },
  linkText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.teal,
  },
});
