import { useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

type NotificationKind = 'newTrack' | 'promo' | 'update' | 'recommendation';

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message: string;
  time: string;
  unread: boolean;
};

const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    kind: 'newTrack',
    title: '新しいサウンドが追加されました',
    message: '「Whisper of Renewal」が利用可能になりました。',
    time: '1時間前',
    unread: true,
  },
  {
    id: '2',
    kind: 'promo',
    title: 'プレミアムプラン特別オファー',
    message: '今なら初月50%オフでお試しいただけます。',
    time: '3時間前',
    unread: true,
  },
  {
    id: '3',
    kind: 'update',
    title: 'アプリがアップデートされました',
    message: 'v1.1.0: 新しいエフェクトとパフォーマンス改善を含みます。',
    time: '昨日',
    unread: false,
  },
  {
    id: '4',
    kind: 'recommendation',
    title: 'おすすめのサウンド',
    message: 'あなたの好みに合った新しいサウンドを見つけました。',
    time: '2日前',
    unread: false,
  },
];

const ICON_BY_KIND: Record<NotificationKind, keyof typeof Ionicons.glyphMap> = {
  newTrack: 'musical-note-outline',
  promo: 'gift-outline',
  update: 'megaphone-outline',
  recommendation: 'musical-note-outline',
};

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notification[]>(SAMPLE_NOTIFICATIONS);
  const insets = useSafeAreaInsets();

  const toggleRead = (id: string) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: !n.unread } : n)),
    );
  };

  const markAllRead = () => {
    setItems((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const contentPadBottom = insets.bottom + 68 + 16;

  const renderItem = ({ item }: { item: Notification }) => {
    const iconName = ICON_BY_KIND[item.kind];
    return (
      <Pressable
        onPress={() => toggleRead(item.id)}
        style={({ pressed }) => [
          styles.card,
          { opacity: item.unread ? 1 : 0.7 },
          pressed && styles.cardPressed,
        ]}
      >
        <View
          style={[
            styles.iconCircle,
            {
              backgroundColor: item.unread
                ? 'rgba(155,143,212,0.15)'
                : 'rgba(155,143,212,0.08)',
            },
          ]}
        >
          <Ionicons
            name={iconName}
            size={20}
            color={item.unread ? colors.primary : colors.tabInactive}
          />
        </View>
        <View style={styles.cardBody}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle} numberOfLines={1}>
              {item.title}
            </Text>
            {item.unread && <View style={styles.unreadDot} />}
          </View>
          <Text style={styles.cardMessage} numberOfLines={2}>
            {item.message}
          </Text>
          <Text style={styles.cardTime}>{item.time}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>お知らせ</Text>
            <Text style={styles.subtitle}>最新のアップデートとお知らせ</Text>
          </View>
          <Pressable
            onPress={markAllRead}
            style={({ pressed }) => [
              styles.markAllBtn,
              pressed && styles.cardPressed,
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={14}
              color={colors.primary}
            />
            <Text style={styles.markAllText}>すべて既読にする</Text>
          </Pressable>
        </View>

        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: contentPadBottom },
          ]}
          renderItem={renderItem}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.primary,
  },
  content: {
    paddingHorizontal: spacing.lg,
  },
  separator: {
    height: 10,
  },
  card: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  cardPressed: {
    opacity: 0.8,
  },
  iconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  cardTitle: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  cardMessage: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 3,
    marginBottom: 4,
  },
  cardTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
});
