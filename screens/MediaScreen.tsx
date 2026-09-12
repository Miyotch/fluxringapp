/**
 * MediaScreen.tsx — メディア（あなた宛 / メディア）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 03 / メディア 記事 + 通知一覧の統合:
 *   ・タブ切替（あなた宛 / メディア）。ホーム画面のベルはここに統合したため廃止。
 *   ・あなた宛: 通知一覧（旧 NotificationsScreen）。時系列降順・未読は赤い点のみ
 *   ・メディア: 上部に SNS アイコン常設（Instagram / note / 他）＋下に記事一覧
 *     （記事＝件名＋中身。ブログURL/YouTube/テキスト/画像を任意入力、入れた要素だけ表示）
 *   ・背景は設定配下（CREDITS等）と同じ CreditsBackdrop
 */

import React, { useState } from 'react';
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
  useWindowDimensions,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';
import { CR, CreditsBackdrop } from '../components/CreditsBackdrop';
import { useTopInset } from '../lib/safeArea';
import { NUM_FONT } from '../constants/fonts';
import { InstagramIcon } from '../components/icons';
import { NotificationsList, type Notice } from './NotificationsScreen';

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

type MediaTab = 'you' | 'media';

type Props = {
  sns?: Sns[];
  articles?: Article[];
  /** 「もっと見る」押下時に次の10件を取得する（未指定ならボタンは出さない） */
  onLoadMoreArticles?: () => void;
  /** まだ取得していない記事が残っているか（true のときだけ「もっと見る」を出す） */
  hasMoreArticles?: boolean;
  /** 次ページ取得中かどうか（ボタンをローディング表示にする） */
  loadingMoreArticles?: boolean;
  /** 「あなた宛」タブに出す通知一覧 */
  notices?: Notice[];
  /** 通知タップ→本文へ（未指定なら何もしない） */
  onOpenNotice?: (id: string) => void;
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
  notices = [],
  onOpenNotice,
}) => {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const barTop = useTopInset(12); // 従来 56px（=44+12）
  const [tab, setTab] = useState<MediaTab>('media');
  const hasUnread = notices.some((n) => n.unread);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={CR.deepest} />
      <CreditsBackdrop w={screenW} h={screenH} />

      {/* タブ（あなた宛 / メディア） */}
      <View style={[styles.tabBar, { paddingTop: barTop }]}>
        <Pressable style={styles.tab} onPress={() => setTab('you')}>
          <View style={styles.tabLabelRow}>
            <Text style={[styles.tabText, tab === 'you' && styles.tabTextOn]}>あなた宛</Text>
            {hasUnread && <View style={styles.tabDot} />}
          </View>
          {tab === 'you' && <View style={styles.tabUnderline} />}
        </Pressable>
        <Pressable style={styles.tab} onPress={() => setTab('media')}>
          <Text style={[styles.tabText, tab === 'media' && styles.tabTextOn]}>メディア</Text>
          {tab === 'media' && <View style={styles.tabUnderline} />}
        </Pressable>
      </View>

      {tab === 'you' ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          {notices.length === 0 ? (
            <Text style={styles.emptyText}>お知らせはまだありません。</Text>
          ) : (
            <NotificationsList notices={notices} onOpen={(id) => onOpenNotice?.(id)} />
          )}
        </ScrollView>
      ) : (
        <>
          {/* SNS 常設 */}
          <View style={styles.snsBar}>
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
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: CR.deepest },
  tabBar: {
    // 既定値。実機では SafeArea の top を加味して JSX 側で上書き
    paddingTop: 56,
    paddingHorizontal: SPACE.lg,
    flexDirection: 'row',
    gap: SPACE.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
  },
  tab: { paddingBottom: SPACE.sm, alignItems: 'center' },
  tabLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabText: { color: COLOR.textSecondary, fontSize: 13, letterSpacing: 1.3, fontWeight: '600' },
  tabTextOn: { color: COLOR.textPrimary },
  tabDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.badge },
  tabUnderline: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 1.5, borderRadius: 1, backgroundColor: COLOR.auraCyan,
  },
  emptyText: {
    color: COLOR.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginTop: SPACE.xl,
    paddingHorizontal: SPACE.lg,
  },
  snsBar: {
    paddingTop: SPACE.lg,
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
