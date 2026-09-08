/**
 * NotificationsScreen.tsx — 通知一覧（「あなた宛」）
 * ------------------------------------------------------------------
 * ワイヤーフレーム 04 / 通知一覧:
 *   ・メディア画面の「あなた宛」タブの中身として表示する（単独の画面ではない）
 *   ・時系列降順（タイトル＋日付）→ タップで本文へ
 *   ・未読は行頭に控えめな赤い点のみ（数字なし）
 *   ・全員/個別の配信は運営側で出し分け（ユーザーには区別を出さない）
 *   ・藍紫の背景に白文字。装飾を排した静かなリスト
 */

import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLOR, SPACE } from '../constants/design-tokens';
import { NUM_FONT } from '../constants/fonts';

export type Notice = {
  id: string;
  title: string;
  date: string;   // 例: '2026.06.20'
  unread: boolean;
  body?: string;
};

type Props = {
  notices: Notice[];
  onOpen: (id: string) => void;
};

export const NotificationsList: React.FC<Props> = ({ notices, onOpen }) => (
  <View style={styles.root}>
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
  </View>
);

const styles = StyleSheet.create({
  root: { paddingBottom: 40 },
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
  // 日付＝数字表記
  date: { color: COLOR.textSecondary, fontSize: 11, letterSpacing: 0.5, fontFamily: NUM_FONT },
});

export default NotificationsList;
