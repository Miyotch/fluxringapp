const fs = require('fs');
const vm = require('vm');
const ts = require('typescript');
const assert = require('assert/strict');

// Run the real provider with deterministic React hooks and a native-player double.
function harness() {
  const slots = [], effects = [], events = [], listeners = new Set(), pending = new Map();
  let cursor = 0, controller;
  const same = (a, b) => a && b && a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
  const React = {
    createContext: value => ({ Provider: 'Provider', value }),
    createElement: (type, props, ...children) => ({ type, props, children }),
    useState: initial => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { value: initial };
      return [slots[i].value, value => { slots[i].value = typeof value === 'function' ? value(slots[i].value) : value; }];
    },
    useRef: initial => {
      const i = cursor++;
      if (!slots[i]) slots[i] = { current: initial };
      return slots[i];
    },
    useMemo: (fn, deps) => {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect: (fn, deps) => {
      const i = cursor++;
      if (!slots[i] || !same(slots[i].deps, deps)) {
        effects.push(() => { slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() }; });
      }
    },
  };
  React.useCallback = (fn, deps) => React.useMemo(() => fn, deps);
  const player = {
    playing: false,
    replace: source => { events.push(['replace', source.uri]); player.currentTime = 0; },
    play: () => { player.playing = true; events.push(['play']); },
    pause: () => { player.playing = false; events.push(['pause']); },
    setActiveForLockScreen() {}, updateLockScreenMetadata() {}, clearLockScreenControls() {},
    addListener: (_, fn) => { listeners.add(fn); return { remove: () => listeners.delete(fn) }; },
    currentTime: 0,
  };
  const exports = {};
  const modules = {
    react: React,
    'expo-audio': { createAudioPlayer: () => player, useAudioPlayerStatus: () => ({ playing: player.playing, isLoaded: true, currentTime: player.currentTime, duration: 300 }) },
    './r2': { fullAudioUrl: key => pending.get(key)?.promise ?? Promise.resolve(`audio:${key}`), previewUrl: key => `preview:${key}` },
    './durations': { rememberDuration() {} },
    '../constants/mediaConfig': { R2_WORKER_URL: 'test' },
    './logPlayback': { logPlayback() {} },
    './downloads': { localAudioUri: () => null, isLocalEncrypted: () => false },
    './secureAudio': { playableUri() { throw Error('Unexpected encrypted audio'); } },
  };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/playback.tsx', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText, { exports, require: name => { if (!(name in modules)) throw Error(name); return modules[name]; } });
  function render() {
    cursor = 0;
    controller = exports.PlaybackProvider({ children: null }).props.value;
    effects.splice(0).forEach(fn => fn());
    return controller;
  }
  render();
  return {
    get pb() { return controller; }, player, events, render,
    async settle() { await new Promise(resolve => setImmediate(resolve)); render(); },
    finish() { [...listeners].forEach(fn => fn({ didJustFinish: true })); },
    defer(key) { let resolve; const promise = new Promise(r => { resolve = r; }); pending.set(key, { promise }); return () => { resolve(`audio:${key}`); pending.delete(key); }; },
  };
}
const track = id => ({ id, audioKey: id, title: id, artworkUrl: '' });
const [a, b, c] = ['a', 'b', 'c'].map(track);
const ids = pb => Array.from(pb.queue, t => t.id);
// Exercise App's actual playlist-to-player wiring as well as the controller.
const appFile = ts.createSourceFile('App.tsx', fs.readFileSync('App.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let syncEffect;
function findSyncEffect(node) {
  if (ts.isCallExpression(node) && node.expression.getText(appFile) === 'useEffect' && node.arguments[0]?.getText(appFile).includes('syncQueue(tracks, list.id)')) syncEffect = node;
  ts.forEachChild(node, findSyncEffect);
}
findSyncEffect(appFile);
assert.ok(syncEffect, 'App must connect saved playlist changes to playback');
function syncFromApp(h, lists, ready = true) {
  vm.runInNewContext(ts.transpileModule(syncEffect.getText(appFile), { compilerOptions: { target: ts.ScriptTarget.ES2020 } }).outputText, {
    useEffect: fn => fn(), playlists: { ready, lists }, playbackSource: h.pb.source,
    playback: h.pb, syncQueue: h.pb.syncQueue, playerTracks: [a, b, c],
  });
  h.render();
}

(async () => {
  const h = harness();
  h.pb.playQueue([a, b, c], 'a', 'playlist'); await h.settle();
  h.player.currentTime = 67;
  const before = h.events.length;
  syncFromApp(h, [{ id: 'other', trackIds: ['b'] }, { id: 'playlist', trackIds: ['a', 'c', 'b'] }], false);
  assert.deepEqual(ids(h.pb), ['a', 'b', 'c'], 'Do not sync storage before it is ready');
  syncFromApp(h, [{ id: 'other', trackIds: ['b'] }, { id: 'playlist', trackIds: ['a', 'c', 'b'] }]);
  assert.deepEqual(ids(h.pb), ['a', 'c', 'b']);
  assert.equal(h.pb.current.id, 'a');
  assert.equal(h.player.currentTime, 67);
  assert.equal(h.events.length, before, 'Reordering must not reload, pause or restart audio');
  h.pb.next(); await h.settle(); assert.equal(h.pb.current.id, 'c');
  h.pb.prev(); await h.settle(); assert.equal(h.pb.current.id, 'a');
  h.pb.prev(); await h.settle(); assert.equal(h.pb.current.id, 'b');
  h.finish(); await h.settle(); assert.equal(h.pb.current.id, 'a', 'Last track loops to the new first track');
  h.finish(); await h.settle(); assert.equal(h.pb.current.id, 'c', 'Automatic next follows edited order');

  h.pb.pause(); h.render(); h.player.currentTime = 88;
  const pausedEvents = h.events.length;
  h.pb.syncQueue([c, b, a], 'playlist'); h.render();
  assert.equal(h.pb.index, 0); assert.equal(h.pb.current.id, 'c');
  assert.equal(h.player.currentTime, 88); assert.equal(h.player.playing, false);
  assert.equal(h.events.length, pausedEvents);
  h.pb.syncQueue([a], 'other-playlist'); h.render();
  assert.deepEqual(ids(h.pb), ['c', 'b', 'a'], 'Editing another playlist cannot change playback');
  h.pb.syncQueue([c, b, a], 'playlist'); h.render();
  assert.equal(h.events.length, pausedEvents, 'Syncing unchanged order is a no-op');

  const loading = harness(), release = loading.defer('a');
  loading.pb.playQueue([a, b, c], 'a', 'playlist'); loading.render();
  loading.pb.syncQueue([c, a, b], 'playlist'); loading.render();
  assert.equal(loading.pb.index, 1);
  release(); await loading.settle();
  assert.equal(loading.pb.current.id, 'a');
  assert.equal(loading.events.filter(e => e[0] === 'replace').length, 1);
  loading.finish(); await loading.settle(); assert.equal(loading.pb.current.id, 'b');

  const removal = harness();
  removal.pb.playQueue([a, b, c], 'a', 'playlist'); await removal.settle();
  removal.pb.syncQueue([a, c], 'playlist'); removal.render();
  removal.finish(); await removal.settle(); assert.equal(removal.pb.current.id, 'c', 'Removed upcoming track is skipped');
  removal.pb.syncQueue([a], 'playlist'); await removal.settle();
  assert.equal(removal.pb.current.id, 'a'); assert.equal(removal.player.playing, true);
  removal.pb.pause(); removal.render();
  removal.pb.syncQueue([b], 'playlist'); await removal.settle();
  assert.equal(removal.pb.current.id, 'b'); assert.equal(removal.player.playing, false);
  removal.pb.syncQueue([], 'playlist'); removal.render();
  assert.equal(removal.pb.current, null); assert.equal(removal.pb.source, null);
  assert.equal(removal.player.playing, false);
  console.log('PASS: queue edits preserve current audio/position/pause, update next/previous/automatic looping, isolate sources, and handle loading/removal/empty lists');
})().catch(error => { console.error(error); process.exitCode = 1; });
