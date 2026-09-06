/**
 * useUserProfileSync.ts — Firebase Authentication と Firestore users/{uid} の同期
 * ------------------------------------------------------------------
 * これまで新規登録・ログイン（メール/Google/Apple のどれも）が
 * Firestore の users/{uid} ドキュメントを一切作らず、Authentication と
 * users コレクションが連動していなかった。サインイン確定のたび
 * （新規登録・ログイン・セッション復元のいずれも onUserChanged 経由で
 * 拾える）に、Auth側のプロフィールを users/{uid} へ書き込む。
 *
 * ・既存ドキュメントがある場合は email/displayName/photoURL/providers/
 *   updatedAt だけを上書きする。user_type・admin・created_time は
 *   触らない（運営が個別に付与した権限や本来の作成日時を壊さないため）。
 * ・ドキュメントが無い場合だけ user_type:'free' / admin:false /
 *   created_time を新規作成として付与する。
 * ・サインアウトでは何もしない（ドキュメントは残す＝退会とサインアウトを
 *   区別する。退会時の削除は lib/firebaseAuth.ts の deleteAccount 側の関心）。
 * ・書き込みに失敗しても（Firestore ルール未整備・オフライン等）アプリの
 *   利用は妨げない。次回のサインインで再試行される。
 */

import { useEffect } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db } from './firebase';
import { onUserChanged } from './firebaseAuth';

export function useUserProfileSync(): void {
  useEffect(() => {
    return onUserChanged((user: User | null) => {
      if (!user) return;
      syncUserProfile(user).catch(() => {
        // 失敗しても静かに無視する（次回サインインで再試行される）
      });
    });
  }, []);
}

async function syncUserProfile(user: User): Promise<void> {
  const ref = doc(db, 'users', user.uid);
  const providers = user.providerData.map((p) => p.providerId).filter(Boolean);
  const base = {
    email: user.email ?? '',
    displayName: user.displayName ?? '',
    photoURL: user.photoURL ?? '',
    providers,
    updatedAt: serverTimestamp(),
  };

  const snap = await getDoc(ref);
  if (snap.exists()) {
    await setDoc(ref, base, { merge: true });
  } else {
    await setDoc(ref, {
      ...base,
      user_type: 'free',
      admin: false,
      created_time: serverTimestamp(),
    });
  }
}
