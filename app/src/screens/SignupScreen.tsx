import { useState } from 'react';
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
import { useAuth } from '../context/AuthContext';
import { Colors } from '../lib/colors';

type SignupMode = 'new_team' | 'invite';

const PASSWORD_HINT =
  'At least 6 characters, one letter, one digit, no spaces.';

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'America/Los_Angeles';
  } catch {
    return 'America/Los_Angeles';
  }
}

export default function SignupScreen() {
  const { signUp } = useAuth();
  const [mode, setMode] = useState<SignupMode>('new_team');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit() {
    setError(null);
    const dn = displayName.trim();
    const em = email.trim();
    if (!dn || !em || !password) {
      setError('Display name, email, and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (mode === 'new_team') {
      if (!teamName.trim()) {
        setError('Enter a name for your family team.');
        return;
      }
    } else if (!inviteCode.trim()) {
      setError('Enter your team invite code.');
      return;
    }

    setSubmitting(true);
    try {
      await signUp({
        email: em,
        password,
        display_name: dn,
        timezone: deviceTimezone(),
        ...(mode === 'new_team'
          ? { team_name: teamName.trim() }
          : { invite_code: inviteCode.trim() }),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign up failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.hint}>{PASSWORD_HINT}</Text>

          <View style={styles.segment}>
            <Pressable
              style={[styles.segmentBtn, mode === 'new_team' && styles.segmentBtnActive]}
              onPress={() => {
                setMode('new_team');
                setError(null);
              }}
              disabled={submitting}
            >
              <Text style={[styles.segmentText, mode === 'new_team' && styles.segmentTextActive]}>
                New team
              </Text>
            </Pressable>
            <Pressable
              style={[styles.segmentBtn, mode === 'invite' && styles.segmentBtnActive]}
              onPress={() => {
                setMode('invite');
                setError(null);
              }}
              disabled={submitting}
            >
              <Text style={[styles.segmentText, mode === 'invite' && styles.segmentTextActive]}>
                Have invite
              </Text>
            </Pressable>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Display name</Text>
            <TextInput
              style={styles.input}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="How you appear in the app"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="words"
              textContentType="name"
              autoComplete="name"
              editable={!submitting}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@family.com"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!submitting}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Choose a password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              editable={!submitting}
            />

            <Text style={styles.label}>Confirm password</Text>
            <TextInput
              style={styles.input}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter password"
              placeholderTextColor={Colors.textMuted}
              secureTextEntry
              textContentType="newPassword"
              autoComplete="password-new"
              editable={!submitting}
              onSubmitEditing={() => void onSubmit()}
            />

            {mode === 'new_team' ? (
              <>
                <Text style={styles.label}>Family team name</Text>
                <TextInput
                  style={styles.input}
                  value={teamName}
                  onChangeText={setTeamName}
                  placeholder="e.g. The Lopez Crew"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="words"
                  editable={!submitting}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Team invite code</Text>
                <TextInput
                  style={styles.input}
                  value={inviteCode}
                  onChangeText={setInviteCode}
                  placeholder="14-character code from your captain"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  editable={!submitting}
                />
              </>
            )}

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
                <Text style={styles.primaryButtonText}>Create account</Text>
              )}
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
    paddingTop: 8,
    paddingBottom: 32,
  },
  hint: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 16,
    lineHeight: 18,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
    marginBottom: 20,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  segmentBtnActive: {
    backgroundColor: Colors.orange,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentTextActive: {
    color: '#fff',
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
    marginTop: 4,
  },
  primaryButtonPressed: {
    opacity: 0.88,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
