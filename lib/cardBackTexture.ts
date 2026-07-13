/**
 * cardBackTexture.ts — 3Dカード裏面テクスチャの生成（Skia オフスクリーン）
 * ------------------------------------------------------------------
 * ホーム画面の裏面（components/CardBack.tsx）と同じデザイン
 *   ・横帯グラデーション（磨きアルミの映り込み）
 *   ・縦ヘアライン（決定論ハッシュ）
 *   ・斜めの光沢一筋＋上端ハイライト/下端シェード
 *   ・刻印文字（No. / TAP / タイトル / Story / 原材料 / 周波数 / 作家名）
 * を CPU の Skia サーフェスに描き、RGBA ピクセル列で返す。
 * 呼び出し側（CardGL）が three.js の DataTexture に変換して裏面に貼る。
 */

import { Platform } from 'react-native';
import { Skia, matchFont, TileMode, PaintStyle, SkFont } from '@shopify/react-native-skia';
import type { CardBackData } from '../components/CardBack';

// CardBack.tsx と同じ帯色
const BAND_COLORS = [
  '#AEB4BD', '#E6E9EE', '#9CA2AB', '#D9DDE3',
  '#B6BBC4', '#EDEFF3', '#A4AAB3', '#CDD1D8',
];
const BAND_POS = [0, 0.16, 0.33, 0.48, 0.62, 0.78, 0.9, 1];

function hash(x: number): number {
  const s = Math.sin(x * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

// 和文=全角幅・欧文=約半角の概算（Skia の measureText 失敗時にも安全）
function estWidth(text: string, fs: number, font: SkFont | null): number {
  if (font) {
    try {
      const m = font.measureText(text);
      if (m && m.width > 0) return m.width;
    } catch {}
  }
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) < 256 ? fs * 0.52 : fs;
  return w;
}

// 全角/半角の概算幅で折り返し（日本語は文字単位で折る）
function wrap(text: string, fs: number, maxW: number, font: SkFont | null, maxLines: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const ch of text) {
    if (ch === '\n') { lines.push(cur); cur = ''; continue; }
    if (estWidth(cur + ch, fs, font) > maxW && cur.length > 0) {
      lines.push(cur);
      cur = ch;
      if (lines.length >= maxLines) return lines;
    } else {
      cur += ch;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, maxLines);
}

const JP_FONT = Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' });

function makeFont(size: number): SkFont | null {
  try {
    return matchFont({ fontFamily: JP_FONT, fontSize: size, fontStyle: 'normal', fontWeight: '400' });
  } catch {
    return null;
  }
}

export type BackPixels = { pixels: Uint8Array; width: number; height: number };

/**
 * 裏面デザインを描画して RGBA ピクセルを返す（失敗時 null）。
 * W:H は 2:3（カードと同比率）を渡すこと。
 */
export function renderCardBackPixels(data: CardBackData, W = 512, H = 768): BackPixels | null {
  const surface = Skia.Surface.Make(W, H);
  if (!surface) return null;
  const c = surface.getCanvas();

  // 設計座標: CardBack は幅~250dp想定 → テクスチャ幅512 に等倍換算
  const f = W / 250;
  const pad = 16 * f;

  // ── アルミ下地 ──
  const bg = Skia.Paint();
  bg.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 }, { x: W, y: 0 },
      BAND_COLORS.map((cc) => Skia.Color(cc)), BAND_POS, TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, W, H), bg);

  // 縦ヘアライン
  const lp = Skia.Paint();
  lp.setStyle(PaintStyle.Stroke);
  const nLines = Math.round(W * 0.55);
  for (let i = 0; i < nLines; i++) {
    const x = hash(i * 3.1) * W;
    const w = (0.5 + hash(i * 7.7) * 0.9) * f;
    const a = 0.02 + hash(i * 5.3) * 0.09;
    const light = hash(i * 9.7) < 0.5;
    lp.setStrokeWidth(w);
    lp.setColor(Skia.Color(light ? `rgba(255,255,255,${a.toFixed(3)})` : `rgba(30,34,40,${a.toFixed(3)})`));
    c.drawLine(x, 0, x, H, lp);
  }

  // 斜めの光沢一筋
  const sheen = Skia.Paint();
  sheen.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: W * 0.1, y: 0 }, { x: W * 0.9, y: H },
      [Skia.Color('rgba(255,255,255,0)'), Skia.Color('rgba(255,255,255,0.10)'), Skia.Color('rgba(255,255,255,0)')],
      [0.35, 0.5, 0.65], TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, W, H), sheen);

  // 面取り: 上端ハイライト／下端シェード
  const hl = Skia.Paint();
  hl.setColor(Skia.Color('rgba(255,255,255,0.5)'));
  c.drawRect(Skia.XYWHRect(0, 0, W, 2 * f), hl);
  const sh = Skia.Paint();
  sh.setColor(Skia.Color('rgba(20,24,30,0.35)'));
  c.drawRect(Skia.XYWHRect(0, H - 2 * f, W, 2 * f), sh);

  // ── 刻印（テキスト） ──
  const tp = Skia.Paint();
  const draw = (text: string, x: number, y: number, fs: number, color: string, align: 'l' | 'c' | 'r' = 'l') => {
    const font = makeFont(fs);
    if (!font) return;
    tp.setColor(Skia.Color(color));
    const w = estWidth(text, fs, font);
    const dx = align === 'c' ? -w / 2 : align === 'r' ? -w : 0;
    c.drawText(text, x + dx, y, tp, font);
  };

  // 上端: No. / TAP（CardBack と同配置）
  draw(data.serial ?? 'No. 001', pad, pad + 9 * f, 9 * f, 'rgba(40,46,54,0.75)');
  draw('TAP', W - pad, pad + 9 * f, 9 * f, 'rgba(40,46,54,0.9)', 'r');

  // 中央スタック（CardBack の body 構成: タイトル→Story→罫→原材料→周波数→作家名）
  let y = H * 0.26;
  const cxx = W / 2;
  const gap = 12 * f;

  draw(data.title, cxx, y, 22 * f, '#22262C', 'c');
  y += 14 * f + gap;

  if (data.story) {
    const fs = 12.5 * f;
    const lh = 21 * f;
    const lines = wrap(data.story, fs, W - pad * 2 - 8 * f, makeFont(fs), 6);
    for (const ln of lines) {
      draw(ln, pad + 4 * f, y, fs, '#33383F');
      y += lh;
    }
    y += gap * 0.5;
  }

  // 罫線（幅24dp相当・中央）
  const rulePaint = Skia.Paint();
  rulePaint.setColor(Skia.Color('rgba(40,46,54,0.45)'));
  c.drawRect(Skia.XYWHRect(cxx - 12 * f, y, 24 * f, 1 * f), rulePaint);
  y += gap * 1.4;

  if (data.materials && data.materials.length > 0) {
    draw('原 材 料', cxx, y, 10 * f, '#565C64', 'c');
    y += 10 * f * 0.5 + gap;
    draw(data.materials.join('・'), cxx, y, 15 * f, '#22262C', 'c');
    y += 15 * f * 0.5 + gap;
  }

  if (data.frequencies && data.frequencies.length > 0) {
    draw(data.frequencies.join('　'), cxx, y, 12 * f, '#3A5560', 'c');
    y += 12 * f * 0.5 + gap;
  }

  if (data.artist) {
    draw(data.artist.split('').join(' '), cxx, y, 11 * f, '#575E67', 'c');
  }

  const img = surface.makeImageSnapshot();
  const px = img.readPixels(0, 0);
  if (!px) return null;
  return { pixels: px instanceof Uint8Array ? px : new Uint8Array(px as ArrayLike<number>), width: W, height: H };
}
