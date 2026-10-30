const fs = require('fs'), vm = require('vm'), ts = require('typescript'), assert = require('assert/strict');
function load(file, requireModule) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
    esModuleInterop: true,
  }}).outputText, { exports, require: requireModule });
  return exports;
}
const { movePlaylistTrack } = load('lib/playlistOrder.ts');
const initial = ['a', 'unavailable', 'b', 'c'];
assert.equal(JSON.stringify(movePlaylistTrack(initial, 'a', 'c')), '["unavailable","b","c","a"]');
assert.equal(JSON.stringify(movePlaylistTrack(initial, 'c', 'a')), '["c","a","unavailable","b"]');
assert.equal(JSON.stringify(movePlaylistTrack(initial, 'missing', 'a')), JSON.stringify(initial));
assert.equal(JSON.stringify(initial), '["a","unavailable","b","c"]');
// Exercise the actual gesture handlers without a device or native gesture driver.
const gestures = [];
const settlements = [];
const animatedStyles = [];
function gesture() {
  const g = { handlers: {} };
  for (const method of ['activateAfterLongPress', 'maxDuration', 'onStart', 'onUpdate', 'onEnd', 'onFinalize']) {
    g[method] = value => { g.handlers[method] = value; return g; };
  }
  gestures.push(g); return g;
}
const React = { useRef: current => ({ current }), useCallback: f => f, useMemo: f => f(),
  createElement: (type, props, ...children) => ({ type, props, children }) };
const { PlaylistTrackRow } = load('components/PlaylistTrackRow.tsx', name => {
  if (name === 'react') return React;
  if (name === 'react-native-gesture-handler') return { Gesture: { Pan: gesture, Tap: gesture, Exclusive: (...g) => g }, GestureDetector: 'GestureDetector' };
  if (name === 'react-native-reanimated') return { default: { View: 'AnimatedView' }, __esModule: true,
    runOnJS: f => f, useAnimatedStyle: f => { animatedStyles.push(f); return f(); }, withTiming: (v, config, done) => { if (done) settlements.push(done); return v; } };
  throw Error(name);
});
const dragIndex = { value: -1 }, dragDy = { value: 0 }, events = [];
const rowOrder = { value: ['a', 'b', 'c', 'd'] };
const tree = PlaylistTrackRow({ trackId: 'b', rowOrder, index: 1, count: 4, height: 82, dragIndex, dragDy,
  onLift: () => events.push('lift'), onDrop: (a,b) => events.push([a,b]), onCancel: () => events.push('cancel'),
  onPlay: () => events.push('play'), onMenu: () => events.push('menu'), label: 'Track', up: 'Up', down: 'Down' });
tree.children[0].props.onLayout({ nativeEvent: { layout: { width: 390 } } });
const pan = gestures[0].handlers, tap = gestures[1].handlers;
tap.onEnd({ x: 90 }, true); tap.onEnd({ x: 370 }, true);
assert.deepEqual(events.splice(0), ['play', 'menu']);
pan.onStart(); pan.onUpdate({ translationY: 170 }); pan.onEnd();
assert.equal(dragDy.value, 164); assert.deepEqual(events.splice(0), ['lift']);
const settledY = animatedStyles[0]().transform[0].translateY;
settlements.shift()(true); assert.deepEqual(events.splice(0), [[1,3]]);
assert.equal(animatedStyles[0]().transform[0].translateY, settledY, 'Commit must not move the settled row even before React updates index');
assert.equal(rowOrder.value.join(','), 'a,c,d,b');
pan.onStart(); pan.onUpdate({ translationY: -400 }); pan.onEnd(); settlements.shift()(true);
assert.deepEqual(events.splice(0), ['lift', [3,0]]);
assert.equal(animatedStyles[0]().transform[0].translateY, 0);
rowOrder.value = ['a', 'b', 'c', 'd']; pan.onStart(); events.splice(0);
pan.onFinalize({}, false); assert.deepEqual(events.splice(0), ['cancel']);
tap.onEnd({ x: 50 }, false); assert.deepEqual(events, []);
// Every neighbour must keep the same absolute destination across the handoff,
// both up/down and over multiple rows, while React still has the old indices.
for (const [from, to] of [[0,3], [3,0], [1,2], [2,1], [1,1]]) {
  rowOrder.value = ['a','b','c','d']; dragIndex.value = from; dragDy.value = (to-from)*82;
  const start = animatedStyles.length;
  rowOrder.value.forEach((trackId, index) => PlaylistTrackRow({ trackId, rowOrder, index, count: 4, height: 82,
    dragIndex, dragDy, onLift() {}, onDrop() {}, onCancel() {}, onPlay() {}, onMenu() {}, label: trackId, up: 'Up', down: 'Down' }));
  const styles = animatedStyles.slice(start);
  const before = styles.map(f => f().transform[0].translateY);
  const next = [...rowOrder.value], [moved] = next.splice(from,1); next.splice(to,0,moved);
  rowOrder.value = next; dragIndex.value = -1; dragDy.value = 0;
  assert.deepEqual(styles.map(f => f().transform[0].translateY), before, 'No row jumps on commit');
}
console.log('PASS: playlist moves retain unavailable tracks; taps, menu, long-hold drag bounds and cancellation');
