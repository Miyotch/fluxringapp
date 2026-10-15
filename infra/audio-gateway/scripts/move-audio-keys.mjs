#!/usr/bin/env node
/**
 * move-audio-keys.mjs — フル音源の場所を、誰でも読める tracks/{id} から
 * アプリが読めない tracks/{id}/private/audio へ移す
 *
 *   node scripts/move-audio-keys.mjs <サービスアカウント.json>            … 何をするかだけ表示（既定）
 *   node scripts/move-audio-keys.mjs <サービスアカウント.json> --write    … private/audio を書く
 *   node scripts/move-audio-keys.mjs <サービスアカウント.json> --write --strip
 *        … さらに公開ドキュメントから r2_url を消す（新しいアプリが行き渡ってから）
 *
 * --strip は、audio-gateway を使うアプリ（app.json の extra.r2.workerUrl 設定済み）が
 * 全員に行き渡ってから。古いアプリは r2_url を直接読んで鳴らしているので、先に消すと鳴らなくなる。
 * 管理画面が新しい曲を登録するときも private/audio に書くよう直すこと（直すまでは
 * gateway が r2_url を読むので鳴る）。
 */

import { readFileSync } from 'node:fs';
import { firestore, serviceAccountToken, toFields } from '../src/google.js';
import { objectKeyFromUrl } from '../src/index.js';

const [saPath, ...flags] = process.argv.slice(2);
if (!saPath) {
  console.error('usage: node scripts/move-audio-keys.mjs <service-account.json> [--write] [--strip]');
  process.exit(1);
}
const write = flags.includes('--write');
const strip = flags.includes('--strip');
const sa = JSON.parse(readFileSync(saPath, 'utf8'));
const env = { GCP_SERVICE_ACCOUNT: sa, FIREBASE_PROJECT_ID: sa.project_id };
const fs = firestore(env);
const base = `https://firestore.googleapis.com/v1/${fs.root}`;
const token = await serviceAccountToken(sa, 'https://www.googleapis.com/auth/datastore');

let pageToken = '';
const rows = [];
do {
  const res = await fetch(`${base}/tracks?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`list ${res.status}`);
  const body = await res.json();
  for (const d of body.documents || []) {
    const id = d.name.split('/').pop();
    const url = d.fields?.r2_url?.stringValue;
    rows.push({ id, name: d.name, objectKey: objectKeyFromUrl(url) });
  }
  pageToken = body.nextPageToken || '';
} while (pageToken);

const movable = rows.filter((r) => r.objectKey);
console.log(`tracks: ${rows.length} 件 / r2_url あり: ${movable.length} 件`);
for (const r of rows) console.log(`  ${r.id.padEnd(28)} ${r.objectKey ?? '(r2_url なし)'}`);
if (!write) {
  console.log('\n--write を付けると private/audio を書きます（今は表示だけ）。');
  process.exit(0);
}

const writes = [];
for (const r of movable) {
  writes.push({ update: { name: `${r.name}/private/audio`, fields: toFields({ objectKey: r.objectKey }) } });
  if (strip) writes.push({ update: { name: r.name, fields: {} }, updateMask: { fieldPaths: ['r2_url'] } });
}
// commit は1回 500 件まで
for (let i = 0; i < writes.length; i += 400) await fs.commit(writes.slice(i, i + 400));
console.log(`書き込み済み: private/audio ${movable.length} 件${strip ? '・公開ドキュメントの r2_url を削除' : ''}`);
