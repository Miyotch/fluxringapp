/**
 * PurchaseParticles.tsx — 購入確定時の光粒子（泡）エフェクト
 * ------------------------------------------------------------------
 * 「購入する」確定タップの直後、画面下部（または指定した起点＝ボタンの周囲）から
 * 無数の細かい泡・星屑が、1/f ゆらぎで揺れながら重力に逆らって昇り、
 * 上端でふっと消える。
 *
 * ── 描画方式（重要） ──
 * 旧実装は「1粒子 = 1つの <Circle> + 4つの useDerivedValue」で 280 個。
 * 指定の 20 倍（5,600 個）をこの方式でやると derived value が 22,400 個になり、
 * UIスレッドが即座に破綻する。そこで Skia の <Atlas>（= drawAtlas）へ変更した:
 *   ・粒子は「1枚の小さなスプライト画像」を 5,600 回インスタンス描画する
 *     ＝ネイティブ側は実質1ドローコール
 *   ・位置/回転/拡大は useRSXformBuffer、色と不透明度は useColorBuffer で
 *     それぞれ「1つのワークレットが配列を丸ごと更新」する形にまとめる
 *     ＝React 要素は Atlas ただ1つ、derived value も 2 つだけ
 *
 * ── 粒子パラメータ ──
 *   ・粒子数: 5,600（旧 280 の 20 倍）
 *   ・直径  : 極小0.8-1.6px(62%) / 小1.6-2.6px(28%) / 中2.6-4.2px(10%)
 *   ・色    : 明るいシアン#A0ECF7(50%) / 白#FFFFFF(30%) / シアン#60CEE0(20%)
 *   ・Y     : 起点から 180〜340px 上昇（軽く加速＝浮力）
 *   ・X     : 1/f ゆらぎ（2オクターブのサイン合成）で ±最大24px 蛇行
 *   ・α     : フェードイン → 上昇中チラつき → 上端でフェードアウト
 *   ・各粒子は 0〜600ms のランダム遅延で湧き、連続的に噴き上がって見せる
 * 総尺は約2.0秒（呼び出し側のカード発光・浮遊と同時に開始する想定）。
 */

import React, { useMemo, useEffect } from 'react';
import {
  Canvas,
  Group,
  Atlas,
  Paint,
  Skia,
  TileMode,
  rect,
  useClock,
  useRSXformBuffer,
  useColorBuffer,
} from '@shopify/react-native-skia';
import {
  useSharedValue,
  useDerivedValue,
  withTiming,
  withDelay,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

// 指摘の「現状の20倍の細かい泡」= 280 × 20。Atlas 描画だからこの数でも成立する。
const PARTICLE_COUNT = 5600;

// スプライト1枚の一辺(px)。実際の粒はここから縮小して描くので、
// 小さすぎるとボケ、大きすぎるとテクスチャが無駄になる。24 は中庸。
const TILE = 24;

const RISE_MIN = 180;
const RISE_MAX = 340;
const WOBBLE_MAX = 24;
const DELAY_MAX = 600;
const DURATION_MIN = 900;
const DURATION_MAX = 1600;

// 明るいシアン5 : 白3 : シアン2（= 50% / 30% / 20%）を RGB 0..1 で保持
const PALETTE = [
  0.627, 0.925, 0.969, // #A0ECF7
  1.0, 1.0, 1.0,       // #FFFFFF
  0.376, 0.808, 0.878, // #60CEE0
];
function pickColorIndex(r: number): number {
  if (r < 0.5) return 0;
  if (r < 0.8) return 1;
  return 2;
}

// 直径(px)。極小62% / 小28% / 中10%。「細かい泡」指定に合わせて全体に小粒。
function randomDiameter(): number {
  const r = Math.random();
  if (r < 0.62) return 0.8 + Math.random() * 0.8;
  if (r < 0.9) return 1.6 + Math.random() * 1.0;
  return 2.6 + Math.random() * 1.6;
}

// 粒子1個あたりのフィールド数（Float の平坦配列に詰める）。
// 5,600個を「オブジェクトの配列」にするとワークレットへの転送コストが重いので、
// 数値だけの1次元配列にして stride でアクセスする。
const STRIDE = 11;
const F_X0 = 0;       // 発生X
const F_Y0 = 1;       // 発生Y
const F_RISE = 2;     // 上昇距離
const F_WAMP = 3;     // 横ゆらぎ振幅
const F_WFREQ = 4;    // 横ゆらぎ基本角周波数
const F_PHASE = 5;    // 位相
const F_DIA = 6;      // 直径(px)
const F_DELAY = 7;    // 発生遅延(ms)
const F_DUR = 8;      // 上昇にかける時間(ms)
const F_CIDX = 9;     // 色インデックス(0/1/2) × 3
const F_FLICK = 10;   // チラつき速度

type Origin = { x: number; y: number };

function buildParticles(n: number, w: number, h: number, origin?: Origin): number[] {
  const d = new Array<number>(n * STRIDE);
  for (let i = 0; i < n; i++) {
    const b = i * STRIDE;
    if (origin) {
      // ボタンの周囲から湧かせる: 横に広め・縦に浅い楕円状のばらつき
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()); // 面積一様
      d[b + F_X0] = origin.x + Math.cos(a) * rr * 110;
      d[b + F_Y0] = origin.y + Math.sin(a) * rr * 26;
    } else {
      // 既定: 画面下部の帯から全幅に散らす
      d[b + F_X0] = Math.random() * w;
      d[b + F_Y0] = h * (0.7 + Math.random() * 0.3);
    }
    d[b + F_RISE] = RISE_MIN + Math.random() * (RISE_MAX - RISE_MIN);
    d[b + F_WAMP] = Math.random() * WOBBLE_MAX;
    d[b + F_WFREQ] = 3.0 + Math.random() * 5.0;
    d[b + F_PHASE] = Math.random() * Math.PI * 2;
    d[b + F_DIA] = randomDiameter();
    d[b + F_DELAY] = Math.random() * DELAY_MAX;
    d[b + F_DUR] = DURATION_MIN + Math.random() * (DURATION_MAX - DURATION_MIN);
    d[b + F_CIDX] = pickColorIndex(Math.random()) * 3;
    d[b + F_FLICK] = 6 + Math.random() * 10;
  }
  return d;
}

type Props = {
  width: number;
  height: number;
  /** 指定すると、その座標の周囲から湧く（未指定なら画面下部の帯から） */
  origin?: Origin;
  onDone?: () => void;
};

export const PurchaseParticles: React.FC<Props> = ({ width, height, origin, onDone }) => {
  const clock = useClock();
  const master = useSharedValue(0);

  const data = useMemo(
    () => buildParticles(PARTICLE_COUNT, width, height, origin),
    [width, height, origin],
  );

  // 粒のスプライト: 中心が白く縁へ滑らかに消える円。
  // これ自体がボケ足を持つので、Group 側で重い全画面ブラーをかけなくて済む。
  const sprite = useMemo(() => {
    const surface = Skia.Surface.Make(TILE, TILE);
    if (!surface) return null;
    const c = surface.getCanvas();
    const p = Skia.Paint();
    p.setAntiAlias(true);
    p.setShader(
      Skia.Shader.MakeRadialGradient(
        { x: TILE / 2, y: TILE / 2 },
        TILE / 2,
        [
          Skia.Color('rgba(255,255,255,1)'),
          Skia.Color('rgba(255,255,255,0.82)'),
          Skia.Color('rgba(255,255,255,0)'),
        ],
        [0, 0.32, 1],
        TileMode.Clamp,
      ),
    );
    c.drawCircle(TILE / 2, TILE / 2, TILE / 2, p);
    return surface.makeImageSnapshot();
  }, []);

  // Atlas は sprites / transforms / colors の3配列が同じ長さである必要がある。
  // 切り出し矩形は全粒子で同じ（スプライトは1種類）なので静的に作る。
  const sprites = useMemo(
    () => Array.from({ length: PARTICLE_COUNT }, () => rect(0, 0, TILE, TILE)),
    [],
  );

  // 位置・拡大。1ワークレットで 5,600 件をまとめて更新する。
  const transforms = useRSXformBuffer(PARTICLE_COUNT, (val, i) => {
    'worklet';
    const b = i * STRIDE;
    const el = clock.value - data[b + F_DELAY];
    if (el <= 0) {
      // まだ湧いていない粒はスケール0で畳んでおく（描画されるが面積ゼロ）
      val.set(0, 0, 0, 0);
      return;
    }
    const t = Math.min(1, el / data[b + F_DUR]);
    // 浮力で軽く加速しながら上昇（等速だと機械的に見える）
    const te = t * (0.72 + 0.28 * t);
    const y = data[b + F_Y0] - data[b + F_RISE] * te;

    // 1/f ゆらぎ: 振幅 1 : 0.5 の2オクターブを非整数倍(2.63)で重ね、
    // 周期の繰り返しを感じさせない自然な蛇行にする。
    const w0 = data[b + F_WFREQ];
    const ph = data[b + F_PHASE];
    const wob =
      (Math.sin(te * w0 + ph) + 0.5 * Math.sin(te * w0 * 2.63 + ph * 1.7)) / 1.5;
    const x = data[b + F_X0] + wob * data[b + F_WAMP];

    // 終盤はしぼみながら消える（泡が散る感じ）
    const fadeOut = t > 0.75 ? Math.max(0, (1 - t) / 0.25) : 1;
    const dia = data[b + F_DIA] * (0.6 + 0.4 * fadeOut);
    const s = dia / TILE;
    // RSXform は「スプライト左上(0,0)」基準なので、中心を (x,y) に置くには半径ぶん戻す
    val.set(s, 0, x - dia / 2, y - dia / 2);
  });

  // 色と不透明度。colorBlendMode="modulate"（r = s*d）でスプライト（白）に
  // 乗算されるため、RGB=着色 / A=その粒の不透明度 になる。
  const colors = useColorBuffer(PARTICLE_COUNT, (val, i) => {
    'worklet';
    const b = i * STRIDE;
    const ci = data[b + F_CIDX];
    val[0] = PALETTE[ci];
    val[1] = PALETTE[ci + 1];
    val[2] = PALETTE[ci + 2];

    const el = clock.value - data[b + F_DELAY];
    if (el <= 0) {
      val[3] = 0;
      return;
    }
    const t = Math.min(1, el / data[b + F_DUR]);
    const fadeIn = Math.min(1, t / 0.12);
    const fadeOut = Math.min(1, (1 - t) / 0.25);
    const flicker =
      0.78 + 0.22 * Math.sin((clock.value / 1000) * data[b + F_FLICK] + data[b + F_PHASE]);
    val[3] = fadeIn * fadeOut * flicker;
  });

  // 全体の立ち上がり／消滅。個々の粒は自前のフェード曲線を持つので、
  // ここは「噴き出し〜静まる」の大きな包絡線だけを司る。
  const groupOpacity = useDerivedValue(() => master.value);

  useEffect(() => {
    master.value = withSequence(
      withTiming(1, { duration: 400, easing: Easing.out(Easing.quad) }),
      withDelay(
        900,
        withTiming(0, { duration: 700, easing: Easing.in(Easing.quad) }, (finished) => {
          'worklet';
          if (finished && onDone) runOnJS(onDone)();
        }),
      ),
    );
  }, [master, onDone]);

  if (!sprite) return null;

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      {/* screen 合成で、粒同士が重なったところが明るく抜ける＝光の粒らしくなる */}
      <Group layer={<Paint blendMode="screen" />} opacity={groupOpacity}>
        <Atlas
          image={sprite}
          sprites={sprites}
          transforms={transforms}
          colors={colors}
          colorBlendMode="modulate"
        />
      </Group>
    </Canvas>
  );
};

export default PurchaseParticles;
