/**
 * LaunchFlow.tsx — 起動〜入口の統合フロー（fr_launch_v5.html の忠実移植）
 * ------------------------------------------------------------------
 * 参照 HTML の 4 モード（new / exist / login / notice）を、実アプリでは
 * セッション・オンボ済み・規約同意状態から App.tsx が決定して渡す。
 *   ・launch : ワードマークのみ 1.2 秒
 *   ・p0     : オンボーディング横スワイプ 4 面（用途 / 所有 / 再現不能 / 入口）
 *   ・post   : 登録後 3 ステップ（表示名 → 情景 → 無料カード2枚付与）
 *   ・login  : 登録済・セッションなし（メール/パスワード＋Google/Apple）
 *   ・reset  : パスワード再設定（成否を明かさない文面）
 *   ・consent: 重要事項（同意型）。スキップ不可
 * 背景は天の川バンド（NebulaBand）。文言は参照 HTML を verbatim 踏襲。
 *
 * 認証: メールは lib/firebaseAuth.signIn、Apple は components/AppleButton、
 *   Google は下部のフック内蔵ボタン（未設定時はクラッシュ回避のため分離）。
 *   新規作成（new）はモック同様クレデンシャルを取らず post へ進み、社会連携
 *   （Google/Apple）が実アカウント作成を担う。
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Modal,
  Platform,
  useWindowDimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Defs, RadialGradient as SvgRadial, Stop, Rect } from 'react-native-svg';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

import { NebulaBand } from '../components/NebulaBand';
import { Wordmark } from '../components/Wordmark';
import { AppleButton } from '../components/AppleButton';
import { GoogleIcon } from '../components/icons';
import { COLOR } from '../constants/design-tokens';
import {
  GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID,
  isGoogleConfigured,
  APPLE_SIGNIN_ENABLED,
} from '../constants/authConfig';
import { signIn, signInWithGoogleToken } from '../lib/firebaseAuth';

WebBrowser.maybeCompleteAuthSession();

const MINCHO = Platform.select({ ios: 'Hiragino Mincho ProN', default: 'serif' });
const C = {
  text: '#ECEEF7',
  sub: '#9498BE',
  dim: 'rgba(148,152,190,0.62)',
  cyan: '#60CEE0',
  fuji: '#C9A8D8', // エラー（藤色）
} as const;

// ── 情景ウォッシュ（sc1/sc2/sc3 のラジアル）: 2.6秒ごとに crossfade ──
const SCENES = [
  [
    { cx: '26%', cy: '30%', rx: '58%', ry: '34%', color: 'rgba(96,206,224,0.16)' },
    { cx: '78%', cy: '22%', rx: '70%', ry: '44%', color: 'rgba(124,98,214,0.20)' },
  ],
  [
    { cx: '74%', cy: '34%', rx: '52%', ry: '30%', color: 'rgba(70,132,224,0.20)' },
    { cx: '22%', cy: '24%', rx: '64%', ry: '40%', color: 'rgba(96,206,224,0.12)' },
  ],
  [
    { cx: '50%', cy: '26%', rx: '66%', ry: '38%', color: 'rgba(124,98,214,0.17)' },
    { cx: '30%', cy: '40%', rx: '44%', ry: '26%', color: 'rgba(96,206,224,0.13)' },
  ],
] as const;

const SceneWash: React.FC<{ index: number }> = ({ index }) => (
  <View style={StyleSheet.absoluteFill} pointerEvents="none">
    {SCENES.map((scene, i) => (
      <SceneLayer key={i} scene={scene} active={i === index} />
    ))}
  </View>
);

const SceneLayer: React.FC<{ scene: readonly { cx: string; cy: string; rx: string; ry: string; color: string }[]; active: boolean }> = ({
  scene,
  active,
}) => {
  const op = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    op.value = withTiming(active ? 1 : 0, { duration: 1600, easing: Easing.inOut(Easing.ease) });
  }, [active, op]);
  const style = useAnimatedStyle(() => ({ opacity: op.value }));
  const uid = useRef(Math.floor(Math.random() * 1e6)).current;
  return (
    <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          {scene.map((sc, i) => (
            <SvgRadial key={i} id={`sr${uid}-${i}`} cx={sc.cx} cy={sc.cy} rx={sc.rx} ry={sc.ry}>
              <Stop offset="0" stopColor={sc.color} />
              <Stop offset="0.7" stopColor={sc.color} stopOpacity={0} />
            </SvgRadial>
          ))}
        </Defs>
        {scene.map((_, i) => (
          <Rect key={i} x="0" y="0" width="100%" height="100%" fill={`url(#sr${uid}-${i})`} />
        ))}
      </Svg>
    </Animated.View>
  );
};

// ── 作品カード プレースホルダ（.fcard .art）──
const PlaceholderArt: React.FC<{ w: number }> = ({ w }) => {
  const h = w * 1.5;
  const r = w * 0.085;
  return (
    <View style={{ width: w, height: h, borderRadius: r, overflow: 'hidden', ...cardShadow }}>
      <Svg width={w} height={h}>
        <Defs>
          <SvgRadial id="a1" cx="34%" cy="28%" r="62%">
            <Stop offset="0" stopColor="rgba(140,190,255,0.42)" />
            <Stop offset="0.68" stopColor="rgba(140,190,255,0)" />
          </SvgRadial>
          <SvgRadial id="a2" cx="72%" cy="62%" r="70%">
            <Stop offset="0" stopColor="rgba(124,98,214,0.46)" />
            <Stop offset="0.72" stopColor="rgba(124,98,214,0)" />
          </SvgRadial>
        </Defs>
        <Rect x="0" y="0" width={w} height={h} fill="#141534" />
        <Rect x="0" y="0" width={w} height={h} fill="url(#a1)" />
        <Rect x="0" y="0" width={w} height={h} fill="url(#a2)" />
      </Svg>
    </View>
  );
};

// 2枚目の確定カード面（単色＋ロゴ＋調律）
const FlatArtCard: React.FC<{ w: number }> = ({ w }) => {
  const h = w * 1.5;
  const r = w * 0.085;
  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: r,
        overflow: 'hidden',
        backgroundColor: '#171B3C',
        alignItems: 'center',
        justifyContent: 'center',
        ...cardShadow,
      }}
    >
      <Wordmark width={w * 0.55} color="#ECEEF7" opacity={0.92} />
      <View style={{ width: 30, height: 1, marginVertical: 17, backgroundColor: 'rgba(96,206,224,0.6)' }} />
      <Text style={{ fontSize: 9, letterSpacing: 3, color: 'rgba(236,238,247,0.42)', marginBottom: 7 }}>調律</Text>
      <Text style={{ fontSize: 13.5, letterSpacing: 2, color: '#60CEE0' }}>432Hz</Text>
    </View>
  );
};

const cardShadow = {
  shadowColor: '#000',
  shadowOpacity: 0.5,
  shadowRadius: 22,
  shadowOffset: { width: 0, height: 18 },
  elevation: 12,
};

// ── Google ボタン（フック内蔵・未設定時のクラッシュ回避のため分離）──
const GoogleAuthButton: React.FC<{
  label: string;
  busy: boolean;
  onBusy: (b: boolean) => void;
  onError: (m: string | null) => void;
  onAuthenticated: () => void;
}> = ({ label, busy, onBusy, onError, onAuthenticated }) => {
  const [, response, promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID || undefined,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID || undefined,
  });
  useEffect(() => {
    if (response?.type === 'success') {
      const idToken = response.params?.id_token;
      if (idToken) {
        onBusy(true);
        signInWithGoogleToken(idToken)
          .then(onAuthenticated)
          .catch((e) => onError(e?.message ?? 'Google サインインに失敗しました'))
          .finally(() => onBusy(false));
      }
    } else if (response?.type === 'error') {
      onError('Google サインインに失敗しました');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);
  return (
    <Pressable
      style={({ pressed }) => [s.btn, pressed && s.btnPressed]}
      onPress={() => {
        onError(null);
        promptAsync();
      }}
      disabled={busy}
    >
      <GoogleIcon size={15} />
      <Text style={s.btnLabel}>{label}</Text>
    </Pressable>
  );
};

// 社会連携ボタン群（Google / Apple）を共通描画
const SocialButtons: React.FC<{
  googleLabel: string;
  busy: boolean;
  setBusy: (b: boolean) => void;
  setError: (m: string | null) => void;
  onAuthenticated: () => void;
}> = ({ googleLabel, busy, setBusy, setError, onAuthenticated }) => (
  <>
    {isGoogleConfigured ? (
      <GoogleAuthButton
        label={googleLabel}
        busy={busy}
        onBusy={setBusy}
        onError={setError}
        onAuthenticated={onAuthenticated}
      />
    ) : (
      <Pressable
        style={[s.btn, { opacity: 0.5 }]}
        onPress={() => setError('Google クライアントIDが未設定です（app.json の extra.googleAuth）')}
      >
        <GoogleIcon size={15} />
        <Text style={s.btnLabel}>{googleLabel}</Text>
      </Pressable>
    )}
    {APPLE_SIGNIN_ENABLED && (
      <AppleButton busy={busy} onBusy={setBusy} onError={setError} onAuthenticated={onAuthenticated} />
    )}
  </>
);

// ══════════════════════════════════════════════════════════════
// 本体
// ══════════════════════════════════════════════════════════════

// 'app' = セッション有効 → launch 後そのままアプリへ（exist モード）
export type LaunchScreen = 'p0' | 'login' | 'consent' | 'app';
export type ConsentJoin = 'new' | 'login' | 'exist';

type Props = {
  /** launch 後に最初に見せる画面（App がセッション状態から決定） */
  initialScreen: LaunchScreen;
  /** consent で同意したあとの合流先 */
  consentJoin?: ConsentJoin;
  /** セッション有効／認証完了 → アプリへ */
  onEnterApp: () => void;
  /** 新規オンボーディング完了（表示名・情景）→ アプリへ */
  onCompleteSignup: (info: { name: string; scene: string }) => void;
  /** 規約に同意した（同意バージョンを保存） */
  onAgreeConsent: () => void;
};

type Screen = 'launch' | 'p0' | 'post' | 'login' | 'consent';

export const LaunchFlow: React.FC<Props> = ({
  initialScreen,
  consentJoin = 'new',
  onEnterApp,
  onCompleteSignup,
  onAgreeConsent,
}) => {
  const [screen, setScreen] = useState<Screen>('launch');

  // ── launch: 1.2秒のフェード後、initialScreen へ ──
  const launchOp = useSharedValue(0);
  useEffect(() => {
    // 0→38%:fade in / 保持 / 100%:fade out（体感1.2秒）
    launchOp.value = withTiming(1, { duration: 460, easing: Easing.out(Easing.ease) });
    launchOp.value = withDelay(
      790,
      withTiming(0, { duration: 410, easing: Easing.in(Easing.ease) }, (fin) => {
        'worklet';
        if (!fin) return;
        // exist（セッション有効）は launch 後そのままアプリへ
        if (initialScreen === 'app') runOnJS(onEnterApp)();
        else runOnJS(setScreen)(initialScreen);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const launchStyle = useAnimatedStyle(() => ({ opacity: launchOp.value }));

  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />
      <NebulaBand />

      {screen === 'launch' && (
        <View style={s.center} pointerEvents="none">
          <Animated.View style={launchStyle}>
            <Wordmark width={210} color={C.text} />
          </Animated.View>
        </View>
      )}

      {screen === 'p0' && (
        <P0
          onSignup={() => setScreen('post')}
          onEnterApp={onEnterApp}
          onToLogin={() => setScreen('login')}
        />
      )}

      {screen === 'post' && (
        <PostSteps onDone={(info) => onCompleteSignup(info)} />
      )}

      {screen === 'login' && (
        <LoginScreen
          onEnterApp={onEnterApp}
          onToSignup={() => setScreen('p0')}
        />
      )}

      {screen === 'consent' && (
        <ConsentScreen
          onAgree={() => {
            onAgreeConsent();
            if (consentJoin === 'new') setScreen('p0');
            else if (consentJoin === 'login') setScreen('login');
            else onEnterApp();
          }}
        />
      )}
    </View>
  );
};

// ══════════════ P0 オンボーディング ══════════════
const P0: React.FC<{ onSignup: () => void; onEnterApp: () => void; onToLogin: () => void }> = ({
  onSignup,
  onEnterApp,
  onToLogin,
}) => {
  const { width } = useWindowDimensions();
  const [pane, setPane] = useState(0);
  const [scene, setScene] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 情景は 1枚目のあいだ 2.6秒ごとに切替
  useEffect(() => {
    const id = setInterval(() => setScene((v) => (v + 1) % 3), 2600);
    return () => clearInterval(id);
  }, []);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== pane) setPane(i);
  };

  const cardW = Math.min(188, width * 0.5);

  return (
    <View style={StyleSheet.absoluteFill}>
      {/* 情景ウォッシュ（1枚目で見える） */}
      <SceneWash index={scene} />

      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
      >
        {/* 1枚目｜用途 */}
        <View style={[s.pane, { width }]}>
          <View style={s.paneBody}>
            <Text style={s.copy}>世界は、すこし騒がしい。{'\n'}だから、持ち歩ける静けさをつくりました。</Text>
            <View style={{ marginTop: 26 }}>
              <Wordmark width={112} color={C.text} opacity={0.9} />
            </View>
          </View>
        </View>

        {/* 2枚目｜所有 */}
        <View style={[s.pane, { width }]}>
          <View style={s.stageArea}>
            <FlatArtCard w={cardW} />
          </View>
          <View style={s.paneBody}>
            <Text style={s.copy}>
              一枚ずつ、手作業で周波数を調律した作品を、カードとして所有します。
              <Text style={s.copySm}>{'\n'}（聴き放題サービスではありません。）</Text>
            </Text>
          </View>
        </View>

        {/* 3枚目｜再現不能 */}
        <View style={[s.pane, { width }]}>
          <View style={s.trio}>
            <View style={[s.trioCard, { opacity: 0.3, transform: [{ translateY: 10 }, { scale: 0.92 }, { rotate: '-5deg' }] }]}>
              <PlaceholderArt w={104} />
            </View>
            <View style={[s.trioCard, { zIndex: 3, transform: [{ translateY: -8 }, { scale: 1.04 }] }]}>
              <PlaceholderArt w={104} />
            </View>
            <View style={[s.trioCard, { opacity: 0.3, transform: [{ translateY: 10 }, { scale: 0.92 }, { rotate: '5deg' }] }]}>
              <PlaceholderArt w={104} />
            </View>
          </View>
          <View style={s.paneBody}>
            <Text style={s.copy}>どのカードと出会うかは、{'\n'}その日、そのときの、めぐり合わせ。{'\n'}一期一会を、お楽しみください。</Text>
            <View style={{ marginTop: 26, alignSelf: 'flex-end' }}>
              <Wordmark width={112} color={C.text} opacity={0.9} />
            </View>
          </View>
        </View>

        {/* 4枚目｜入口 */}
        <View style={[s.pane, { width }]}>
          <View style={s.entry}>
            <Text style={s.entryLead}>はじめましょう。</Text>
            <Pressable
              style={({ pressed }) => [s.btn, s.btnPri, pressed && s.btnPressed]}
              onPress={onSignup}
            >
              <Text style={s.btnLabel}>新規作成</Text>
            </Pressable>
            <SocialButtons
              googleLabel="Google でログイン"
              busy={busy}
              setBusy={setBusy}
              setError={setError}
              onAuthenticated={onEnterApp}
            />
            {error && <Text style={s.errText}>{error}</Text>}
            <Text style={s.agree}>
              続けることで、<Text style={s.agreeLink}>利用規約</Text>および
              <Text style={s.agreeLink}>プライバシーポリシー</Text>に同意したものとみなされます。
            </Text>
            <Pressable onPress={onToLogin} hitSlop={8} style={{ marginTop: 8, alignSelf: 'center' }}>
              <Text style={s.toLoginLink}>アカウントをお持ちの方はログイン</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* ドット */}
      <View style={s.dots} pointerEvents="none">
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={[s.dot, i === pane && s.dotOn]} />
        ))}
      </View>
    </View>
  );
};

// ══════════════ 登録後ステップ ══════════════
const PostSteps: React.FC<{ onDone: (info: { name: string; scene: string }) => void }> = ({ onDone }) => {
  const [step, setStep] = useState<'name' | 'scene' | 'gift'>('name');
  const [name, setName] = useState('');
  const [scene, setScene] = useState('');

  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = 0;
    fade.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.ease) });
  }, [step, fade]);
  const fadeStyle = useAnimatedStyle(() => ({ opacity: fade.value }));

  // ギフトの演出
  const breath = useSharedValue(0);
  useEffect(() => {
    if (step !== 'gift') return;
    breath.value = 0;
    breath.value = withDelay(500, withTiming(1, { duration: 1900, easing: Easing.inOut(Easing.ease) }));
  }, [step, breath]);

  const SCENE_OPTS = [
    { key: 'train', label: '電車の中' },
    { key: 'office', label: 'オフィスの片隅' },
    { key: 'family', label: '家族の気配' },
    { key: 'other', label: 'その他' },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, s.postRoot, fadeStyle]}>
      {step === 'name' && (
        <>
          <View style={s.stepHead}>
            <Text style={s.stepH2}>作品に表示される{'\n'}お名前を決めてください。</Text>
            <Text style={s.stepSub}>コレクションとカードの裏面に表示されます。{'\n'}あとから変更できます。</Text>
          </View>
          <View style={s.stepFoot}>
            <TextInput
              style={s.nameInput}
              placeholder="例：ナオキ"
              placeholderTextColor={C.sub}
              value={name}
              onChangeText={setName}
              maxLength={20}
            />
            <Pressable style={({ pressed }) => [s.btn, s.btnPri, pressed && s.btnPressed]} onPress={() => setStep('scene')}>
              <Text style={s.btnLabel}>決定</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [s.btn, s.btnGhost, { marginTop: 10 }, pressed && s.btnPressed]}
              onPress={() => {
                setName('');
                setStep('scene');
              }}
            >
              <Text style={s.btnGhostLabel}>あとで</Text>
            </Pressable>
          </View>
        </>
      )}

      {step === 'scene' && (
        <>
          <View style={s.stepHead}>
            <Text style={s.stepH2}>いま、あなたに近い情景は{'\n'}どれですか。</Text>
            <Text style={s.stepSub}>最初にお見せする作品を選ぶために使います。{'\n'}あとから変わってもかまいません。</Text>
          </View>
          <View style={s.stepFoot}>
            <View style={{ gap: 10 }}>
              {SCENE_OPTS.map((o) => (
                <Pressable
                  key={o.key}
                  style={({ pressed }) => [s.opt, scene === o.key && s.optOn, pressed && s.btnPressed]}
                  onPress={() => {
                    setScene(o.key);
                    setTimeout(() => setStep('gift'), 380);
                  }}
                >
                  <Text style={s.optLabel}>{o.label}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </>
      )}

      {step === 'gift' && (
        <View style={s.giftWrap}>
          <View style={s.giftCards}>
            <PlaceholderArt w={112} />
            <PlaceholderArt w={112} />
          </View>
          <Text style={s.giftText}>2枚の作品を、{'\n'}コレクションにお納めしました。</Text>
          <Pressable
            style={({ pressed }) => [s.btn, s.btnPri, { width: 196, marginTop: 36 }, pressed && s.btnPressed]}
            onPress={() => onDone({ name, scene })}
          >
            <Text style={s.btnLabel}>はじめる</Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
};

// ══════════════ ログイン ══════════════
const LoginScreen: React.FC<{ onEnterApp: () => void; onToSignup: () => void }> = ({ onEnterApp, onToSignup }) => {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errField, setErrField] = useState<'mail' | 'pw' | 'both' | null>(null);
  const [resetOpen, setResetOpen] = useState(false);

  const clearErr = () => {
    setError(null);
    setErrField(null);
  };

  const submit = async () => {
    const m = email.trim();
    if (!m || !pw) {
      setError('メールアドレスとパスワードをご入力ください。');
      setErrField('both');
      return;
    }
    if (m.indexOf('@') < 0) {
      setError('メールアドレスの形式をご確認ください。');
      setErrField('mail');
      return;
    }
    setBusy(true);
    clearErr();
    try {
      await signIn(m, pw);
      onEnterApp();
    } catch {
      setError('メールアドレスまたはパスワードが一致しません。');
      setErrField('both');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={s.loginBody} showsVerticalScrollIndicator={false}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 34 }}>
        <Wordmark width={132} color={C.text} opacity={0.88} />
      </View>

      <View style={s.field}>
        <Text style={s.fieldLabel}>メールアドレス</Text>
        <TextInput
          style={[s.input, (errField === 'mail' || errField === 'both') && s.inputErr]}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          value={email}
          onChangeText={(v) => {
            setEmail(v);
            clearErr();
          }}
        />
      </View>
      <View style={s.field}>
        <Text style={s.fieldLabel}>パスワード</Text>
        <TextInput
          style={[s.input, (errField === 'pw' || errField === 'both') && s.inputErr]}
          secureTextEntry
          value={pw}
          onChangeText={(v) => {
            setPw(v);
            clearErr();
          }}
        />
      </View>

      <Pressable onPress={() => setResetOpen(true)} hitSlop={8} style={s.forgot}>
        <Text style={s.forgotText}>パスワードをお忘れの方</Text>
      </Pressable>

      {error && <Text style={s.loginErr}>{error}</Text>}

      <Pressable style={({ pressed }) => [s.btn, s.btnPri, (pressed || busy) && s.btnPressed]} onPress={submit} disabled={busy}>
        <Text style={s.btnLabel}>{busy ? '処理中…' : 'ログイン'}</Text>
      </Pressable>

      <View style={s.orline}>
        <View style={s.orRule} />
        <Text style={s.orText}>または</Text>
        <View style={s.orRule} />
      </View>

      <SocialButtons
        googleLabel="Google でログイン"
        busy={busy}
        setBusy={setBusy}
        setError={setError}
        onAuthenticated={onEnterApp}
      />

      <Text style={s.tosignup}>
        アカウントをお持ちでない方は{'\n'}
        <Text style={s.tosignupLink} onPress={onToSignup}>
          新規登録
        </Text>
      </Text>

      {/* パスワード再設定 */}
      <ResetModal visible={resetOpen} initialMail={email} onClose={() => setResetOpen(false)} />
    </ScrollView>
  );
};

const ResetModal: React.FC<{ visible: boolean; initialMail: string; onClose: () => void }> = ({
  visible,
  initialMail,
  onClose,
}) => {
  const [mail, setMail] = useState(initialMail);
  const [done, setDone] = useState(false);
  useEffect(() => {
    if (visible) {
      setMail(initialMail);
      setDone(false);
    }
  }, [visible, initialMail]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.resetScrim}>
        <View style={s.resetWrap}>
          <Text style={s.resetH2}>パスワードを再設定します。</Text>
          <Text style={s.resetSub}>ご登録のメールアドレスあてに、{'\n'}再設定のご案内をお送りします。</Text>
          {done && <Text style={s.resetDone}>ご案内をお送りしました。{'\n'}メールをご確認ください。</Text>}
          <TextInput
            style={s.nameInput}
            placeholder="メールアドレス"
            placeholderTextColor={C.sub}
            keyboardType="email-address"
            autoCapitalize="none"
            value={mail}
            onChangeText={setMail}
          />
          <Pressable style={({ pressed }) => [s.btn, s.btnPri, pressed && s.btnPressed]} onPress={() => setDone(true)}>
            <Text style={s.btnLabel}>送信する</Text>
          </Pressable>
          <Pressable style={({ pressed }) => [s.btn, s.btnGhost, { marginTop: 10 }, pressed && s.btnPressed]} onPress={onClose}>
            <Text style={s.btnGhostLabel}>戻る</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
};

// ══════════════ 重要事項（同意型）══════════════
const ConsentScreen: React.FC<{ onAgree: () => void }> = ({ onAgree }) => {
  const [declined, setDeclined] = useState(false);
  return (
    <View style={s.consentWrap}>
      <View style={{ marginBottom: 34, opacity: 0.5 }}>
        <Wordmark width={104} color={C.text} />
      </View>
      <Text style={s.consentH2}>利用規約とプライバシーポリシーを{'\n'}改定しました。</Text>
      <Text style={s.consentSub}>2026年8月1日 施行／改定の要点は次のとおりです。</Text>

      <ScrollView style={s.consentBody} showsVerticalScrollIndicator={false}>
        <Text style={s.consentH3}>改定の要点</Text>
        <Text style={s.consentP}>
          再生に関する記録（どの作品を、いつ、どれだけ再生したか）を取得することを明記しました。取得した記録は、次回以降にお見せする作品の選定と、サービスの品質改善にのみ使用します。
        </Text>
        <Text style={s.consentP}>表示名および登録時にお選びいただいた情景を、アカウントに紐づけて保存することを明記しました。</Text>
        <Text style={s.consentH3}>使用しないこと</Text>
        <Text style={s.consentP}>取得した記録を、広告の配信および第三者への提供には使用しません。</Text>
        <Text style={s.consentH3}>全文</Text>
        <Text style={s.consentP}>
          <Text style={s.consentLink}>利用規約（全文）</Text>　／　<Text style={s.consentLink}>プライバシーポリシー（全文）</Text>
        </Text>
      </ScrollView>

      <View style={s.consentAct}>
        <Pressable style={({ pressed }) => [s.btn, s.btnPri, pressed && s.btnPressed]} onPress={onAgree}>
          <Text style={s.btnLabel}>同意して続ける</Text>
        </Pressable>
        <Pressable style={({ pressed }) => [s.btn, s.btnGhost, pressed && s.btnPressed]} onPress={() => setDeclined(true)}>
          <Text style={s.btnGhostLabel}>同意しない</Text>
        </Pressable>
        <Text style={s.consentNote}>同意いただけない場合、アプリをご利用いただけません。{'\n'}購入済みの作品は、再同意後に復元できます。</Text>
        {declined && (
          <Text style={s.declined}>同意されるまで、この先へは進めません。{'\n'}ご質問は サポート までお寄せください。</Text>
        )}
      </View>
    </View>
  );
};

// ══════════════ スタイル ══════════════
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },

  // ボタン共通
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.28)',
    backgroundColor: 'rgba(96,206,224,0.08)',
  },
  btnPressed: { opacity: 0.82 },
  btnPri: { borderColor: C.cyan, backgroundColor: 'rgba(96,206,224,0.16)' },
  btnGhost: { borderColor: 'rgba(150,165,210,0.20)', backgroundColor: 'transparent' },
  btnLabel: { color: C.text, fontSize: 13, letterSpacing: 1.3, fontFamily: MINCHO },
  btnGhostLabel: { color: C.sub, fontSize: 13, letterSpacing: 1.3, fontFamily: MINCHO },

  // P0
  pane: { flex: 1, paddingHorizontal: 30, justifyContent: 'flex-end' },
  paneBody: { marginBottom: 118 },
  copy: { fontSize: 16.5, lineHeight: 37, letterSpacing: 1.4, color: C.text },
  copySm: { fontSize: 12, color: C.sub, letterSpacing: 0.7, lineHeight: 24 },
  stageArea: { position: 'absolute', left: 0, right: 0, top: 96, alignItems: 'center' },
  trio: { position: 'absolute', left: 0, right: 0, top: 120, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  trioCard: { marginHorizontal: -12 },
  entry: { marginBottom: 96, gap: 11 },
  entryLead: { fontSize: 12.5, color: C.sub, letterSpacing: 1, lineHeight: 24, marginBottom: 14, textAlign: 'center' },
  agree: { fontSize: 10.5, color: C.dim, lineHeight: 20, letterSpacing: 0.3, textAlign: 'center', marginTop: 6 },
  agreeLink: { color: C.sub, textDecorationLine: 'underline' },
  toLoginLink: { color: C.cyan, fontSize: 12, letterSpacing: 1, fontFamily: MINCHO },
  errText: { color: C.fuji, fontSize: 11.5, textAlign: 'center', lineHeight: 18 },
  dots: { position: 'absolute', left: 0, right: 0, bottom: 38, flexDirection: 'row', justifyContent: 'center', gap: 9 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(148,152,190,0.34)' },
  dotOn: { backgroundColor: C.cyan },

  // 登録後
  postRoot: { paddingHorizontal: 30, justifyContent: 'center' },
  stepHead: { marginBottom: 26 },
  stepH2: { fontSize: 16, letterSpacing: 1.4, lineHeight: 32, color: C.text, fontFamily: MINCHO },
  stepSub: { fontSize: 11.5, color: C.sub, letterSpacing: 0.7, lineHeight: 23, marginTop: 10 },
  stepFoot: { paddingTop: 24 },
  nameInput: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.22)',
    color: C.text,
    paddingHorizontal: 15,
    fontSize: 14,
    letterSpacing: 1.4,
    fontFamily: MINCHO,
    marginBottom: 14,
  },
  opt: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(150,165,210,0.20)',
    backgroundColor: 'rgba(255,255,255,0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optOn: { borderColor: C.cyan, backgroundColor: 'rgba(96,206,224,0.13)' },
  optLabel: { color: C.text, fontSize: 13, letterSpacing: 1.3, fontFamily: MINCHO },
  giftWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  giftCards: { flexDirection: 'row', gap: 14, marginBottom: 38 },
  giftText: { textAlign: 'center', fontSize: 14.5, lineHeight: 32, letterSpacing: 1.3, color: C.text, fontFamily: MINCHO },

  // ログイン
  loginBody: { paddingHorizontal: 30, paddingBottom: 40, flexGrow: 1 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 10, letterSpacing: 2.2, color: C.sub, marginBottom: 7 },
  input: {
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(96,206,224,0.22)',
    color: C.text,
    paddingHorizontal: 15,
    fontSize: 14,
    letterSpacing: 0.8,
    fontFamily: MINCHO,
  },
  inputErr: { borderColor: C.fuji },
  forgot: { alignSelf: 'flex-end', marginTop: 2, marginBottom: 14 },
  forgotText: { fontSize: 11, letterSpacing: 0.5, color: C.sub, fontFamily: MINCHO },
  loginErr: { fontSize: 11.5, lineHeight: 18, color: C.fuji, letterSpacing: 0.5, marginBottom: 13 },
  orline: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 19, marginBottom: 13 },
  orRule: { flex: 1, height: 1, backgroundColor: 'rgba(150,165,210,0.16)' },
  orText: { color: C.dim, fontSize: 10, letterSpacing: 2 },
  tosignup: { marginTop: 28, textAlign: 'center', fontSize: 11.5, color: C.sub, letterSpacing: 0.5, lineHeight: 24 },
  tosignupLink: { color: C.cyan, fontSize: 12, letterSpacing: 1, fontFamily: MINCHO, textDecorationLine: 'underline' },

  // reset
  resetScrim: { flex: 1, backgroundColor: 'rgba(7,7,20,0.94)', justifyContent: 'center', paddingHorizontal: 30 },
  resetWrap: { width: '100%' },
  resetH2: { fontSize: 15.5, letterSpacing: 1.4, lineHeight: 31, color: C.text, marginBottom: 10, fontFamily: MINCHO },
  resetSub: { fontSize: 11.5, color: C.sub, letterSpacing: 0.7, lineHeight: 23, marginBottom: 22 },
  resetDone: { fontSize: 12.5, color: C.cyan, letterSpacing: 0.7, lineHeight: 23, marginBottom: 20 },

  // consent
  consentWrap: { flex: 1, paddingTop: 64, paddingHorizontal: 26, paddingBottom: 24 },
  consentH2: { fontSize: 17, letterSpacing: 1.5, lineHeight: 29, color: C.text, marginBottom: 8, fontFamily: MINCHO },
  consentSub: { fontSize: 11.5, color: C.sub, letterSpacing: 0.8, lineHeight: 22, marginBottom: 20 },
  consentBody: {
    flex: 1,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(96,206,224,0.14)',
    paddingVertical: 18,
    paddingHorizontal: 2,
  },
  consentH3: { fontSize: 10, letterSpacing: 2.8, color: C.sub, marginTop: 16, marginBottom: 7 },
  consentP: { fontSize: 12, lineHeight: 25, color: '#C7CBE6', letterSpacing: 0.6, marginBottom: 12 },
  consentLink: { color: C.cyan, textDecorationLine: 'underline' },
  consentAct: { paddingTop: 20, gap: 13 },
  consentNote: { fontSize: 10.5, color: C.dim, lineHeight: 19, letterSpacing: 0.4, textAlign: 'center' },
  declined: { fontSize: 11.5, lineHeight: 23, color: C.sub, letterSpacing: 0.5, textAlign: 'center', paddingTop: 14 },
});

export default LaunchFlow;
