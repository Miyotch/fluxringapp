// index.js — アプリのエントリポイント。
// Expo SDK 50 以降は AppEntry.js ではなく registerRootComponent でルートを登録する。
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
