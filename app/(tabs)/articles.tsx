import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useArticles } from '@/hooks/useArticles';
import type { Article } from '@/types/track';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

export default function ArticlesScreen() {
  const { articles, loading } = useArticles();
  const [detail, setDetail] = useState<Article | null>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  // Two-column grid on iPad landscape.
  const numColumns = width >= 900 ? 2 : 1;
  // FlatList requires a stable key when numColumns changes.
  const listKey = `cols-${numColumns}`;

  const handlePress = (article: Article) => {
    if (article.externalLink) {
      Linking.openURL(article.externalLink).catch((err) =>
        console.warn('Failed to open external link:', err),
      );
    } else {
      setDetail(article);
    }
  };

  const contentPadBottom = insets.bottom + 68 + 16;

  const renderItem = ({ item }: { item: Article }) => (
    <Pressable
      onPress={() => handlePress(item)}
      style={({ pressed }) => [
        styles.card,
        numColumns === 2 ? styles.cardHalf : styles.cardFull,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={styles.thumbWrapper}>
        {item.thumbnail ? (
          <Image source={{ uri: item.thumbnail }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]} />
        )}
        {item.stable && (
          <View style={styles.pinBadge}>
            <Ionicons name="pin" size={11} color={colors.white} />
            <Text style={styles.pinBadgeText}>固定</Text>
          </View>
        )}
        {!!item.externalLink && (
          <View style={styles.externalBadge}>
            <Ionicons name="open-outline" size={13} color={colors.textSecondary} />
          </View>
        )}
      </View>
      <View style={styles.cardBody}>
        <Text style={styles.cardDate}>
          {item.date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {!!item.subtitle && (
          <Text style={styles.cardSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        )}
      </View>
    </Pressable>
  );

  const wrappedHtml = useMemo(() => {
    if (!detail) return '';
    return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <style>
      html, body {
        margin: 0;
        padding: 16px;
        background: transparent;
        color: ${colors.textPrimary};
        font-family: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif;
        font-size: 15px;
        line-height: 1.85;
      }
      img { max-width: 100%; height: auto; border-radius: 12px; }
      a { color: ${colors.primary}; }
      h1, h2, h3 { color: ${colors.textPrimary}; }
      p { margin: 0 0 12px; }
    </style>
  </head>
  <body>${detail.descriptions}</body>
</html>`;
  }, [detail]);

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <Text style={styles.title}>記事を読む</Text>
          <Text style={styles.subtitle}>サウンドと集中力に関する記事</Text>
        </View>

        {loading ? (
          <View style={styles.centerFill}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : articles.length === 0 ? (
          <View style={styles.centerFill}>
            <Text style={styles.empty}>記事がまだありません</Text>
          </View>
        ) : (
          <FlatList
            key={listKey}
            data={articles}
            keyExtractor={(a) => a.id}
            numColumns={numColumns}
            columnWrapperStyle={numColumns > 1 ? styles.columnWrap : undefined}
            contentContainerStyle={[
              styles.content,
              { paddingBottom: contentPadBottom },
            ]}
            renderItem={renderItem}
          />
        )}
      </SafeAreaView>

      <Modal
        visible={detail !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDetail(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDetail(null)}>
          <Pressable style={styles.modalCard} onPress={() => undefined}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalDate}>
                  {detail?.date.toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.modalTitle} numberOfLines={2}>
                  {detail?.title}
                </Text>
                {!!detail?.subtitle && (
                  <Text style={styles.modalSubtitle} numberOfLines={2}>
                    {detail.subtitle}
                  </Text>
                )}
              </View>
              <Pressable
                onPress={() => setDetail(null)}
                style={({ pressed }) => [
                  styles.closeBtn,
                  pressed && styles.cardPressed,
                ]}
                accessibilityLabel="閉じる"
              >
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </Pressable>
            </View>

            {detail?.thumbnail ? (
              <Image source={{ uri: detail.thumbnail }} style={styles.modalThumb} />
            ) : null}

            <View style={styles.modalBody}>
              {detail ? (
                <WebView
                  originWhitelist={['*']}
                  source={{ html: wrappedHtml }}
                  style={styles.webview}
                  scalesPageToFit={false}
                  showsVerticalScrollIndicator
                />
              ) : (
                <ScrollView />
              )}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
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
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  columnWrap: {
    gap: spacing.md,
  },
  centerFill: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSecondary,
    fontSize: 13,
  },
  card: {
    borderRadius: borderRadius.lg,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  cardFull: {
    width: '100%',
  },
  cardHalf: {
    flex: 1,
  },
  cardPressed: {
    opacity: 0.85,
  },
  thumbWrapper: {
    position: 'relative',
  },
  thumb: {
    width: '100%',
    height: 140,
    backgroundColor: colors.backgroundDither,
  },
  thumbPlaceholder: {
    backgroundColor: colors.backgroundDither,
  },
  pinBadge: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: '#FFB33C',
  },
  pinBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  externalBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    padding: spacing.md,
    gap: 4,
  },
  cardDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    lineHeight: 20,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 17,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
    borderRadius: borderRadius.xl,
    backgroundColor: '#F0EDF8',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  modalHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  modalDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 26,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
    lineHeight: 20,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalThumb: {
    width: '100%',
    height: 220,
    backgroundColor: colors.backgroundDither,
  },
  modalBody: {
    flex: 1,
    minHeight: 240,
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
});
