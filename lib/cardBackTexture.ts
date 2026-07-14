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
import {
  Skia,
  matchFont,
  TileMode,
  PaintStyle,
  BlendMode,
  BlurStyle,
  SkFont,
  SkCanvas,
  SkImage,
} from '@shopify/react-native-skia';
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

/* ════════════════════════════════════════════════════════════════
   ストーリー面（card_parts_standalone2 v98 準拠・ホーム用）
   ・下地 #0d1330 → 作品画像を左右反転＋blur(15px)で敷く（bk-gem）
   ・白青の縦ティント（bk-gemtint 214,228,247/.60 → 241,247,255/.72）
   ・紺の刻印: No.(左上)/TAP(右上)/タイトル/Story(最大5行)/罫線/
     原材料/周波数/作家名（各 fs・字間・色は参照CSSの値）
   ・金属フレーム: 太さ0.025w・縦5段グラデ #E6F2FF→#9FB2C8→#57697F→
     #4FB5C9→#6FCFE0（bk-frame）
   ・斜め147°の反射帯（bk-refl pos.7 w.16 i.3・screen合成）＋
     シアンの内側フレネル光（117,201,230/.28）
   参照カード幅 188.6 を基準にテクスチャへ等倍スケール。
   ════════════════════════════════════════════════════════════════ */

const REF_W = 188.6;

// 字間つき描画（CSS letter-spacing 相当）
function drawSpaced(
  c: SkCanvas,
  text: string,
  x: number,
  y: number,
  fs: number,
  color: string,
  lsEm: number,
  align: 'l' | 'c' | 'r' = 'l',
) {
  const font = makeFont(fs);
  if (!font) return;
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  const chars = [...text];
  const ls = lsEm * fs;
  const widths = chars.map((ch) => estWidth(ch, fs, font));
  const total = widths.reduce((a, b) => a + b, 0) + ls * Math.max(0, chars.length - 1);
  let cx = align === 'c' ? x - total / 2 : align === 'r' ? x - total : x;
  chars.forEach((ch, i) => {
    c.drawText(ch, cx, y, paint, font);
    cx += widths[i] + ls;
  });
}

// 左右反転＋cover でイメージを敷く（bk-gem の scaleX(-1)＋object-fit:cover）
function drawMirroredCover(c: SkCanvas, img: SkImage, W: number, H: number, blurSigma: number) {
  const iw = img.width();
  const ih = img.height();
  const sc = Math.max(W / iw, H / ih);
  const dw = iw * sc;
  const dh = ih * sc;
  const p = Skia.Paint();
  if (blurSigma > 0) {
    p.setImageFilter(Skia.ImageFilter.MakeBlur(blurSigma, blurSigma, TileMode.Clamp, null));
  }
  c.save();
  c.translate(W, 0);
  c.scale(-1, 1);
  c.drawImageRect(
    img,
    Skia.XYWHRect(0, 0, iw, ih),
    Skia.XYWHRect((W - dw) / 2, (H - dh) / 2, dw, dh),
    p,
  );
  c.restore();
}

export async function renderStoryBackPixels(
  data: CardBackData,
  artworkUrl: string | undefined,
  W = 512,
  H = 768,
): Promise<BackPixels | null> {
  const surface = Skia.Surface.Make(W, H);
  if (!surface) return null;
  const c = surface.getCanvas();
  const f = W / REF_W; // 参照単位 → テクスチャpx

  // ── 下地 ──
  const base = Skia.Paint();
  base.setColor(Skia.Color('#0d1330'));
  c.drawRect(Skia.XYWHRect(0, 0, W, H), base);

  // ── bk-gem: 作品画像（左右反転・blur15・cover） ──
  if (artworkUrl) {
    try {
      const d = await Skia.Data.fromURI(artworkUrl);
      const img = d ? Skia.Image.MakeImageFromEncoded(d) : null;
      if (img) drawMirroredCover(c, img, W, H, 15 * f);
    } catch {}
  }

  // ── bk-gemtint: フロストの縦ティント ──
  const tint = Skia.Paint();
  tint.setShader(
    Skia.Shader.MakeLinearGradient(
      { x: 0, y: 0 },
      { x: 0, y: H },
      [
        Skia.Color('rgba(214,228,247,0.60)'),
        Skia.Color('rgba(230,241,253,0.66)'),
        Skia.Color('rgba(241,247,255,0.72)'),
      ],
      [0, 0.52, 1],
      TileMode.Clamp,
    ),
  );
  c.drawRect(Skia.XYWHRect(0, 0, W, H), tint);

  // ── 刻印テキスト（座標は参照CSSのpx値 × f） ──
  drawSpaced(c, data.serial ?? 'No. 001', 26 * f, 29.2 * f, 9 * f, 'rgba(66,80,112,0.62)', 0.24, 'l');
  drawSpaced(c, 'TAP', (REF_W - 16) * f, 22.2 * f, 9 * f, 'rgba(66,80,112,0.92)', 0.16, 'r');

  // タイトル（fs23 中央 #46527A）
  drawSpaced(c, data.title, W / 2, 66 * f, 23 * f, '#46527A', 0.08, 'c');

  // Story（fs12.5 lh1.7 字間.03em 最大5行 #3B4A72・左寄せ）
  if (data.story) {
    const fs = 12.5 * f;
    const lh = 21.25 * f;
    // 字間ぶん（約3%）を差し引いた幅で折り返す
    const lines = wrap(data.story, fs, (W - 32 * f) * 0.97, makeFont(fs), 5);
    let y = 103 * f;
    for (const ln of lines) {
      drawSpaced(c, ln, 16 * f, y, fs, '#3B4A72', 0.03, 'l');
      y += lh;
    }
  }

  // 罫線（幅64%・シアングラデ）
  {
    const lw = W * 0.64;
    const lp = Skia.Paint();
    lp.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: (W - lw) / 2, y: 0 },
        { x: (W + lw) / 2, y: 0 },
        [
          Skia.Color('rgba(96,206,224,0)'),
          Skia.Color('rgba(96,206,224,0.55)'),
          Skia.Color('rgba(96,206,224,0)'),
        ],
        [0, 0.5, 1],
        TileMode.Clamp,
      ),
    );
    c.drawRect(Skia.XYWHRect((W - lw) / 2, 165.5 * f, lw, 1 * f), lp);
  }

  // 原材料 / 周波数 / 作家名（中央揃え・参照の fs/字間/色）
  if (data.materials && data.materials.length > 0) {
    drawSpaced(c, '原材料', W / 2, 182.5 * f, 11 * f, '#7C87A4', 0.36, 'c');
    drawSpaced(c, data.materials.join('・'), W / 2, 201.5 * f, 15 * f, '#2C3856', 0.2, 'c');
  }
  if (data.frequencies && data.frequencies.length > 0) {
    drawSpaced(c, data.frequencies.join(' ・ '), W / 2, 217.5 * f, 12.5 * f, '#3B7C97', 0.12, 'c');
  }
  if (data.artist) {
    drawSpaced(c, data.artist.toUpperCase(), W / 2, 238.9 * f, 12 * f, '#8890A6', 0.3, 'c');
  }

  // ── bk-frame: 金属フレーム（太さ0.025w・縦5段グラデ） ──
  {
    const fr = 0.025 * W;
    const cr = 0.085 * W;
    const fp = Skia.Paint();
    fp.setStyle(PaintStyle.Stroke);
    fp.setStrokeWidth(fr);
    fp.setShader(
      Skia.Shader.MakeLinearGradient(
        { x: 0, y: 0 },
        { x: 0, y: H },
        [
          Skia.Color('#E6F2FF'),
          Skia.Color('#9FB2C8'),
          Skia.Color('#57697F'),
          Skia.Color('#4FB5C9'),
          Skia.Color('#6FCFE0'),
        ],
        [0, 0.26, 0.52, 0.82, 1],
        TileMode.Clamp,
      ),
    );
    const rr = Skia.RRectXY(
      Skia.XYWHRect(fr / 2, fr / 2, W - fr, H - fr),
      Math.max(cr - fr / 2, 2),
      Math.max(cr - fr / 2, 2),
    );
    c.drawRRect(rr, fp);
  }

  // ── bk-refl: 斜め147°の反射帯（screen合成） ──
  {
    const rad = (147 * Math.PI) / 180;
    const dir = { x: Math.sin(rad), y: -Math.cos(rad) }; // CSSのgradient角は上=0°時計回り
    const L = Math.abs(dir.x) * W + Math.abs(dir.y) * H;
    const cxm = W / 2;
    const cym = H / 2;
    const start = { x: cxm - (dir.x * L) / 2, y: cym - (dir.y * L) / 2 };
    const end = { x: cxm + (dir.x * L) / 2, y: cym + (dir.y * L) / 2 };
    const pos = 0.7;
    const bw = 0.16;
    const i0 = 0.3;
    const rp = Skia.Paint();
    rp.setBlendMode(BlendMode.Screen);
    rp.setShader(
      Skia.Shader.MakeLinearGradient(
        start,
        end,
        [
          Skia.Color('rgba(245,250,255,0)'),
          Skia.Color(`rgba(245,250,255,${(i0 * 0.45).toFixed(3)})`),
          Skia.Color(`rgba(245,250,255,${i0})`),
          Skia.Color(`rgba(245,250,255,${(i0 * 0.45).toFixed(3)})`),
          Skia.Color('rgba(245,250,255,0)'),
        ],
        [pos - bw, pos - bw * 0.45, pos, pos + bw * 0.45, pos + bw],
        TileMode.Clamp,
      ),
    );
    c.drawRect(Skia.XYWHRect(0, 0, W, H), rp);
  }

  // ── シアンの内側フレネル光（inset 0 0 26px / 8px） ──
  {
    const glow = (blurPx: number, alpha: number) => {
      const gp = Skia.Paint();
      gp.setStyle(PaintStyle.Stroke);
      gp.setStrokeWidth(blurPx * f);
      gp.setColor(Skia.Color(`rgba(117,201,230,${alpha})`));
      gp.setMaskFilter(Skia.MaskFilter.MakeBlur(BlurStyle.Normal, (blurPx / 2) * f, true));
      const cr = 0.085 * W;
      c.drawRRect(Skia.RRectXY(Skia.XYWHRect(0, 0, W, H), cr, cr), gp);
    };
    glow(26, 0.28);
    glow(8, 0.154);
  }

  const img = surface.makeImageSnapshot();
  const px = img.readPixels(0, 0);
  if (!px) return null;
  return { pixels: px instanceof Uint8Array ? px : new Uint8Array(px as ArrayLike<number>), width: W, height: H };
}
