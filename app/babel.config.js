module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // react-native-reanimated/plugin is injected by babel-preset-expo when reanimated is installed.
    // Do not add it here again — duplicate plugin breaks Metro / runtime.
  };
};
