// metro.config.js
// Skia / reanimated 4 / worklets は追加の Metro 設定を不要だが、
// firebase JS SDK（v9+）を Expo で使うため次の2点を追加する:
//   1. sourceExts に 'cjs' を追加（firebase が .cjs を配信するため）
//   2. unstable_enablePackageExports = false
//      → firebase の package.json "exports" 条件解決で React Native 用ビルドが
//        正しく選ばれず "Component auth has not been registered yet" や
//        getReactNativePersistence undefined を招くため、旧来の main/react-native
//        フィールド解決に固定する（Expo + firebase の定番対処）。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts.push('cjs');
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
