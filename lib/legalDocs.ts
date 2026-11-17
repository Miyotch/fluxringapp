/**
 * legalDocs.ts — CREDITS / 利用規約 / プライバシーポリシー / 特商法の文面を Firestore から読む
 * ------------------------------------------------------------------
 * 置き場所: legal_docs/{credits | terms | privacy | tokushoho}
 *
 *   {
 *     ja: { ...中身 },        // 必須。中身の形は下の型（CreditsContent など）
 *     en: { ...中身 },        // 任意。英語表示のときに使い、無ければ ja を出す
 *     published: true,        // false にするとアプリはこのドキュメントを使わない（同梱の文面を出す）
 *     version: 1,             // 版（管理用。アプリは表示しない）
 *     effectiveAt: Timestamp, // 施行日（管理用。アプリは表示しない）
 *     updatedAt: Timestamp,
 *   }
 *
 * 書くのは管理画面（またはサービスアカウント）だけ。アプリは読むだけで、編集機能は持たない。
 * ドキュメントが無い・読めない・形が崩れているときは、アプリに同梱した文面
 * （constants/legalDocs.json）をそのまま出す。初回起動で電波が無いときに
 * 利用規約が空になるのを防ぐため。同梱の文面は Firestore へ初期投入した元と同じ
 * （scripts/seed-legal-docs.mjs）。
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { useI18n } from './i18n';
import bundled from '../constants/legalDocs.json';

// ── 中身の型 ──────────────────────────────────

/** CREDITS: 役職ラベル＋名前。hero=true は上部の大きな枠（ファウンダー） */
export type CreditEntry = { role: string; name: string; hero?: boolean };
export type CreditsContent = { entries: CreditEntry[] };

/** 条文形式（利用規約・プライバシーポリシー）: 前文＋条ごとの見出し・本文 */
export type DocSection = { heading?: string; body: string };
export type TextDoc = { title: string; lead?: string; sections: DocSection[] };

/** 特商法: list 項目は文字列か { text, badge }。badge と badgeInText は同じ意味の別名 */
export type TokushoListItem = string | { text: string; badge?: string; badgeInText?: string };
export type TokushoRow = {
  label: string;
  value?: string;
  /** value の直後に添えるバッジ（例: 仮置きのメールアドレス） */
  badge?: string;
  list?: TokushoListItem[];
  note?: string;
  /** note の直後に添えるバッジ */
  badgeInNote?: string;
};
export type TokushohoContent = { rows: TokushoRow[]; footer?: string };

export type LegalDocContents = {
  credits: CreditsContent;
  terms: TextDoc;
  privacy: TextDoc;
  tokushoho: TokushohoContent;
};
export type LegalDocId = keyof LegalDocContents;

/** アプリに同梱した文面（Firestore が読めないときに出す） */
export const BUNDLED_LEGAL_DOCS = bundled as LegalDocContents;

// ── Firestore の値を確かめる（形が崩れていたら null → 同梱の文面を出す） ──

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const optStr = (v: unknown): string | undefined => (isStr(v) && v !== '' ? v : undefined);

/** 配列の各要素を変換し、1つでも崩れていれば全体を null にする */
function each<T>(v: unknown, f: (x: unknown) => T | null): T[] | null {
  if (!Array.isArray(v)) return null;
  const out: T[] = [];
  for (const x of v) {
    const y = f(x);
    if (y === null) return null;
    out.push(y);
  }
  return out;
}

function parseCredits(v: unknown): CreditsContent | null {
  if (!isObj(v)) return null;
  const entries = each(v.entries, (e): CreditEntry | null =>
    isObj(e) && isStr(e.role) && isStr(e.name)
      ? { role: e.role, name: e.name, ...(e.hero === true ? { hero: true } : {}) }
      : null,
  );
  // 先頭がファウンダー枠として描かれるので、1件以上ないと出せない
  return entries && entries.length > 0 ? { entries } : null;
}

function parseTextDoc(v: unknown): TextDoc | null {
  if (!isObj(v) || !isStr(v.title)) return null;
  const sections = each(v.sections, (x): DocSection | null =>
    isObj(x) && isStr(x.body) ? { heading: optStr(x.heading), body: x.body } : null,
  );
  return sections ? { title: v.title, lead: optStr(v.lead), sections } : null;
}

function parseTokushoho(v: unknown): TokushohoContent | null {
  if (!isObj(v)) return null;
  const rows = each(v.rows, (r): TokushoRow | null => {
    if (!isObj(r) || !isStr(r.label)) return null;
    let list: TokushoListItem[] | undefined;
    if (r.list != null) {
      const parsed = each(r.list, (i): TokushoListItem | null =>
        isStr(i)
          ? i
          : isObj(i) && isStr(i.text)
          ? { text: i.text, badge: optStr(i.badge), badgeInText: optStr(i.badgeInText) }
          : null,
      );
      if (!parsed) return null;
      list = parsed;
    }
    return {
      label: r.label,
      value: optStr(r.value),
      badge: optStr(r.badge),
      list,
      note: optStr(r.note),
      badgeInNote: optStr(r.badgeInNote),
    };
  });
  return rows ? { rows, footer: optStr(v.footer) } : null;
}

const PARSERS: { [K in LegalDocId]: (v: unknown) => LegalDocContents[K] | null } = {
  credits: parseCredits,
  terms: parseTextDoc,
  privacy: parseTextDoc,
  tokushoho: parseTokushoho,
};

/** ドキュメント全体から、表示する言語の中身を選ぶ（その言語が無い・崩れていれば ja） */
function pickContent<K extends LegalDocId>(id: K, data: Obj | undefined, lang: string): LegalDocContents[K] | null {
  if (!data || data.published === false) return null;
  const parse = PARSERS[id];
  return (lang !== 'ja' ? parse(data[lang]) : null) ?? parse(data.ja);
}

// ── 読み込みフック ───────────────────────────────

/**
 * legal_docs/{id} を購読し、表示する中身を返す。
 * 読めるまで・読めないときは同梱の文面を返すので、呼ぶ側は空の状態を気にしなくてよい。
 * onSnapshot なので Firestore のオフラインキャッシュも効き、管理画面で直すと開いたままでも反映される。
 */
export function useLegalDoc<K extends LegalDocId>(id: K): LegalDocContents[K] {
  const { lang } = useI18n();
  const [data, setData] = useState<Obj | undefined>(undefined);

  useEffect(() => {
    setData(undefined);
    const unsub = onSnapshot(
      doc(db, 'legal_docs', id),
      (snap) => setData(snap.data()),
      () => setData(undefined),
    );
    return unsub;
  }, [id]);

  return pickContent(id, data, lang) ?? BUNDLED_LEGAL_DOCS[id];
}
