const fs = require('fs');
const path = require('path');
function patch(root = path.resolve(__dirname, '..')) {
 const audio = path.join(root, 'node_modules/expo-audio/android/src/main/java/expo/modules/audio');
 const replace = (file, anchor, value) => {
   const p = path.join(audio, file); let s = fs.readFileSync(p, 'utf8');
   if (s.includes(value)) return;
   if (!s.includes(anchor)) throw Error(`Unsupported expo-audio source: ${file}`);
   fs.writeFileSync(p, s.replace(anchor, value));
 };
 fs.copyFileSync(path.join(__dirname, '../native/android/FluxSleepTimer.kt'), path.join(audio, 'FluxSleepTimer.kt'));
 replace('AudioPlayer.kt', '  var preservesPitch = true', '  internal val fluxSleepTimer = FluxSleepTimer(context, this)\n  var preservesPitch = true');
 replace('AudioPlayer.kt', '  override fun releasePlayer() {', '  override fun releasePlayer() {\n    fluxSleepTimer.cancel()');
 replace('AudioModule.kt', '      Function("play") { player: AudioPlayer ->', `      Function("setFluxSleepTimer") { player: AudioPlayer, durationMs: Double ->
        runOnMain { player.fluxSleepTimer.set(durationMs) }
      }
      Property("fluxSleepRemaining") { player: AudioPlayer ->
        runOnMain { player.fluxSleepTimer.remaining }
      }
      Function("play") { player: AudioPlayer ->`);
 const manifest = path.join(audio, '../../../AndroidManifest.xml');
 // Walk from the Java package to the library manifest via a fixed root.
 const mp = path.join(root, 'node_modules/expo-audio/android/src/main/AndroidManifest.xml');
 let xml = fs.readFileSync(mp, 'utf8');
 if (!xml.includes('android.permission.WAKE_LOCK')) { xml = xml.replace('</manifest>', '  <uses-permission android:name="android.permission.WAKE_LOCK" />\n</manifest>'); fs.writeFileSync(mp, xml); }
}
module.exports = patch;
if (require.main === module) patch(process.argv[2]);
