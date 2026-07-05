// index.js — アプリのエントリポイント。
// Expo SDK 50 以降は AppEntry.js ではなく registerRootComponent でルートを登録する。
// react-native-gesture-handler は最上部で読み込む（副作用の初期化のため）。
import 'react-native-gesture-handler';
import { registerRootComponent } from 'expo';

import App from './App';

registerRootComponent(App);
