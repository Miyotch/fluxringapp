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
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Linking,
} from 'react-native';
import { COLOR, SPACE, RADIUS } from '../constants/design-tokens';

type Sns = { key: string; label: string; url: string };
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
};

const DEFAULT_SNS: Sns[] = [
  { key: 'instagram', label: 'Instagram', url: 'https://instagram.com' },
  { key: 'note',      label: 'note',      url: 'https://note.com' },
  { key: 'x',         label: 'X',         url: 'https://x.com' },
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
}) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      {/* SNS 常設 */}
      <View style={styles.snsBar}>
        {sns.map((s) => (
          <Pressable
            key={s.key}
            style={styles.snsBtn}
            onPress={() => Linking.openURL(s.url).catch(() => {})}
            accessibilityLabel={s.label}
          >
            <Text style={styles.snsLabel}>{s.label}</Text>
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
              <View style={styles.thumb}>
                <Text style={styles.thumbHint}>埋め込みサムネ</Text>
              </View>
            )}
            {a.body && <Text style={styles.articleBody}>{a.body}</Text>}
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  snsBar: {
    // TODO: SafeAreaInsets.top を加算
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
  list: { padding: SPACE.lg, gap: SPACE.lg, paddingBottom: 40 },
  article: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(34,36,69,0.22)',
    padding: SPACE.md,
    gap: SPACE.sm,
  },
  articleDate: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5 },
  articleTitle: { color: COLOR.textPrimary, fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  thumb: {
    aspectRatio: 16 / 9,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLOR.border,
    backgroundColor: 'rgba(58,61,114,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  thumbHint: { color: COLOR.textSecondary, fontSize: 12 },
  articleBody: { color: COLOR.textSecondary, fontSize: 13, lineHeight: 20 },
});

export default MediaScreen;
