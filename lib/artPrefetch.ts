/**
 * artPrefetch.ts — 作品の絵（artworkUrl）の先読み
 * ------------------------------------------------------------------
 * 起動直後に HOME やマイリストのカードが真っ黒のまま始まる件（2026-09-26）。
 * 絵の先読みは HOME を開いてから始めていたので、初回起動では絵が届く前に
 * カードが灯り、届くまで黒い板（落影と面内減光だけ）に見えていた。
 *
 *   ・曲の一覧が届いた時点（起動画面の裏）で App から prefetchArt() を呼ぶ
 *   ・HOME の最初の演出は waitArt() で、真ん中と両隣の絵が届くのを待ってから灯す
 *     （待つのは最大数秒。届かなくても演出は始める）
 *
 * RN の Image.prefetch はディスクへ落とすので、あとで <Image> が同じ URL を
 * 読むときは手元から出る。同じ URL は一度しか取りに行かない。
 *
 * 取りに行くのは同時に MAX_PARALLEL 件まで、並びの先頭から順に（2026-09-29）。
 * 以前は全曲（最大 50 枚・元絵は長辺 2048px 級）を一度に投げていた。iOS の RN の
 * 画像ローダーは先入れ先出しで同時 4 件しか読まず、先読みも画面に出るカードの
 * <Image> も同じ列に並ぶので、いま見せるカードが数十枚の先読みの後ろで待たされ、
 * 4G では絵が 20 秒近く遅れた（岡さん報告）。同時 2 件に絞れば、残りの枠を画面に
 * 出るカードが使える。
 */

import { Image } from 'react-native';

/** 先読みで同時に取りに行く件数。ローダーの枠（iOS は 4）の半分を画面のカード用に残す */
const MAX_PARALLEL = 2;
/** 1 件がこの時間かかっても終わらなければ枠だけ空ける（取得自体は続く）。列が詰まらないように */
const SLOT_TIMEOUT_MS = 15000;

type Entry = { url: string; run: () => void };

/** 取りに行く約束（列で待っている分も含む）。同じ URL は一度しか作らない */
const jobs = new Map<string, Promise<boolean>>();
/** まだ取りに行っていない分。先頭から順に取る */
const queue: Entry[] = [];
let running = 0;

function pump(): void {
  while (running < MAX_PARALLEL && queue.length > 0) {
    const next = queue.shift()!;
    running += 1;
    next.run();
  }
}

/** 列に並べる（front なら先頭へ。すでに並んでいる URL は先頭へ移すだけ） */
function enqueue(url: string, front: boolean): void {
  if (jobs.has(url)) {
    if (front) {
      const i = queue.findIndex((e) => e.url === url);
      if (i > 0) queue.unshift(queue.splice(i, 1)[0]);
    }
    return;
  }
  jobs.set(
    url,
    new Promise<boolean>((resolve) => {
      const entry: Entry = {
        url,
        run: () => {
          let released = false;
          const release = () => {
            if (released) return;
            released = true;
            running -= 1;
            pump();
          };
          const slotTimer = setTimeout(release, SLOT_TIMEOUT_MS);
          Image.prefetch(url).then(
            (ok) => !!ok,
            () => false,
          ).then((ok) => {
            clearTimeout(slotTimer);
            // 失敗したら次の呼び出しでもう一度取りに行けるようにしておく
            if (!ok) jobs.delete(url);
            resolve(ok);
            release();
          });
        },
      };
      if (front) queue.unshift(entry);
      else queue.push(entry);
    }),
  );
  pump();
}

/** 絵を先読みする（並びの先頭から取りに行く）。もう取りに行った URL は飛ばす */
export function prefetchArt(urls: (string | null | undefined)[]): void {
  for (const url of urls) {
    if (url) enqueue(url, false);
  }
}

/**
 * 絵が届くのを待つ（まだ取りに行っていなければ取りに行く）。
 * いま見せる絵なので、列の先頭へ割り込ませる。
 * timeoutMs を過ぎたら、届いていなくても解決する。
 */
export function waitArt(urls: (string | null | undefined)[], timeoutMs: number): Promise<void> {
  const list = urls.filter((u): u is string => !!u);
  if (list.length === 0) return Promise.resolve();
  // 逆順に先頭へ入れると、list の並びのまま先頭に並ぶ
  for (let i = list.length - 1; i >= 0; i -= 1) enqueue(list[i], true);
  const all = Promise.all(list.map((u) => jobs.get(u) ?? Promise.resolve(false))).then(() => {});
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
