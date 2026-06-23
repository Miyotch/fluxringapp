module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // reanimated 4.x は worklets プラグイン。必ず plugins の最後に置く。
    // reanimated 3.x を使う場合は 'react-native-reanimated/plugin' に変える。
    plugins: ['react-native-worklets/plugin'],
  };
};
