// app.config.js
// 検証用のローカルビルドだけ、Android のパッケージ名を com.fluxring.tsubasa に切り替える。
//   APP_VARIANT=verify のとき … パッケージ名 com.fluxring.tsubasa・表示名「FluxRing 検証」
//   それ以外（EAS Build を含む）… app.json のまま（com.fluxring.app）
// パッケージ名が違うので、EAS で作った版と並べて端末に入れられる。
// ビルドは scripts/build-apk-verify.mjs（npm run apk:verify）から行う。
//
// google-services.json には com.fluxring.tsubasa のクライアントが無く、そのままだと
// Gradle の google-services プラグインが "No matching client found" で止まる。
// Firebase プロジェクト（sound-curtain-5unwwh）へアプリを登録する代わりに、
// com.fluxring.app の項目を複製してパッケージ名だけ差し替えた
// google-services.verify.json をここで毎回作る（.gitignore 済み）。
//   ・ネイティブの Firebase は Remote Config（よくある質問のリンク先）だけで、
//     取得に失敗しても既定値で動く（lib/remoteConfig.ts）
//   ・ストアの課金（expo-iap / 外部決済）は Play Console の com.fluxring.app に
//     紐づくため、検証版では試せない
require('./scripts/patch-android-sleep-timer.cjs')();
const fs = require('fs');
const path = require('path');
const { withSettingsGradle } = require('expo/config-plugins');

const VERIFY_PACKAGE = 'com.fluxring.tsubasa';
const VERIFY_GOOGLE_SERVICES = './google-services.verify.json';

// Windows では各モジュールの C++ 作業フォルダ（node_modules/<pkg>/android/.cxx）配下のパスが
// 260 文字を超え、SDK 同梱の ninja 1.10.2 がそのファイルを「無い」と判定して
// "manifest 'build.ninja' still dirty after 100 tries" で止まる（LongPathsEnabled=0 の PC。
// 例: Skia の ...\.cxx\RelWithDebInfo\<hash>\arm64-v8a\..\prefab\...\ReactAndroidConfigVersion.cmake が 270 文字）。
// subst で短いドライブに見せても、autolinking がライブラリの場所を実パスに戻すので効かない。
// 検証ビルドだけ、作業フォルダを %LOCALAPPDATA%\fluxring-cxx\<モジュール名> へ移す。
// ルートの build.gradle に書くと、読まれる前に :app と各ライブラリの評価が終わっていて
// "It is too late to set buildStagingDirectory" になるため、settings.gradle の gradle.beforeProject で
// 各プロジェクトが AGP を適用した直後に設定する。
const withShortCxxStagingOnWindows = (config) =>
  withSettingsGradle(config, (mod) => {
    if (process.platform !== 'win32' || mod.modResults.contents.includes('fluxring-cxx')) {
      return mod;
    }
    mod.modResults.contents += `
// 検証ビルド（Windows）: C++ の作業フォルダを短いパスへ移す（app.config.js 参照）
gradle.beforeProject { p ->
  ['com.android.application', 'com.android.library'].each { pluginId ->
    p.plugins.withId(pluginId) {
      p.android.externalNativeBuild.cmake.buildStagingDirectory =
        new File(System.getenv('LOCALAPPDATA'), "fluxring-cxx/\${p.name}")
    }
  }
}
`;
    return mod;
  });

module.exports = ({ config }) => {
  if (process.env.APP_VARIANT !== 'verify') {
    return config;
  }

  const googleServices = JSON.parse(
    fs.readFileSync(path.join(__dirname, config.android.googleServicesFile), 'utf8'),
  );
  const baseClient = googleServices.client.find(
    (c) => c.client_info.android_client_info.package_name === config.android.package,
  );
  if (!baseClient) {
    throw new Error(`google-services.json に ${config.android.package} のクライアントがありません`);
  }
  const verifyClient = JSON.parse(JSON.stringify(baseClient));
  verifyClient.client_info.android_client_info.package_name = VERIFY_PACKAGE;
  googleServices.client = [
    ...googleServices.client.filter(
      (c) => c.client_info.android_client_info.package_name !== VERIFY_PACKAGE,
    ),
    verifyClient,
  ];
  fs.writeFileSync(
    path.join(__dirname, VERIFY_GOOGLE_SERVICES),
    JSON.stringify(googleServices, null, 2) + '\n',
  );

  return withShortCxxStagingOnWindows({
    ...config,
    name: 'FluxRing 検証',
    android: {
      ...config.android,
      package: VERIFY_PACKAGE,
      googleServicesFile: VERIFY_GOOGLE_SERVICES,
      versionCode: verifyVersionCode(),
    },
  });
};

// 検証版の versionCode。prebuild --clean のたびに android/ が作り直され、app.json に
// versionCode が無い（EAS の remote 管理）ので 1 に戻ってしまう。端末に入っている前の
// 検証版より小さいと「アプリはインストールされていません」で上書きを拒まれる（2026-10-18）。
// 2020-01-01 からの経過分数にして、作るたびに必ず大きくする（2026 年で約 360 万。上限は 21 億）。
function verifyVersionCode() {
  return Math.floor((Date.now() - Date.UTC(2020, 0, 1)) / 60000);
}
