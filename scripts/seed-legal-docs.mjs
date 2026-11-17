#!/usr/bin/env node
/**
 * seed-legal-docs.mjs — CREDITS / 利用規約 / プライバシーポリシー / 特商法の文面を
 * Firestore の legal_docs へ初期投入する（中身はアプリ同梱の constants/legalDocs.json）
 *
 *   node scripts/seed-legal-docs.mjs <サービスアカウント.json>            … 何をするかだけ表示（既定）
 *   node scripts/seed-legal-docs.mjs <サービスアカウント.json> --write    … まだ無いドキュメントだけ作る
 *   node scripts/seed-legal-docs.mjs <サービスアカウント.json> --write --force
 *        … 既にあるドキュメントの ja も同梱の文面で上書きする（管理画面で直した内容は消える）
 *
 * 作るドキュメント: legal_docs/{credits, terms, privacy, tokushoho}
 *   { ja: {...}, published: true, version: 1, updatedAt: <サーバー時刻> }
 * --force で上書きするのは ja と updatedAt だけ（en・published・version などはそのまま）。
 *
 * サービスアカウントで書くのでセキュリティルールの外。鍵の読み込みとトークン取得は
 * audio-gateway と同じもの（infra/audio-gateway/src/google.js）を使う。
 */

import { readFileSync } from 'node:fs';
import { serviceAccountToken } from '../infra/audio-gateway/src/google.js';

const [saPath, ...flags] = process.argv.slice(2);
if (!saPath) {
  console.error('usage: node scripts/seed-legal-docs.mjs <service-account.json> [--write] [--force]');
  process.exit(1);
}
const write = flags.includes('--write');
const force = flags.includes('--force');

const docs = JSON.parse(readFileSync(new URL('../constants/legalDocs.json', import.meta.url), 'utf8'));
const sa = JSON.parse(readFileSync(saPath, 'utf8'));
const root = `projects/${sa.project_id}/databases/(default)/documents`;
const base = `https://firestore.googleapis.com/v1/${root}`;
const token = await serviceAccountToken(sa, 'https://www.googleapis.com/auth/datastore');
const headers = { Authorization: `Bearer ${token}` };

// JS の値 → Firestore REST の Value（入れ子の配列・オブジェクトも扱う）
function toValue(v) {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(toValue) } };
  if (typeof v === 'object') return { mapValue: { fields: toFields(v) } };
  throw new Error(`unsupported value ${typeof v}`);
}
function toFields(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v !== undefined) out[k] = toValue(v);
  return out;
}

async function exists(id) {
  const res = await fetch(`${base}/legal_docs/${id}?mask.fieldPaths=version`, { headers });
  if (res.status === 404) return false;
  if (!res.ok) throw new Error(`get legal_docs/${id} ${res.status}`);
  return true;
}

const writes = [];
for (const [id, content] of Object.entries(docs)) {
  const name = `${root}/legal_docs/${id}`;
  const has = await exists(id);
  const transforms = [{ fieldPath: 'updatedAt', setToServerValue: 'REQUEST_TIME' }];
  if (!has) {
    console.log(`  legal_docs/${id.padEnd(10)} 新規作成`);
    writes.push({
      update: { name, fields: toFields({ ja: content, published: true, version: 1 }) },
      updateTransforms: transforms,
      currentDocument: { exists: false },
    });
  } else if (force) {
    console.log(`  legal_docs/${id.padEnd(10)} 既にある → ja を上書き（--force）`);
    writes.push({
      update: { name, fields: toFields({ ja: content }) },
      updateMask: { fieldPaths: ['ja'] },
      updateTransforms: transforms,
    });
  } else {
    console.log(`  legal_docs/${id.padEnd(10)} 既にある → そのまま（上書きするなら --force）`);
  }
}

if (!write) {
  console.log('\n--write を付けると書き込みます（今は表示だけ）。');
  process.exit(0);
}
if (writes.length === 0) {
  console.log('\n書き込むものはありません。');
  process.exit(0);
}
const res = await fetch(`${base}:commit`, {
  method: 'POST',
  headers: { ...headers, 'Content-Type': 'application/json' },
  body: JSON.stringify({ writes }),
});
if (!res.ok) throw new Error(`commit ${res.status} ${await res.text().catch(() => '')}`);
console.log(`\n書き込み済み: ${writes.length} 件`);
