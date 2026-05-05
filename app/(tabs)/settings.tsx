import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { updateProfile } from 'firebase/auth';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { OrbSphere } from '@/components/ui/OrbSphere';
import { PasswordModal } from '@/components/settings/PasswordModal';
import { EmailModal } from '@/components/settings/EmailModal';
import { DeleteAccountModal } from '@/components/settings/DeleteAccountModal';
import { useAuth } from '@/hooks/useAuth';
import { useUserPlan } from '@/hooks/useUserPlan';
import { hasPasswordProvider, signOut } from '@/services/auth';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const NOTIF_KEY = 'flux:notifications';
const PRIVACY_URL = 'https://fluxringweb.vercel.app/privacy';
const TERMS_URL = 'https://fluxringweb.vercel.app/terms';
const DANGER = '#c25a65';

type IconName = keyof typeof Ionicons.glyphMap;

type ModalKind = 'password' | 'email' | 'delete' | null;

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { planName, isAdmin } = useUserPlan();
  const isEmailUser = hasPasswordProvider(user);

  const [modal, setModal] = useState<ModalKind>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [notifEnabled, setNotifEnabled] = useState(false);

  // Hydrate notification toggle from AsyncStorage.
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(NOTIF_KEY)
      .then((raw) => {
        if (cancelled) return;
        setNotifEnabled(raw === '1');
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = useMemo(
    () =>
      user?.displayName ||
      user?.email?.split('@')[0] ||
      (user?.isAnonymous ? 'ゲストユーザー' : '匿名ユーザー'),
    [user],
  );
  const displayEmail = user?.email || (user?.isAnonymous ? '匿名セッション' : '');
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleNotifToggle = async (value: boolean) => {
    setNotifEnabled(value);
    try {
      await AsyncStorage.setItem(NOTIF_KEY, value ? '1' : '0');
    } catch (err) {
      console.warn('Failed to persist notification setting', err);
    }
  };

  const beginEditName = () => {
    setNameDraft(user?.displayName ?? '');
    setEditingName(true);
  };
  const cancelEditName = () => {
    setEditingName(false);
    setNameDraft('');
  };
  const saveName = async () => {
    if (!user) return;
    const trimmed = nameDraft.trim();
    if (!trimmed || trimmed === user.displayName) {
      cancelEditName();
      return;
    }
    setSavingName(true);
    try {
      await updateProfile(user, { displayName: trimmed });
      setEditingName(false);
    } catch (err) {
      Alert.alert('エラー', '表示名の更新に失敗しました。');
      console.warn('updateProfile failed', err);
    } finally {
      setSavingName(false);
    }
  };

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

  const openLink = (url: string) => {
    Linking.openURL(url).catch(() => undefined);
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
          <Text style={styles.heading}>設定</Text>
          <Text style={styles.subHeading}>アカウント情報と各種設定</Text>

          {/* Profile card */}
          <View style={styles.profileCard}>
            <View style={styles.profileAvatar}>
              <OrbSphere size={64} hue={266} />
            </View>
            <View style={styles.profileBody}>
              {editingName ? (
                <View style={styles.nameEditRow}>
                  <TextInput
                    value={nameDraft}
                    onChangeText={setNameDraft}
                    placeholder="表示名"
                    placeholderTextColor={colors.textMuted}
                    style={styles.nameInput}
                    autoFocus
                    editable={!savingName}
                    maxLength={32}
                  />
                  <Pressable
                    onPress={saveName}
                    disabled={savingName}
                    style={({ pressed }) => [
                      styles.nameActionBtn,
                      styles.nameActionPrimary,
                      (pressed || savingName) && { opacity: 0.7 },
                    ]}
                  >
                    {savingName ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Ionicons name="checkmark" size={16} color={colors.white} />
                    )}
                  </Pressable>
                  <Pressable
                    onPress={cancelEditName}
                    disabled={savingName}
                    style={({ pressed }) => [
                      styles.nameActionBtn,
                      pressed && { opacity: 0.7 },
                    ]}
                  >
                    <Ionicons name="close" size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              ) : (
                <View style={styles.nameRow}>
                  <Text style={styles.profileName} numberOfLines={1}>
                    {displayName}
                  </Text>
                  <Pressable
                    onPress={beginEditName}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.editBtn,
                      pressed && { opacity: 0.6 },
                    ]}
                  >
                    <Ionicons name="pencil" size={14} color={colors.primary} />
                  </Pressable>
                </View>
              )}
              {displayEmail ? (
                <Text style={styles.profileEmail} numberOfLines={1}>
                  {displayEmail}
                </Text>
              ) : null}
              <View style={styles.badgeRow}>
                <View style={styles.planBadge}>
                  <Text style={styles.planBadgeText}>{planName}</Text>
                </View>
                {isAdmin ? (
                  <View style={styles.adminBadge}>
                    <Ionicons name="shield-checkmark" size={11} color={colors.primary} />
                    <Text style={styles.adminBadgeText}>管理者</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>

          {/* Account section */}
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
                last
                onPress={() => setModal('password')}
              />
            ) : null}
          </View>

          {/* App settings */}
          <SectionHeader label="アプリ設定" />
          <View style={styles.groupCard}>
            <SettingRow
              icon="notifications-outline"
              label="通知"
              desc="リマインダー・お知らせ通知"
              right={
                <Switch
                  value={notifEnabled}
                  onValueChange={handleNotifToggle}
                  trackColor={{ false: 'rgba(200,190,220,0.4)', true: colors.primaryLight }}
                  thumbColor={notifEnabled ? colors.primary : '#f4f4f8'}
                  ios_backgroundColor="rgba(200,190,220,0.4)"
                />
              }
            />
            <SettingRow
              icon="musical-notes-outline"
              label="サウンド設定"
              desc="（プレースホルダー）"
              last
              onPress={() => console.log('TODO: sound settings')}
            />
          </View>

          {/* Admin section — admins only */}
          {isAdmin ? (
            <>
              <SectionHeader label="運営管理" />
              <View style={styles.groupCard}>
                <SettingRow
                  icon="musical-notes-outline"
                  label="楽曲管理"
                  onPress={() => console.log('TODO: admin tracks')}
                />
                <SettingRow
                  icon="document-text-outline"
                  label="記事管理"
                  onPress={() => console.log('TODO: admin articles')}
                />
                <SettingRow
                  icon="people-outline"
                  label="ユーザー管理"
                  last
                  onPress={() => console.log('TODO: admin users')}
                />
              </View>
            </>
          ) : null}

          {/* Other */}
          <SectionHeader label="その他" />
          <View style={styles.groupCard}>
            <SettingRow
              icon="information-circle-outline"
              label="アプリについて"
              desc={`バージョン ${appVersion}`}
            />
            <SettingRow
              icon="shield-outline"
              label="プライバシーポリシー"
              onPress={() => openLink(PRIVACY_URL)}
            />
            <SettingRow
              icon="document-text-outline"
              label="利用規約"
              last
              onPress={() => openLink(TERMS_URL)}
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
            <Ionicons name="log-out-outline" size={18} color={colors.white} />
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
            <Ionicons name="trash-outline" size={16} color={DANGER} />
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
      {right ?? (
        interactive ? (
          <Ionicons name="chevron-forward" size={16} color={colors.tabInactive} />
        ) : null
      )}
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
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  subHeading: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.lg,
  },

  // Profile
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md + 2,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  profileName: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  editBtn: {
    width: 24,
    height: 24,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(145,120,189,0.12)',
  },
  nameEditRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nameInput: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: borderRadius.sm,
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.5)',
    backgroundColor: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    color: colors.textPrimary,
  },
  nameActionBtn: {
    width: 28,
    height: 28,
    borderRadius: borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.4)',
  },
  nameActionPrimary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  profileEmail: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    marginTop: spacing.xs + 2,
    flexWrap: 'wrap',
  },
  planBadge: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(145,120,189,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(145,120,189,0.2)',
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(145,120,189,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(145,120,189,0.2)',
  },
  adminBadgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.primary,
  },

  // Section / group
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  groupCard: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.md,
  },

  // Rows
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm + 2,
    paddingVertical: spacing.md - 2,
    paddingHorizontal: spacing.md,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(200,190,220,0.35)',
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  rowDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },

  // Buttons
  logoutBtn: {
    marginTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: 14,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs + 2,
    paddingVertical: spacing.sm + 2,
  },
  deleteAccountLabel: {
    color: DANGER,
    fontSize: 13,
    fontWeight: '500',
  },
});
