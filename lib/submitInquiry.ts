/**
 * submitInquiry.ts — 設定→サポートの「お問い合わせ」フォームを Firestore へ記録する
 * ------------------------------------------------------------------
 * 送信内容は inquiries コレクションへ1件追記する（運営が管理・返信する想定。
 * アプリ側からの一覧表示・返信機能は持たない）。
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export async function submitInquiry(params: {
  name: string;
  email: string;
  message: string;
}): Promise<void> {
  await addDoc(collection(db, 'inquiries'), {
    uid: auth.currentUser?.uid ?? null,
    name: params.name.trim(),
    email: params.email.trim(),
    message: params.message.trim(),
    status: 'new',
    createdAt: serverTimestamp(),
  });
}
