/**
 * lruCache.ts — 破棄フック付きの小さな LRU
 * ------------------------------------------------------------------
 * skiaSprites.ts の cachedImage とは意図的に別枠にしている。
 *   ・あちらは SkImage 用で、破棄は JSI の GC 任せでよい。こちらは
 *     THREE.DataTexture のように「追い出すときに明示解放が要る」ものを扱う
 *   ・あちらは FIFO（ヒットしても順序を更新しない）。こちらは真の LRU
 *   ・枠を共有すると、skiaSprites.ts:58-61 が記録している事故
 *     （ホームだけで6キーを使うので上限4では sealInk が焼き直しループに入る）
 *     が再発する。用途ごとに枠を分ける
 */

export type Lru<T> = {
  get(key: string): T | undefined;
  set(key: string, value: T): void;
  has(key: string): boolean;
};

export function createLru<T>(opts: { limit: number; onEvict?: (value: T, key: string) => void }): Lru<T> {
  const map = new Map<string, T>();
  return {
    get(key) {
      if (!map.has(key)) return undefined;
      const v = map.get(key) as T;
      // ヒットしたら最新へ入れ直す。これをやらないと FIFO になり、
      // よく使うキーでも挿入順で押し出される。
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key, value) {
      if (map.has(key)) map.delete(key);
      map.set(key, value);
      while (map.size > opts.limit) {
        const oldest = map.keys().next().value;
        if (oldest === undefined) break;
        const dead = map.get(oldest) as T;
        map.delete(oldest);
        opts.onEvict?.(dead, oldest);
      }
    },
    has: (key) => map.has(key),
  };
}
