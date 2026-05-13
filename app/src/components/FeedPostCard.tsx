import { useMemo, useState } from 'react';
import {
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import type { FeedPostItem } from '../types/feed';
import { Colors } from '../lib/colors';

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

type Props = {
  item: FeedPostItem;
  authHeader: Record<string, string> | undefined;
};

export function FeedPostCard({ item, authHeader }: Props) {
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

  return (
    <View style={styles.post}>
      <View style={styles.postHeader}>
        <View style={styles.avatarPlaceholder}>
          <Text style={styles.avatarLetter}>
            {item.author_display_name.trim().charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        <View style={styles.headerText}>
          <Text style={styles.authorName} numberOfLines={1}>
            {item.author_display_name}
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
        <View style={styles.fakeActions}>
          <Text style={styles.fakeActionIcon}>♡</Text>
          <Text style={styles.fakeActionIcon}>💬</Text>
        </View>
        {item.comment ? (
          <Text style={styles.caption}>
            <Text style={styles.captionAuthor}>{item.author_display_name} </Text>
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
  avatarPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  fakeActions: {
    flexDirection: 'row',
    gap: 16,
  },
  fakeActionIcon: {
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
