/**
 * Dynamic Expo config. `extra.apiUrl` is resolved in Node when Expo CLI / Metro starts
 * (from shell + `.env*`), then read in JS via `expo-constants`. That avoids relying on
 * `process.env.EXPO_PUBLIC_*` inside the Hermes bundle in development.
 */
module.exports = ({ config }) => {
  const raw =
    typeof process.env.EXPO_PUBLIC_API_URL === 'string' ? process.env.EXPO_PUBLIC_API_URL.trim() : '';
  const apiUrl = raw.length > 0 ? raw : 'http://localhost:8000/api/v1';

  const plugins = Array.isArray(config.plugins) ? [...config.plugins] : [];
  const hasLocalization = plugins.some(
    (p) => p === 'expo-localization' || (Array.isArray(p) && p[0] === 'expo-localization'),
  );
  if (!hasLocalization) {
    plugins.push('expo-localization');
  }

  return {
    ...config,
    plugins,
    extra: {
      ...(config.extra && typeof config.extra === 'object' ? config.extra : {}),
      apiUrl,
    },
  };
};
