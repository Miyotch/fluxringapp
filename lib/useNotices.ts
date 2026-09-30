/**
 * useNotices.ts — メディア「あなた宛」のお知らせ（Firestore の notifications）
 * ------------------------------------------------------------------
 * 管理画面「お知らせ」で作ったものを読む。以前は screens 内に書いた見本（STUB_NOTICES）を
 * 出していて、管理画面とつながっておらず、押しても本文が開かなかった（2026-09-30）。
 *
 * 出すもの（管理画面のフィールド: title / body / target / to / date / visible）:
 *   ・visible が false のものは出さない
 *   ・date（配信日時）が今より先のものは、その時刻まで出さない（date が無いものは出す）
 *   ・target が 'user' のものは、to（ログインメール）にこの人のメールが含まれるときだけ出す
 *   ・新しい順
 *
 * 既読はこの端末（AsyncStorage）にだけ持つ。ユーザーごとに Firestore へ書くには
 * セキュリティルールの追加が要るため。初めて開いたときは、その時点で届いている分を
 * すべて既読にする（過去の分が全部「未読」で光らないように）。
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onSnapshot } from 'firebase/firestore';
import type { Notice } from '../screens/NotificationsScreen';
import { notificationsCol } from './firebaseFirestore';
import { useAuthUser } from './useAuthUser';

type Raw = {
  id: string;
  title: string;
  body: string;
  target: string;
  to: string[];
  dateMs: number | null;
  visible: boolean;
};

const READ_KEY = (who: string) => `fr_notices_read_v1:${who}`;

const toMillis = (v: unknown): number | null =>
  v && typeof v === 'object' && typeof (v as { toMillis?: unknown }).toMillis === 'function'
    ? (v as { toMillis: () => number }).toMillis()
    : null;

function fmtDate(ms: number | null): string {
  if (!ms) return '';
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

export type NoticeFeed = {
  notices: Notice[];
  hasUnread: boolean;
  markRead: (id: string) => void;
};

export function useNotices(): NoticeFeed {
  const user = useAuthUser();
  const who = user?.uid ?? 'anon';
  const email = (user?.email ?? '').trim().toLowerCase();

  const [raw, setRaw] = useState<Raw[] | null>(null);
  // Firestore から正しく届いたか。読み取りエラー（raw=[]）のときに、空の既読を保存して
  // 「過去分が全部未読で光る」ことにならないよう、種まきは届いたときだけ行う
  const [synced, setSynced] = useState(false);
  // 配信日時が来たお知らせを、アプリを開いたまま・裏から戻ったときにも出すための再計算の合図
  const [tick, setTick] = useState(0);
  // null = まだ端末から読めていない。読めたら Set（空も含む）
  const [readIds, setReadIds] = useState<Set<string> | null>(null);
  const [hadStored, setHadStored] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      notificationsCol(),
      (snap) => {
        setSynced(true);
        setRaw(
          snap.docs.map((d) => {
            const data = d.data() as Record<string, unknown>;
            return {
              id: d.id,
              title: typeof data.title === 'string' ? data.title : '',
              body: typeof data.body === 'string' ? data.body : '',
              target: typeof data.target === 'string' ? data.target : 'all',
              to: Array.isArray(data.to)
                ? data.to.filter((x): x is string => typeof x === 'string').map((x) => x.trim().toLowerCase())
                : [],
              dateMs: toMillis(data.date),
              visible: data.visible !== false,
            };
          }),
        );
      },
      // 読めないとき（ルール・通信）は「お知らせなし」として静かに扱う（既読の種まきはしない）
      () => {
        setSynced(false);
        setRaw([]);
      },
    );
    return unsub;
  }, []);

  // ユーザーが変わったら、その人の既読を端末から読み直す
  useEffect(() => {
    let alive = true;
    setReadIds(null);
    AsyncStorage.getItem(READ_KEY(who))
      .then((s) => {
        if (!alive) return;
        let ids: string[] | null = null;
        try {
          ids = s ? (JSON.parse(s) as string[]) : null;
        } catch {
          ids = null;
        }
        setHadStored(ids !== null);
        setReadIds(new Set(ids ?? []));
      })
      .catch(() => {
        if (!alive) return;
        setHadStored(true);
        setReadIds(new Set());
      });
    return () => {
      alive = false;
    };
  }, [who]);

  // 未来の配信日時が来る時刻に、一覧を作り直す。裏から戻ったときも作り直す
  useEffect(() => {
    if (!raw) return;
    const now = Date.now();
    const next = raw
      .filter((n) => n.visible && n.dateMs != null && n.dateMs > now)
      .reduce<number | null>((m, n) => (m === null || (n.dateMs as number) < m ? (n.dateMs as number) : m), null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (next !== null) {
      // setTimeout の上限（約24.8日）を超えないようにする。超える分は次の回で拾う
      timer = setTimeout(() => setTick((t) => t + 1), Math.min(next - now + 500, 2 ** 31 - 1));
    }
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') setTick((t) => t + 1);
    });
    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, [raw, tick]);

  // 今この人に見せてよいもの（新しい順）
  const visible = useMemo(() => {
    if (!raw) return [];
    const now = Date.now();
    return raw
      .filter((n) => n.visible)
      .filter((n) => n.dateMs == null || n.dateMs <= now)
      .filter((n) => n.target !== 'user' || (email !== '' && n.to.includes(email)))
      .sort((a, b) => (b.dateMs ?? 0) - (a.dateMs ?? 0));
  }, [raw, email, tick]);

  const persist = useCallback(
    (ids: Set<string>) => {
      AsyncStorage.setItem(READ_KEY(who), JSON.stringify([...ids])).catch(() => {});
    },
    [who],
  );

  // 初めて開いたとき: 届いている分を既読にして、過去の分が未読で光らないようにする
  useEffect(() => {
    if (readIds === null || raw === null || !synced || hadStored) return;
    const next = new Set(visible.map((n) => n.id));
    setReadIds(next);
    setHadStored(true);
    persist(next);
  }, [readIds, raw, synced, hadStored, visible, persist]);

  const markRead = useCallback(
    (id: string) => {
      setReadIds((prev) => {
        if (!prev || prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const notices = useMemo<Notice[]>(
    () =>
      visible.map((n) => ({
        id: n.id,
        title: n.title,
        date: fmtDate(n.dateMs),
        unread: readIds !== null && hadStored && !readIds.has(n.id),
        body: n.body || undefined,
      })),
    [visible, readIds, hadStored],
  );

  return { notices, hasUnread: notices.some((n) => n.unread), markRead };
}
