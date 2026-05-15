import type { TFunction } from 'i18next';
import { Colors } from '../../lib/colors';
import { formatFeedTimestamp } from '../../lib/formatFeedTimestamp';

describe('core lib smoke', () => {
  it('exposes the primary brand color', () => {
    expect(Colors.orange).toBe('#ff9128');
  });

  it('formats a recent feed timestamp', () => {
    const t = ((key: string, opts?: { count?: number }) => {
      if (key === 'feed.now') return 'now';
      if (key === 'feed.minutesShort') return `${opts?.count ?? 0}m`;
      return key;
    }) as TFunction;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    expect(formatFeedTimestamp(twoMinutesAgo, t, 'en')).toBe('2m');
  });
});
