import { useState, type ReactNode } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { PasswordModal } from '@/components/settings/PasswordModal';
import { EmailModal } from '@/components/settings/EmailModal';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { useAuth } from '@/hooks/useAuth';
import { useUserPlan } from '@/hooks/useUserPlan';
import { hasPasswordProvider, signOut } from '@/services/auth';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const DANGER = '#c25a65';
const SOFT_AVATAR_BG = 'rgba(220,225,240,1)';
const AVATAR_ICON_COLOR = '#a8b3d6';
const ROW_SEPARATOR = 'rgba(145,120,189,0.1)';
const CHEVRON_COLOR = '#b0a8c8';

type IconName = keyof typeof Ionicons.glyphMap;
type ModalKind = 'password' | 'email' | 'delete' | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { planName, isAdmin } = useUserPlan();
  const isEmailUser = hasPasswordProvider(user);

  const [modal, setModal] = useState<ModalKind>(null);

  const displayName =
    user?.displayName ||
    user?.email?.split('@')[0] ||
    (user?.isAnonymous ? 'ゲストユーザー' : '匿名ユーザー');
  const displayEmail = user?.email || (user?.isAnonymous ? '匿名セッション' : '');
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleLogout = () => {
    Alert.alert('ログアウト', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: () => {
          signOut().catch((err) => console.warn('Logout failed', err));
        },
      },
    ]);
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: insets.bottom + 68 + 16 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* In-page title block */}
          <Text style={styles.heading}>マイアカウント</Text>
          <Text style={styles.subHeading}>アカウント情報と各種設定</Text>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.avatarWrap}>
              {user?.photoURL ? (
                <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
              ) : (
                <Ionicons
                  name="person-circle"
                  size={56}
                  color={AVATAR_ICON_COLOR}
                />
              )}
            </View>
            <View style={styles.profileBody}>
              <Text style={styles.profileName} numberOfLines={1}>
                {displayName}
              </Text>
              {displayEmail ? (
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {displayEmail}
                </Text>
              ) : null}
            </View>
            <View style={styles.planBadge}>
              <Text style={styles.planBadgeText}>{planName}</Text>
            </View>
          </View>

          {/* アカウント */}
          <SectionHeader label="アカウント" />
          <View style={styles.groupCard}>
            <SettingRow
              icon="mail-outline"
              label="メールアドレス変更"
              desc={user?.email ?? undefined}
              last={!isEmailUser}
              onPress={() => setModal('email')}
            />
            {isEmailUser ? (
              <SettingRow
                icon="lock-closed-outline"
                label="パスワード変更"
                desc="••••••••"
                last
                onPress={() => setModal('password')}
              />
            ) : null}
          </View>

          {/* アプリ設定 */}
          <SectionHeader label="アプリ設定" />
          <View style={styles.groupCard}>
            <SettingRow
              icon="notifications-outline"
              label="通知設定"
              desc="リマインダー・お知らせ通知"
              last
              onPress={() => console.log('TODO: notifications')}
            />
          </View>

          {/* 運営管理 — admin only */}
          {isAdmin ? (
            <>
              <SectionHeader label="運営管理" />
              <View style={styles.groupCard}>
                <SettingRow
                  icon="construct-outline"
                  label="サービス管理画面"
                  desc="記事・ユーザー管理"
                  last
                  onPress={() => console.log('TODO: admin')}
                />
              </View>
            </>
          ) : null}

          {/* その他 */}
          <SectionHeader label="その他" />
          <View style={styles.groupCard}>
            <SettingRow
              icon="information-circle-outline"
              label="アプリについて"
              desc={`バージョン ${appVersion}`}
              last
              onPress={() => undefined}
            />
          </View>

          {/* Logout button */}
          <Pressable
            onPress={handleLogout}
            style={({ pressed }) => [
              styles.logoutBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.logoutLabel}>ログアウト</Text>
          </Pressable>

          {/* Delete account */}
          <Pressable
            onPress={() => setModal('delete')}
            style={({ pressed }) => [
              styles.deleteAccountBtn,
              pressed && { opacity: 0.7 },
            ]}
          >
            <Text style={styles.deleteAccountLabel}>アカウントを削除</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>

      <PasswordModal
        visible={modal === 'password'}
        onClose={() => setModal(null)}
      />
      <EmailModal visible={modal === 'email'} onClose={() => setModal(null)} />
      <DeleteAccountModal
        visible={modal === 'delete'}
        onClose={() => setModal(null)}
      />
    </GradientBackground>
  );
}

/* ── Sub-components ────────────────────────────────────────────── */

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>;
}

interface SettingRowProps {
  icon: IconName;
  label: string;
  desc?: string;
  last?: boolean;
  onPress?: () => void;
  right?: ReactNode;
}

function SettingRow({ icon, label, desc, last, onPress, right }: SettingRowProps) {
  const interactive = Boolean(onPress);
  return (
    <Pressable
      onPress={onPress}
      disabled={!interactive}
      style={({ pressed }) => [
        styles.row,
        !last && styles.rowDivider,
        interactive && pressed && { backgroundColor: 'rgba(145,120,189,0.06)' },
      ]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {desc ? (
          <Text style={styles.rowDesc} numberOfLines={1}>
            {desc}
          </Text>
        ) : null}
      </View>
      {right ?? <Ionicons name="chevron-forward" size={20} color={CHEVRON_COLOR} />}
    </Pressable>
  );
}

/* ── Styles ────────────────────────────────────────────────────── */

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xl,
    maxWidth: 900,
    alignSelf: 'center',
    width: '100%',
  },

  // Header
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subHeading: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: 20,
    borderRadius: 24,
    marginBottom: spacing.sm,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  avatarWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: SOFT_AVATAR_BG,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  profileBody: {
    flex: 1,
    minWidth: 0,
  },
  profileName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  profileEmail: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  planBadge: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(145,120,189,0.12)',
  },
  planBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9178BD',
  },

  // Section / group
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 24,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  groupCard: {
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md - 4,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: ROW_SEPARATOR,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  rowDesc: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Buttons
  logoutBtn: {
    marginTop: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
  },
  logoutLabel: {
    color: colors.white,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  deleteAccountBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm + 2,
  },
  deleteAccountLabel: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '500',
  },
});
