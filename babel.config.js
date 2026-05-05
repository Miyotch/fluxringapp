module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'react' }],
    ],
    plugins: [
      // react-native-reanimated v4 ships its worklets plugin under react-native-worklets.
      // This must remain LAST in the plugins list.
      'react-native-worklets/plugin',
    ],
  };
};
