/**
 * NotificationsScreen.tsx — 通知一覧
 * ------------------------------------------------------------------
 * ワイヤーフレーム 04 / 通知一覧 ベル:
 *   ・ホーム右上のベルから開く専用画面
 *   ・時系列降順（タイトル＋日付）→ タップで本文へ
 *   ・未読は行頭に控えめな赤い点のみ（数字なし）
 *   ・全員/個別の配信は運営側で出し分け（ユーザーには区別を出さない）
 *   ・藍紫の背景に白文字。装飾を排した静かなリスト
 */

import React from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { COLOR, SPACE } from '../constants/design-tokens';

export type Notice = {
  id: string;
  title: string;
  date: string;   // 例: '2026.06.20'
  unread: boolean;
  body?: string;
};

type Props = {
  notices: Notice[];
  onBack: () => void;
  onOpen: (id: string) => void;
};

export const NotificationsScreen: React.FC<Props> = ({ notices, onBack, onOpen }) => {
  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={COLOR.bg} />

      <View style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12}>
          <Text style={styles.back}>‹ ホーム</Text>
        </Pressable>
        <Text style={styles.h1}>通知</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {notices.map((n) => (
          <Pressable key={n.id} style={styles.row} onPress={() => onOpen(n.id)}>
            <View style={styles.dotCol}>
              {n.unread && <View style={styles.unreadDot} />}
            </View>
            <View style={styles.textCol}>
              <Text style={[styles.title, n.unread && styles.titleUnread]} numberOfLines={2}>
                {n.title}
              </Text>
              <Text style={styles.date}>{n.date}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLOR.bg },
  header: {
    // TODO: SafeAreaInsets.top を加算
    paddingTop: 52,
    paddingHorizontal: SPACE.lg,
    paddingBottom: SPACE.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  back: { color: COLOR.textSecondary, fontSize: 14 },
  h1: { color: COLOR.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    paddingVertical: SPACE.md,
    paddingHorizontal: SPACE.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLOR.border,
    gap: SPACE.sm,
  },
  dotCol: { width: 14, paddingTop: 6, alignItems: 'center' },
  unreadDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: COLOR.badge },
  textCol: { flex: 1, gap: 4 },
  title: { color: COLOR.textSecondary, fontSize: 15, letterSpacing: 0.3, lineHeight: 21 },
  titleUnread: { color: COLOR.textPrimary, fontWeight: '500' },
  date: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5 },
});

export default NotificationsScreen;
