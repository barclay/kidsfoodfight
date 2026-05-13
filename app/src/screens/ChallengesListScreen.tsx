import { useFocusEffect, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import type { ChallengesStackParamList } from '../navigation/types';
import { fetchAvailableChallenges } from '../lib/challengesApi';
import { Colors } from '../lib/colors';
import type { AvailableChallenge } from '../types/challenges';

type Section = { title: string; data: AvailableChallenge[] };
type Nav = NativeStackNavigationProp<ChallengesStackParamList, 'ChallengesList'>;

function buildSections(items: AvailableChallenge[]): Section[] {
  const order: string[] = [];
  const byTournament = new Map<string, AvailableChallenge[]>();
  for (const c of items) {
    let list = byTournament.get(c.tournament_id);
    if (!list) {
      list = [];
      byTournament.set(c.tournament_id, list);
      order.push(c.tournament_id);
    }
    list.push(c);
  }
  return order.map((tid) => {
    const data = byTournament.get(tid) ?? [];
    const title = data[0]?.tournament_name ?? tid;
    data.sort((a, b) => a.day - b.day || a.title.localeCompare(b.title));
    return { title, data };
  });
}

function typeLabel(t: string): string {
  switch (t) {
    case 'food':
      return 'Food';
    case 'fitness':
      return 'Fitness';
    case 'shopping':
      return 'Shopping';
    case 'game':
      return 'Game';
    default:
      return t;
  }
}

function ChallengeRow({ item, onPress }: { item: AvailableChallenge; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, item.is_focus_day && styles.rowFocus, pressed && styles.rowPressed]}
    >
      <View style={styles.rowTop}>
        <View style={styles.rowTopLeft}>
          <Text style={styles.dayPill}>Day {item.day}</Text>
          <Text style={styles.typePill}>{typeLabel(item.challenge_type)}</Text>
        </View>
        <Text style={styles.points}>{item.points} pts</Text>
      </View>
      <Text style={styles.challengeTitle}>{item.title}</Text>
    </Pressable>
  );
}

export default function ChallengesListScreen() {
  const navigation = useNavigation<Nav>();
  const { token } = useAuth();
  const [items, setItems] = useState<AvailableChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sections = useMemo(() => buildSections(items), [items]);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError(null);
    const data = await fetchAvailableChallenges(token);
    setItems(data);
  }, [token]);

  useFocusEffect(
    useCallback(() => {
      if (!token) {
        return undefined;
      }
      let active = true;
      setLoading(true);
      void (async () => {
        try {
          await load();
        } catch (e) {
          if (active) {
            setError(e instanceof Error ? e.message : 'Could not load challenges.');
          }
        } finally {
          if (active) {
            setLoading(false);
          }
        }
      })();
      return () => {
        active = false;
      };
    }, [token, load]),
  );

  const onRefresh = useCallback(async () => {
    if (!token) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load challenges.');
    } finally {
      setRefreshing(false);
    }
  }, [token, load]);

  if (!token) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Challenges</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry} onPress={() => void onRefresh()}>
            Tap to retry
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No challenges right now</Text>
          <Text style={styles.emptyBody}>
            Join a team enrolled in an active tournament to see challenges here. Completed challenges
            disappear from this list. Days follow your profile time zone.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ChallengeRow
              item={item}
              onPress={() => navigation.navigate('ChallengeDetail', { challenge: item })}
            />
          )}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle} numberOfLines={2}>
                {title}
              </Text>
            </View>
          )}
          stickySectionHeadersEnabled
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.orange} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

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
  errorBanner: {
    backgroundColor: '#fff4e6',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  errorText: {
    color: Colors.textPrimary,
    fontSize: 14,
  },
  errorRetry: {
    marginTop: 6,
    color: Colors.teal,
    fontWeight: '700',
    fontSize: 14,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  listContent: {
    paddingBottom: 24,
  },
  sectionHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.purple,
    letterSpacing: -0.2,
  },
  row: {
    backgroundColor: Colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowPressed: {
    opacity: 0.92,
  },
  rowFocus: {
    borderLeftWidth: 4,
    borderLeftColor: Colors.orange,
    paddingLeft: 12,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    gap: 8,
  },
  rowTopLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    flex: 1,
  },
  dayPill: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.teal,
    backgroundColor: '#e6f7f6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  typePill: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    backgroundColor: Colors.background,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    overflow: 'hidden',
  },
  points: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.lime,
  },
  challengeTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
});
