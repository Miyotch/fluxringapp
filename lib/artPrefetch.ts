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
 */

import { Image } from 'react-native';

const jobs = new Map<string, Promise<boolean>>();

/** 絵を先読みする（並びの先頭から取りに行く）。もう取りに行った URL は飛ばす */
export function prefetchArt(urls: (string | null | undefined)[]): void {
  for (const url of urls) {
    if (!url || jobs.has(url)) continue;
    jobs.set(
      url,
      Image.prefetch(url).then(
        (ok) => !!ok,
        () => {
          // 失敗したら次の呼び出しでもう一度取りに行けるようにしておく
          jobs.delete(url);
          return false;
        },
      ),
    );
  }
}

/**
 * 絵が届くのを待つ（まだ取りに行っていなければ取りに行く）。
 * timeoutMs を過ぎたら、届いていなくても解決する。
 */
export function waitArt(urls: (string | null | undefined)[], timeoutMs: number): Promise<void> {
  const list = urls.filter((u): u is string => !!u);
  if (list.length === 0) return Promise.resolve();
  prefetchArt(list);
  const all = Promise.all(list.map((u) => jobs.get(u) ?? Promise.resolve(false))).then(() => {});
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}
