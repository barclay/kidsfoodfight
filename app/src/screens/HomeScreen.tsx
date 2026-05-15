import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FeedPostCard } from '../components/FeedPostCard';
import { useAuth } from '../context/AuthContext';
import { PAGE_SIZE, fetchFeedPosts } from '../lib/feedApi';
import { Colors } from '../lib/colors';
import type { FeedPostItem } from '../types/feed';

export default function HomeScreen() {
  const { t } = useTranslation();
  const { token } = useAuth();
  const [posts, setPosts] = useState<FeedPostItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const authHeader = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

  const onLikePatch = useCallback((postId: string, patch: Pick<FeedPostItem, 'like_count' | 'liked_by_me'>) => {
    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...patch } : p)));
  }, []);

  const loadPage = useCallback(
    async (skip: number, mode: 'replace' | 'append') => {
      if (!token) {
        return;
      }
      const page = await fetchFeedPosts(token, skip);
      setHasMore(page.length >= PAGE_SIZE);
      setPosts((prev) => {
        if (mode === 'replace') {
          return page;
        }
        const seen = new Set(prev.map((p) => p.id));
        const merged = [...prev];
        for (const p of page) {
          if (!seen.has(p.id)) {
            seen.add(p.id);
            merged.push(p);
          }
        }
        return merged;
      });
    },
    [token],
  );

  const bootstrap = useCallback(async () => {
    if (!token) {
      return;
    }
    setError(null);
    setInitialLoading(true);
    try {
      await loadPage(0, 'replace');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('home.errorLoad'));
    } finally {
      setInitialLoading(false);
    }
  }, [token, loadPage, t]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const onRefresh = useCallback(async () => {
    if (!token) {
      return;
    }
    setRefreshing(true);
    setError(null);
    try {
      await loadPage(0, 'replace');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('home.errorLoad'));
    } finally {
      setRefreshing(false);
    }
  }, [token, loadPage, t]);

  const onEndReached = useCallback(async () => {
    if (!token || !hasMore || loadingMore || initialLoading || refreshing) {
      return;
    }
    setLoadingMore(true);
    setError(null);
    try {
      await loadPage(posts.length, 'append');
    } catch (e) {
      setError(e instanceof Error ? e.message : t('home.errorMore'));
    } finally {
      setLoadingMore(false);
    }
  }, [token, hasMore, loadingMore, initialLoading, refreshing, posts.length, loadPage, t]);

  if (!token) {
    return null;
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.topBarTitle}>{t('brand.title')}</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorRetry} onPress={() => void bootstrap()}>
            {t('common.retry')}
          </Text>
        </View>
      ) : null}

      {initialLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.orange} />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <FeedPostCard
              item={item}
              authHeader={authHeader}
              token={token}
              onLikePatch={onLikePatch}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={Colors.orange} />
          }
          onEndReached={() => void onEndReached()}
          onEndReachedThreshold={0.35}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>{t('home.emptyTitle')}</Text>
              <Text style={styles.emptyBody}>{t('home.emptyBody')}</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator color={Colors.orange} />
              </View>
            ) : null
          }
          contentContainerStyle={posts.length === 0 ? styles.listEmptyGrow : undefined}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.surface,
  },
  topBar: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  topBarTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
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
  listEmptyGrow: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 15,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  footerLoading: {
    paddingVertical: 20,
  },
});
