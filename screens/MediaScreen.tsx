/**
 * MediaScreen.tsx — メディア（記事 / SNS）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 03 / メディア 記事:
 *   ・上部に SNS アイコン常設（Instagram / note / 他）
 *   ・下に記事一覧（新しいものが上）
 *   ・記事＝件名＋中身（ブログURL/YouTube/テキスト/画像を任意入力、入れた要素だけ表示）
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Linking,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { useTopInset } from '../lib/safeArea';
import { NUM_FONT } from '../constants/fonts';
import { InstagramIcon } from '../components/icons';

type Sns = {
  key: string;
  label: string;
  url: string;
  icon?: ImageSourcePropType;
  /** ベクターアイコン（指定時は icon より優先。X はこちらでバッジを描く） */
  IconComponent?: React.FC<{ size?: number }>;
  /** ボタン背景色の上書き（既定は薄い紺の丸枠）。黒地アイコンは枠色との
   * コントラストで縁が白っぽく見えるため、Xだけ枠ごと黒で塗りつぶす。 */
  badgeBg?: string;
  badgeBorder?: string;
};
type Article = {
  id: string;
  title: string;
  date: string;
  body?: string;         // テキスト（任意）
  thumbnailUrl?: string; // 埋め込みサムネ（任意・YouTube/画像）
  linkUrl?: string;      // ブログURL/YouTube（任意）
};

type Props = {
  sns?: Sns[];
  articles?: Article[];
  /** 「もっと見る」押下時に次の10件を取得する（未指定ならボタンは出さない） */
  onLoadMoreArticles?: () => void;
  /** まだ取得していない記事が残っているか（true のときだけ「もっと見る」を出す） */
  hasMoreArticles?: boolean;
  /** 次ページ取得中かどうか（ボタンをローディング表示にする） */
  loadingMoreArticles?: boolean;
};

const DEFAULT_SNS: Sns[] = [
  {
    // 非公式画像(instagram.png)ではなく、正規のInstagramロゴ形状を再現した
    // ベクターアイコンを使用。
    key: 'instagram', label: 'Instagram', url: 'https://instagram.com',
    IconComponent: InstagramIcon,
  },
  {
    key: 'note', label: 'note', url: 'https://note.com',
    icon: require('../components/note.png'),
  },
  {
    // X（旧Twitter）は自前SVGバッジではなく、正規画像(components/twitterx.jpg)を使用。
    // アイコン自体が黒地のため、ボタンの丸枠も黒で塗って縁に隙間が
    // 見えないようにする（薄紺の共通枠のままだと縁が白っぽく浮いて見えた）。
    key: 'x', label: 'X', url: 'https://x.com',
    icon: require('../components/twitterx.jpg'),
    badgeBg: '#000000',
    badgeBorder: '#000000',
  },
];

const STUB_ARTICLES: Article[] = [
  {
    id: 'a1',
    title: '今回のテーマは…',
    date: '2026.06.21',
    thumbnailUrl: 'https://picsum.photos/seed/article1/800/450',
    linkUrl: 'https://example.com/article1',
    body: '新シリーズの背景と、調律に込めた意図について。',
  },
  {
    id: 'a2',
    title: '皆様へメッセージ',
    date: '2026.06.07',
    body: 'いつも聴いていただきありがとうございます。',
  },
];

export const MediaScreen: React.FC<Props> = ({
  sns = DEFAULT_SNS,
  articles = STUB_ARTICLES,
  onLoadMoreArticles,
  hasMoreArticles = false,
  loadingMoreArticles = false,
}) => {
  const barTop = useTopInset(12); // 従来 56px（=44+12）
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* SNS 常設 */}
      <View style={[styles.snsBar, { paddingTop: barTop }]}>
        {sns.map((s) => (
          <Pressable
            key={s.key}
            style={[
              styles.snsBtn,
              s.badgeBg != null && { backgroundColor: s.badgeBg },
              s.badgeBorder != null && { borderColor: s.badgeBorder },
            ]}
            onPress={() => Linking.openURL(s.url).catch(() => {})}
            accessibilityLabel={s.label}
          >
            {s.IconComponent ? (
              <s.IconComponent size={26} />
            ) : s.icon ? (
              <Image source={s.icon} style={styles.snsIcon} resizeMode="contain" />
            ) : (
              <Text style={styles.snsLabel}>{s.label}</Text>
            )}
          </Pressable>
        ))}
      </View>

      {/* 記事一覧（新しいものが上） */}
      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {articles.map((a) => (
          <Pressable
            key={a.id}
            style={styles.article}
            onPress={() => a.linkUrl && Linking.openURL(a.linkUrl).catch(() => {})}
          >
            <Text style={styles.articleDate}>{a.date}</Text>
            <Text style={styles.articleTitle}>件名：{a.title}</Text>
            {/* 入れた要素だけ表示 */}
            {a.thumbnailUrl && (
              <Image source={{ uri: a.thumbnailUrl }} style={styles.thumb} resizeMode="cover" />
            )}
            {a.body && <Text style={styles.articleBody}>{a.body}</Text>}
          </Pressable>
        ))}
        {hasMoreArticles && (
          <Pressable
            style={({ pressed }) => [styles.moreBtn, pressed && { opacity: 0.7 }]}
            onPress={onLoadMoreArticles}
            disabled={loadingMoreArticles}
          >
            <Text style={styles.moreLabel}>{loadingMoreArticles ? '読み込み中…' : 'もっと見る'}</Text>
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  snsBar: {
    // 既定値。実機では SafeArea の top を加味して JSX 側で上書き
    paddingTop: 56,
    paddingBottom: SPACE.md,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACE.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  snsBtn: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  snsLabel: { color: COLOR.textSecondary, fontSize: 9 },
  // 丸いのはボタンの枠のみ。アイコン自体は正方形ロゴ（note等）も含め
  // クロップせず contain で収める（枠の内側に少し余白を持たせるサイズ）
  snsIcon: { width: 26, height: 26 },
  list: { padding: SPACE.lg, gap: SPACE.lg, paddingBottom: 40 },
  article: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.22)',
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  // 日付＝数字表記
  articleDate: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5, fontFamily: NUM_FONT },
  articleTitle: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(58,61,114,0.25)',
    marginTop: 4,
  },
  articleBody: { color: COLOR.textSecondary, fontSize: 13, lineHeight: 20 },
  moreBtn: {
    alignSelf: 'center',
    paddingVertical: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.30)',
  },
  moreLabel: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 0.5 },
});

export default MediaScreen;
