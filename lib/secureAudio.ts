/**
 * secureAudio.ts — 端末に保存した音源の暗号化（2026-10-15）
 * ------------------------------------------------------------------
 * 端末保存（lib/downloads.ts）の音源を、そのままの WAV ではなく暗号化して置く。
 * 作家・レーベルから「買った曲のファイルが端末から抜き出せる」ことを問われるため。
 *
 *   ・方式: AES-256-GCM（expo-crypto のネイティブ実装）。2 MiB ごとの塊に分けて暗号化し、
 *     塊ごとに新しい nonce。塊の番号を追加認証データに入れて、並べ替え・差し替えを弾く
 *   ・鍵: 端末ごとに1本作り、キーチェーン／キーストア（expo-secure-store）に置く。
 *     AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY ＝ 端末の外（バックアップ・機種変更）へ出ない。
 *     鍵が無くなったら（再インストール等）保存済みの曲は読めないので、保存し直す
 *   ・再生: 鳴らす直前にアプリのキャッシュへ復号し、そのファイルを鳴らす。
 *     復号したファイルは直近の2曲ぶんだけ残し、起動時には全部消す
 *
 * ファイル形式（.fra）:
 *   'FRA1'(4) ＋ 塊の大きさ u32LE(4) ＋ [ 長さ u32LE(4) ＋ iv(12)・暗号文・tag(16) ] × n
 */

import * as SecureStore from 'expo-secure-store';
import { AESEncryptionKey, AESSealedData, aesDecryptAsync, aesEncryptAsync } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';

const KEY_NAME = 'fr.audioKey.v1';
const MAGIC = [0x46, 0x52, 0x41, 0x31]; // 'FRA1'
const CHUNK = 2 * 1024 * 1024;
const PLAY_KEEP = 2;

let keyPromise: Promise<AESEncryptionKey> | null = null;

/** 端末の鍵（無ければ作って保管庫に置く） */
function getKey(): Promise<AESEncryptionKey> {
  if (!keyPromise) {
    keyPromise = (async () => {
      const opts = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };
      const stored = await SecureStore.getItemAsync(KEY_NAME, opts);
      if (stored) return AESEncryptionKey.import(stored, 'base64');
      const key = await AESEncryptionKey.generate(256);
      await SecureStore.setItemAsync(KEY_NAME, await key.encoded('base64'), opts);
      return key;
    })().catch((e) => {
      keyPromise = null;
      throw e;
    });
  }
  return keyPromise;
}

const u32 = (n: number) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
const readU32 = (b: Uint8Array) => (b[0] | (b[1] << 8) | (b[2] << 16) | (b[3] << 24)) >>> 0;
/** 追加認証データ = 塊の番号（並べ替え・別ファイルの塊の差し替えを弾く） */
const aad = (index: number) => u32(index);

/** 暗号化済みのファイルか（先頭 4 バイトで判定） */
export function isEncryptedFile(file: File): boolean {
  if (!file.exists) return false;
  const h = file.open();
  try {
    const head = h.readBytes(4);
    return head.length === 4 && head.every((b, i) => b === MAGIC[i]);
  } finally {
    h.close();
  }
}

/** src（平文）→ dst（.fra）。終わったら src は消さない（呼び出し側で消す） */
export async function encryptFile(src: File, dst: File): Promise<void> {
  const key = await getKey();
  if (dst.exists) dst.delete();
  dst.create({ intermediates: true });
  const r = src.open();
  const w = dst.open();
  try {
    const size = r.size ?? src.size ?? 0;
    w.writeBytes(new Uint8Array([...MAGIC, ...u32(CHUNK)]));
    let index = 0;
    for (let done = 0; done < size; index++) {
      const plain = r.readBytes(Math.min(CHUNK, size - done));
      if (plain.length === 0) break;
      done += plain.length;
      const sealed = await aesEncryptAsync(plain, key, { additionalData: aad(index) });
      const combined = await sealed.combined('bytes');
      w.writeBytes(u32(combined.length));
      w.writeBytes(combined);
    }
  } finally {
    r.close();
    w.close();
  }
}

/** src（.fra）→ dst（平文）。改ざん・鍵違いなら例外 */
export async function decryptFile(src: File, dst: File): Promise<void> {
  const key = await getKey();
  if (dst.exists) dst.delete();
  dst.create({ intermediates: true });
  const r = src.open();
  const w = dst.open();
  try {
    const head = r.readBytes(8);
    if (head.length < 8 || !MAGIC.every((b, i) => head[i] === b)) throw new Error('not an encrypted audio file');
    const size = r.size ?? src.size ?? 0;
    let pos = 8;
    for (let index = 0; pos < size; index++) {
      const len = readU32(r.readBytes(4));
      if (!len || len > CHUNK + 64) throw new Error('broken chunk');
      const combined = r.readBytes(len);
      if (combined.length !== len) throw new Error('truncated');
      pos += 4 + len;
      const plain = await aesDecryptAsync(AESSealedData.fromCombined(combined), key, {
        additionalData: aad(index),
      });
      w.writeBytes(plain);
    }
  } catch (e) {
    w.close();
    try {
      dst.delete();
    } catch {}
    r.close();
    throw e;
  }
  r.close();
  w.close();
}

// ── 再生用の復号（キャッシュ） ──

const playDir = () => new Directory(Paths.cache, 'fr-play');
/** 直近に復号した曲（古い順）。key → 平文の file:// */
const decrypted = new Map<string, string>();
const inflight = new Map<string, Promise<string>>();

/** 起動時に一度: 前回の残りの平文を消す */
export function clearPlayCache() {
  try {
    const d = playDir();
    if (d.exists) d.delete();
  } catch {}
  decrypted.clear();
}

/**
 * 暗号化して保存した曲を鳴らせる file:// にする。
 * 直近の2曲ぶんは復号済みを使い回し、それより古いものは消す。
 */
export function playableUri(audioKey: string, encryptedUri: string): Promise<string> {
  const hit = decrypted.get(audioKey);
  if (hit && new File(hit).exists) {
    decrypted.delete(audioKey);
    decrypted.set(audioKey, hit); // 新しい側へ
    return Promise.resolve(hit);
  }
  const running = inflight.get(audioKey);
  if (running) return running;
  const job = (async () => {
    const d = playDir();
    d.create({ idempotent: true, intermediates: true });
    const out = new File(d, `${audioKey.replace(/[^A-Za-z0-9._-]/g, '_')}.wav`);
    await decryptFile(new File(encryptedUri), out);
    decrypted.set(audioKey, out.uri);
    while (decrypted.size > PLAY_KEEP) {
      const [oldKey, oldUri] = decrypted.entries().next().value as [string, string];
      decrypted.delete(oldKey);
      try {
        new File(oldUri).delete();
      } catch {}
    }
    return out.uri;
  })().finally(() => inflight.delete(audioKey));
  inflight.set(audioKey, job);
  return job;
}

/** 保存を消したとき: その曲の復号済みも消す */
export function forgetPlayable(audioKey: string) {
  const uri = decrypted.get(audioKey);
  decrypted.delete(audioKey);
  if (uri) {
    try {
      new File(uri).delete();
    } catch {}
  }
}
