import type { TFunction } from 'i18next';

/** Relative / short absolute timestamps for feed cards (locale-aware date for older posts). */
export function formatFeedTimestamp(iso: string, t: TFunction, localeTag: string): string {
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) {
    return t('feed.now');
  }
  if (mins < 60) {
    return t('feed.minutesShort', { count: mins });
  }
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) {
    return t('feed.hoursShort', { count: hrs });
  }
  const days = Math.floor(hrs / 24);
  if (days < 7) {
    return t('feed.daysShort', { count: days });
  }
  const locale = localeTag.startsWith('es') ? 'es' : 'en';
  return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}
