/**
 * submitInquiry.ts — 設定→サポートの「お問い合わせ」フォームを Firestore へ記録する
 * ------------------------------------------------------------------
 * 送信内容は inquiries コレクションへ1件追記する（運営が管理・返信する想定。
 * アプリ側からの一覧表示・返信機能は持たない）。
 * email は入力させず、ログイン中ユーザーのアカウントのメールアドレスを
 * そのまま使う（「送信元ユーザーのメールアドレス」を正しく残すため。
 * 自由入力にすると別人のメールアドレスを騙って送れてしまう）。
 *
 * Firestore への記録に加えて、infra/inquiry-notify-worker.js（Resend 経由の
 * 管理者メール通知）へベストエフォートで通知する。notifyWorkerUrl が
 * 未設定（Worker 未デプロイ）のあいだは通知をスキップし、Firestore への
 * 記録だけが行われる。通知に失敗しても submitInquiry 自体は失敗させない
 * （お問い合わせが Firestore に残ってさえいれば運営は拾える。メール通知は
 * 「早く気づくための」保険なので、これの失敗でユーザーへ送信エラーを
 * 見せる必要はない）。
 */

import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { INQUIRY_NOTIFY_URL, isInquiryNotifyConfigured } from '../constants/inquiryConfig';

/** 問い合わせの種類。プルダウンの選択肢とそのまま対応する */
export type InquiryType = 'bug' | 'billing' | 'other';

async function notifyAdmin(params: { type: InquiryType; message: string }): Promise<void> {
  if (!isInquiryNotifyConfigured) return;
  const user = auth.currentUser;
  if (!user) return; // 未ログインでは呼ばれない想定だが念のため
  try {
    const idToken = await user.getIdToken();
    await fetch(INQUIRY_NOTIFY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ type: params.type, message: params.message }),
    });
  } catch {
    // ベストエフォート。ここで失敗してもお問い合わせ自体は Firestore に残っている
  }
}

export async function submitInquiry(params: {
  type: InquiryType;
  message: string;
}): Promise<void> {
  const message = params.message.trim();
  await addDoc(collection(db, 'inquiries'), {
    uid: auth.currentUser?.uid ?? null,
    email: auth.currentUser?.email ?? null,
    type: params.type,
    message,
    status: 'new',
    createdAt: serverTimestamp(),
  });
  await notifyAdmin({ type: params.type, message });
}
