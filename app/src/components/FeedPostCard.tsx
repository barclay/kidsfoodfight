import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { FeedPostItem } from '../types/feed';
import { Colors } from '../lib/colors';
import { likeFeedPost, unlikeFeedPost } from '../lib/feedApi';

function formatFeedTimestamp(iso: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatAuthorAttribution(item: FeedPostItem): string {
  const name = item.author_display_name.trim() || '?';
  const team = item.author_team_name?.trim();
  return team ? `${team} - ${name}` : name;
}

type Props = {
  item: FeedPostItem;
  authHeader: Record<string, string> | undefined;
  token: string | null;
  onLikePatch: (postId: string, patch: Pick<FeedPostItem, 'like_count' | 'liked_by_me'>) => void;
};

export function FeedPostCard({ item, authHeader, token, onLikePatch }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const photos = useMemo(
    () => [...item.photos].sort((a, b) => a.sort_order - b.sort_order),
    [item.photos],
  );
  const [carouselIndex, setCarouselIndex] = useState(0);
  const mediaHeight = Math.round(screenWidth * 1.05);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const x = e.nativeEvent.contentOffset.x;
    const idx = Math.round(x / screenWidth);
    setCarouselIndex(Math.max(0, Math.min(photos.length - 1, idx)));
  };

  const [likeBusy, setLikeBusy] = useState(false);

  const toggleLike = async () => {
    if (!token || likeBusy) return;
    setLikeBusy(true);
    try {
      const next = item.liked_by_me
        ? await unlikeFeedPost(token, item.id)
        : await likeFeedPost(token, item.id);
      onLikePatch(item.id, {
        like_count: next.like_count,
        liked_by_me: next.liked_by_me,
      });
    } catch {
      // Keep prior UI; optional: toast later
    } finally {
      setLikeBusy(false);
    }
  };

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <View style={styles.avatarWrap}>
          {item.author_profile_photo_url ? (
            <Image
              source={{ uri: item.author_profile_photo_url, headers: authHeader }}
              style={styles.avatarImg}
            />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarLetter}>
                {item.author_display_name.trim().charAt(0).toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </View>
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={2}>
            {formatAuthorAttribution(item)}
          </Text>
          <Text style={styles.challengeLine} numberOfLines={1}>
            {item.challenge_title}
          </Text>
        </View>
        {!item.approved ? (
          <View style={styles.pendingBadge}>
            <Text style={styles.pendingBadgeText}>Pending</Text>
          </View>
        ) : null}
        <Text style={styles.time}>{formatFeedTimestamp(item.created_at)}</Text>
      </View>

      {photos.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={screenWidth}
            snapToAlignment="start"
            onMomentumScrollEnd={onMomentumScrollEnd}
          >
            {photos.map((ph) => (
              <Image
                key={`${item.id}-${ph.sort_order}-${ph.url}`}
                source={{ uri: ph.url, headers: authHeader }}
                style={{ width: screenWidth, height: mediaHeight }}
                resizeMode="cover"
              />
            ))}
          </ScrollView>
          {photos.length > 1 ? (
            <View style={styles.dotRow}>
              {photos.map((_, i) => (
                <View
                  key={String(i)}
                  style={[styles.dot, i === carouselIndex ? styles.dotActive : styles.dotInactive]}
                />
              ))}
            </View>
          ) : null}
          {photos.some((p) => p.description) ? (
            <Text style={styles.photoDescription} numberOfLines={4}>
              {photos
                .map((p) => p.description)
                .filter((d): d is string => Boolean(d && d.trim()))
                .join(' · ')}
            </Text>
          ) : null}
        </View>
      ) : (
        <View style={[styles.textOnlyMedia, { minHeight: Math.min(120, mediaHeight * 0.35) }]}>
          <Text style={styles.textOnlyLabel}>Text post</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.actionsRow}>
          <View style={styles.likeWrap}>
            <Pressable
              onPress={() => void toggleLike()}
              disabled={!token || likeBusy}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={item.liked_by_me ? 'Unlike post' : 'Like post'}
              style={({ pressed }) => [styles.likePressable, pressed && token ? { opacity: 0.7 } : null]}
            >
              {likeBusy ? (
                <ActivityIndicator size="small" color={Colors.red} style={styles.likeSpinner} />
              ) : (
                <Text
                  style={[styles.heartGlyph, item.liked_by_me ? styles.heartLiked : styles.heartHollow]}
                  accessibilityElementsHidden
                  importantForAccessibility="no"
                >
                  {item.liked_by_me ? '♥' : '♡'}
                </Text>
              )}
            </Pressable>
            {item.like_count > 0 ? (
              <Text style={styles.likeCount} accessibilityLabel={`${item.like_count} likes`}>
                {item.like_count}
              </Text>
            ) : null}
          </View>
          <Text style={styles.fakeCommentIcon} accessibilityElementsHidden>
            💬
          </Text>
        </View>
        {item.comment ? (
          <Text style={styles.caption}>
            <Text style={styles.captionAuthor}>{formatAuthorAttribution(item)} </Text>
            {item.comment}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  post: {
    backgroundColor: Colors.surface,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
    paddingBottom: 12,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: Colors.border,
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
    fontSize: 18,
    fontWeight: '800',
    color: '#fff',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  authorName: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  challengeLine: {
    fontSize: 12,
    color: Colors.teal,
    marginTop: 2,
    fontWeight: '500',
  },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 145, 40, 0.2)',
  },
  pendingBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.orange,
    textTransform: 'uppercase',
  },
  time: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 8,
  },
  photoDescription: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 12,
    paddingBottom: 6,
    fontStyle: 'italic',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    backgroundColor: Colors.orange,
  },
  dotInactive: {
    backgroundColor: Colors.border,
  },
  textOnlyMedia: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    marginHorizontal: 12,
    borderRadius: 8,
  },
  textOnlyLabel: {
    fontSize: 13,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  footer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    gap: 6,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  likeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 48,
  },
  likePressable: {
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  likeSpinner: {
    transform: [{ scale: 0.85 }],
  },
  heartGlyph: {
    fontSize: 24,
    lineHeight: 28,
    fontWeight: '600',
  },
  heartLiked: {
    color: Colors.red,
  },
  heartHollow: {
    color: Colors.textMuted,
  },
  likeCount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 20,
  },
  fakeCommentIcon: {
    fontSize: 22,
    opacity: 0.55,
  },
  caption: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textPrimary,
  },
  captionAuthor: {
    fontWeight: '700',
  },
});
