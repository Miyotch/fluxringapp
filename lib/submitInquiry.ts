/**
 * submitInquiry.ts — 設定→サポートの「お問い合わせ」フォームを Firestore へ記録する
 * ------------------------------------------------------------------
 * 送信内容は inquiries コレクションへ1件追記する（運営が管理・返信する想定。
 * アプリ側からの一覧表示・返信機能は持たない）。
 * email は入力させず、ログイン中ユーザーのアカウントのメールアドレスを
 * そのまま使う（「送信元ユーザーのメールアドレス」を正しく残すため。
 * 自由入力にすると別人のメールアドレスを騙って送れてしまう）。
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

/** 問い合わせの種類。プルダウンの選択肢とそのまま対応する */
export type InquiryType = 'bug' | 'billing' | 'other';

export async function submitInquiry(params: {
  type: InquiryType;
  message: string;
}): Promise<void> {
  await addDoc(collection(db, 'inquiries'), {
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
    type: params.type,
    message: params.message.trim(),
    status: 'new',
    createdAt: serverTimestamp(),
  });
}
