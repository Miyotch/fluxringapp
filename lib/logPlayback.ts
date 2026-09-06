/**
 * logPlayback.ts — 再生履歴（本編）を Firestore へ記録する
 * ------------------------------------------------------------------
 * ユーザーには見せない、記録専用のログ（画面もUIも持たない）。
 * 再生画面（PlayerScreen）を離れる（曲送り／戻る／画面を閉じる）たびに、
 * そのセッションで実際に聴いた秒数を1件のドキュメントとして
 * playback_history コレクションに追記する。
 *
 * 「再生回数」は個別のフィールドとして持たない。trackId（必要なら uid も）で
 * 絞り込んだドキュメント数がそのまま再生回数になる設計にしたほうが、
 * 集計用カウンタを別途インクリメントで維持するより単純で壊れにくいため。
 *
 * 書き込みに失敗しても（オフライン・Firestoreルール未整備等）再生自体は
 * 妨げない。
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export function logPlayback(params: { trackId: string; title: string; durationSec: number }): void {
  const uid = auth.currentUser?.uid;
  if (!uid) return;

  const durationSec = Math.round(params.durationSec);
  if (durationSec < 1) return; // 開いてすぐ離れた等、実質再生していないものは記録しない

  addDoc(collection(db, 'playback_history'), {
    uid,
    trackId: params.trackId,
    title: params.title,
    durationSec,
    playedAt: serverTimestamp(),
  }).catch(() => {
    // 記録に失敗しても再生体験には影響させない
  });
}
