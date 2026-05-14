import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../lib/colors';
import { fetchMeTournamentLeaderboards } from '../lib/tournamentLeaderboardApi';
import type {
  MeActiveTournamentLeaderboard,
  MeTournamentLeaderboardRow,
  MeTournamentLeaderboardsPayload,
} from '../types/tournamentLeaderboard';

export default function LeaderboardScreen() {
  const { token } = useAuth();
  const [data, setData] = useState<MeTournamentLeaderboardsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }
    setError(null);
    try {
      const payload = await fetchMeTournamentLeaderboards(token);
      setData(payload);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load leaderboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      return;
    }
    setLoading(true);
    void load();
  }, [token, load]);

  const onRefresh = useCallback(() => {
    if (!token) {
      return;
    }
    setRefreshing(true);
    void load();
  }, [token, load]);

  const myTeamId = data?.my_team_id ?? null;
  const boards = data?.active_leaderboards ?? [];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Leaderboard</Text>
        <Text style={styles.subtitle}>Active tournaments your team is enrolled in</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry} onPress={() => void load()}>
            Tap to retry
          </Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.orange}
              colors={Platform.OS === 'android' ? [Colors.orange] : undefined}
            />
          }
        >
          {boards.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>No active tournament leaderboard</Text>
              <Text style={styles.emptyBody}>
                When your team is enrolled in a tournament that is running on your profile time zone, team
                rankings appear here. Same active window as the Challenges tab.
              </Text>
            </View>
          ) : (
            boards.map((board) => (
              <TournamentBoard key={board.tournament_id} board={board} myTeamId={myTeamId} />
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function TournamentBoard({
  board,
  myTeamId,
}: {
  board: MeActiveTournamentLeaderboard;
  myTeamId: string | null;
}) {
  return (
    <View style={styles.board}>
      <Text style={styles.boardTitle} numberOfLines={2}>
        {board.tournament_name}
      </Text>
      {board.rows.length === 0 ? (
        <Text style={styles.muted}>No teams enrolled yet.</Text>
      ) : (
        <View style={styles.table}>
          <View style={[styles.row, styles.headerRow]}>
            <Text style={[styles.cell, styles.cellRank, styles.headerCell]}>#</Text>
            <Text style={[styles.cell, styles.cellTeam, styles.headerCell]}>Team</Text>
            <Text style={[styles.cell, styles.cellNum, styles.headerCell]}>Points</Text>
          </View>
          {board.rows.map((row) => (
            <LeaderboardRow key={row.team_id} row={row} highlight={myTeamId !== null && row.team_id === myTeamId} />
          ))}
        </View>
      )}
    </View>
  );
}

function LeaderboardRow({ row, highlight }: { row: MeTournamentLeaderboardRow; highlight: boolean }) {
  return (
    <View style={[styles.row, styles.dataRow, highlight && styles.rowHighlight]}>
      <Text style={[styles.cell, styles.cellRank]}>{row.rank}</Text>
      <Text style={[styles.cell, styles.cellTeam]} numberOfLines={2}>
        {row.team_name}
      </Text>
      <Text style={[styles.cell, styles.cellNum]}>{row.total_points}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.textPrimary,
  },
  subtitle: {
    marginTop: 4,
    fontSize: 14,
    color: Colors.textSecondary,
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
    paddingVertical: 48,
  },
  scrollContent: {
    paddingBottom: 32,
    flexGrow: 1,
  },
  empty: {
    paddingHorizontal: 28,
    paddingTop: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
    color: Colors.textSecondary,
  },
  board: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  boardTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 10,
  },
  muted: {
    fontSize: 14,
    color: Colors.textMuted,
  },
  table: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  headerRow: {
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 8,
  },
  dataRow: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  rowHighlight: {
    backgroundColor: 'rgba(148, 182, 2, 0.2)',
  },
  headerCell: {
    fontWeight: '700',
    fontSize: 12,
    color: Colors.textSecondary,
  },
  cell: {
    fontSize: 14,
    color: Colors.textPrimary,
  },
  cellRank: {
    width: 36,
    textAlign: 'center',
  },
  cellTeam: {
    flex: 1,
    paddingRight: 6,
  },
  cellNum: {
    width: 76,
    textAlign: 'right',
  },
});
