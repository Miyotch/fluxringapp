// scripts/build-apk-verify.mjs
// 検証用 APK（com.fluxring.tsubasa）をこの PC でビルドする。EAS には何も送らない。
// コミットしていない変更もそのまま入る。
//
//   npm run apk:verify
//
// 前提: Android SDK（ANDROID_HOME、無ければ %LOCALAPPDATA%\Android\Sdk）と JDK 17（下の findJdk17 を参照）。
// 出力: apk-builds/FluxRing-verify-<version>-<日時>.apk
// 実機向けに arm64-v8a だけをビルドする（4 ABI すべてより大幅に速い。エミュレータ用の x86_64 は入らない）。
// 署名は prebuild のテンプレートにあるデバッグ鍵。検証版どうしなら上書きインストールできる。
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

const sdkDir =
  process.env.ANDROID_HOME ||
  process.env.ANDROID_SDK_ROOT ||
  (isWindows && process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : '');
if (!sdkDir || !fs.existsSync(sdkDir)) {
  console.error(`Android SDK が見つかりません: ${sdkDir || '(ANDROID_HOME 未設定)'}`);
  process.exit(1);
}

// @react-native/gradle-plugin は jvmToolchain(17) を要求する。JDK 17 が無いと Gradle が
// foojay-resolver 0.5.0 で自動ダウンロードしようとし、Gradle 9 では
// "JvmVendorSpec does not have member field IBM_SEMERU" で落ちる（EAS のイメージには 17 があるので起きない）。
// JDK 17 を探して JAVA_HOME と Gradle のツールチェーン候補に渡し、自動ダウンロードは切る。
function findJdk17() {
  const candidates = process.env.JAVA17_HOME ? [process.env.JAVA17_HOME] : [];
  const parents = isWindows
    ? [
        process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Programs') : '',
        'C:\\Program Files\\Microsoft',
        'C:\\Program Files\\Eclipse Adoptium',
      ]
    : [];
  for (const parent of parents) {
    if (!parent || !fs.existsSync(parent)) continue;
    for (const name of fs.readdirSync(parent)) {
      if (name.startsWith('jdk-17')) candidates.push(path.join(parent, name));
    }
  }
  return candidates.find((dir) => fs.existsSync(path.join(dir, 'bin', isWindows ? 'java.exe' : 'java')));
}

const jdk17 = findJdk17();
if (!jdk17) {
  console.error('JDK 17 が見つかりません（JAVA17_HOME で場所を指定できます）');
  process.exit(1);
}

const env = {
  ...process.env,
  APP_VARIANT: 'verify',
  ANDROID_HOME: sdkDir,
  ANDROID_SDK_ROOT: sdkDir,
  JAVA_HOME: jdk17,
  // /android は .gitignore 済みなので、作業ツリーが汚れていても --clean で失うものは無い
  EXPO_NO_GIT_STATUS: '1',
};

function run(command, args, cwd) {
  console.log(`\n> ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: isWindows });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

run('npx', ['expo', 'prebuild', '--platform', 'android', '--clean', '--no-install'], root);

// NoDefaultCurrentDirectoryInExePath が立っている環境では、cmd がカレントの gradlew.bat を探さないので絶対パスで呼ぶ
const androidDir = path.join(root, 'android');
run(
  isWindows ? `"${path.join(androidDir, 'gradlew.bat')}"` : './gradlew',
  [
    'assembleRelease',
    '-PreactNativeArchitectures=arm64-v8a',
    `"-Porg.gradle.java.installations.paths=${jdk17}"`,
    '-Porg.gradle.java.installations.auto-download=false',
  ],
  androidDir,
);

const { version } = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8')).expo;
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;

const builtApk = path.join(root, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outDir = path.join(root, 'apk-builds');
const outApk = path.join(outDir, `FluxRing-verify-${version}-${stamp}.apk`);
fs.mkdirSync(outDir, { recursive: true });
fs.copyFileSync(builtApk, outApk);

console.log(`\nAPK: ${outApk}`);
