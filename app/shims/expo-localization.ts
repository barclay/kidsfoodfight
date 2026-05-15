/**
 * Pure-JS stand-in for `expo-localization` when the native `ExpoLocalization` module
 * is not present (e.g. dev client not rebuilt). Metro resolves `expo-localization` here.
 * API surface mirrors expo-localization@17 enough for typical `getLocales()` usage.
 */
import { useEffect, useMemo, useReducer } from 'react';

function navigatorLanguageTags(): string[] {
  try {
    const tag = Intl.DateTimeFormat().resolvedOptions().locale;
    return tag ? [tag] : ['en-US'];
  } catch {
    return ['en-US'];
  }
}

export function getLocales() {
  return navigatorLanguageTags().map((languageTag) => {
    const languageCode = languageTag.split(/[-_]/)[0]?.toLowerCase() || 'en';
    return {
      languageTag,
      languageCode,
      languageScriptCode: null as string | null,
      textDirection: 'ltr' as const,
      digitGroupingSeparator: ',' as string | null,
      decimalSeparator: '.' as string | null,
      measurementSystem: null as 'metric' | 'us' | 'uk' | null,
      currencyCode: null as string | null,
      currencySymbol: null as string | null,
      languageCurrencyCode: null as string | null,
      languageCurrencySymbol: null as string | null,
      regionCode: null as string | null,
      languageRegionCode: null as string | null,
      temperatureUnit: null as 'celsius' | 'fahrenheit' | null,
    };
  });
}

export function getCalendars() {
  let timeZone = 'UTC';
  let uses24hourClock = false;
  try {
    const o = Intl.DateTimeFormat().resolvedOptions();
    timeZone = o.timeZone ?? 'UTC';
    uses24hourClock = o.hourCycle?.startsWith('h2') ?? false;
  } catch {
    /* keep defaults */
  }
  return [
    {
      calendar: 'gregory' as const,
      timeZone,
      uses24hourClock,
      firstWeekday: 1 as const,
    },
  ];
}

export function addLocaleListener(listener: () => void) {
  if (typeof addEventListener === 'function') {
    addEventListener('languagechange', listener);
    return { remove: () => removeEventListener('languagechange', listener) };
  }
  return { remove: () => {} };
}

export function addCalendarListener(listener: () => void) {
  return addLocaleListener(listener);
}

export function removeSubscription(subscription: { remove: () => void }) {
  subscription.remove();
}

export function useLocales() {
  const [key, invalidate] = useReducer((k: number) => k + 1, 0);
  const locales = useMemo(() => getLocales(), [key]);
  useEffect(() => {
    const subscription = addLocaleListener(invalidate);
    return () => {
      removeSubscription(subscription);
    };
  }, []);
  return locales;
}

export function useCalendars() {
  const [key, invalidate] = useReducer((k: number) => k + 1, 0);
  const calendars = useMemo(() => getCalendars(), [key]);
  useEffect(() => {
    const subscription = addCalendarListener(invalidate);
    return () => {
      removeSubscription(subscription);
    };
  }, []);
  return calendars;
}
