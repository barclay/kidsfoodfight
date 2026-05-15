import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useLayoutEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { ChallengesStackParamList } from '../navigation/types';
import { challengeTypeLabel } from '../lib/challengeTypeLabel';
import { Colors } from '../lib/colors';

type Props = NativeStackScreenProps<ChallengesStackParamList, 'ChallengeDetail'>;

export default function ChallengeDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { challenge } = route.params;

  useLayoutEffect(() => {
    const t = challenge.title;
    navigation.setOptions({
      title: t.length > 34 ? `${t.slice(0, 34)}…` : t,
    });
  }, [navigation, challenge.title]);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.tournament}>{challenge.tournament_name}</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaPill}>{t('common.day', { day: challenge.day })}</Text>
          <Text style={styles.metaPill}>{challengeTypeLabel(t, challenge.challenge_type)}</Text>
          <Text style={styles.points}>{t('common.points', { count: challenge.points })}</Text>
        </View>
        <Text style={styles.title}>{challenge.title}</Text>
        {challenge.description ? (
          <Text style={styles.description}>{challenge.description}</Text>
        ) : (
          <Text style={styles.muted}>{t('challengeDetail.noInstructions')}</Text>
        )}
      </ScrollView>
      <View style={styles.footer}>
        <Pressable
          style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
          onPress={() =>
            navigation.navigate('ChallengePost', {
              challengeId: challenge.id,
              challengeTitle: challenge.title,
            })
          }
        >
          <Text style={styles.ctaText}>{t('challengeDetail.letsGo')}</Text>
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
    paddingTop: 16,
    paddingBottom: 24,
  },
  tournament: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.purple,
    marginBottom: 10,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  metaPill: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: Colors.surface,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  points: {
    fontSize: 13,
    fontWeight: '800',
    color: Colors.lime,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.4,
    color: Colors.textPrimary,
    marginBottom: 14,
  },
  description: {
    fontSize: 17,
    lineHeight: 26,
    color: Colors.textPrimary,
  },
  muted: {
    fontSize: 16,
    lineHeight: 24,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  cta: {
    backgroundColor: Colors.orange,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 54,
  },
  ctaPressed: {
    opacity: 0.9,
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
