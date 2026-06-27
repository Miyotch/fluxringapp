// metro.config.js — Expo 既定のまま（README の構成に合わせて明示）。
// Skia / reanimated 4 / worklets は追加の Metro 設定を必要としない。
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

module.exports = config;
