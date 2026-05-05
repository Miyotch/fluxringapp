import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OrbSphere } from '../ui/OrbSphere';
import type { Playlist } from '../../hooks/usePlaylists';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface PlaylistEditModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  playlist?: Playlist;
  onClose: () => void;
  onSave: (data: { name: string; hue: number }) => Promise<void>;
  onDelete?: () => Promise<void>;
}

const HUE_PRESETS: Array<{ label: string; hue: number }> = [
  { label: 'パープル', hue: 266 },
  { label: 'ピンク', hue: 300 },
  { label: 'ブルー', hue: 200 },
  { label: 'グリーン', hue: 140 },
  { label: 'オレンジ', hue: 30 },
  { label: 'レッド', hue: 0 },
];

const NAME_MAX = 32;

export function PlaylistEditModal({
  visible,
  mode,
  playlist,
  onClose,
  onSave,
  onDelete,
}: PlaylistEditModalProps) {
  const [name, setName] = useState(playlist?.name ?? '');
  const [hue, setHue] = useState(playlist?.hue ?? 266);
  const [submitting, setSubmitting] = useState(false);

  // Reset internal state whenever the modal opens or the target playlist changes.
  useEffect(() => {
    if (visible) {
      setName(playlist?.name ?? '');
      setHue(playlist?.hue ?? 266);
      setSubmitting(false);
    }
  }, [visible, playlist?.id, playlist?.name, playlist?.hue]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && !submitting;

  const handleSave = async () => {
    if (!canSave) return;
    setSubmitting(true);
    try {
      await onSave({ name: trimmed, hue });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete || submitting) return;
    setSubmitting(true);
    try {
      await onDelete();
    } finally {
      setSubmitting(false);
    }
  };

  const adjustHue = (delta: number) => {
    setHue((h) => {
      const next = h + delta;
      if (next < 0) return next + 360;
      if (next >= 360) return next - 360;
      return next;
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={['landscape', 'landscape-left', 'landscape-right']}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={styles.panel}
          onPress={(event) => event.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {mode === 'create' ? 'プレイリストを作成' : 'プレイリストを編集'}
            </Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityLabel="閉じる"
            >
              <Ionicons
                name="close"
                size={20}
                color={colors.textSecondary}
              />
            </Pressable>
          </View>

          {/* Orb preview */}
          <View style={styles.preview}>
            <OrbSphere size={120} hue={hue} />
          </View>

          {/* Name input */}
          <View style={styles.field}>
            <Text style={styles.label}>プレイリスト名</Text>
            <TextInput
              value={name}
              onChangeText={(value) => setName(value.slice(0, NAME_MAX))}
              placeholder="例: 集中モード"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              maxLength={NAME_MAX}
              autoFocus
            />
            <Text style={styles.counter}>
              {trimmed.length}/{NAME_MAX}
            </Text>
          </View>

          {/* Color presets */}
          <View style={styles.field}>
            <Text style={styles.label}>カラー</Text>
            <View style={styles.colorRow}>
              {HUE_PRESETS.map((preset) => {
                const selected = preset.hue === hue;
                return (
                  <Pressable
                    key={preset.hue}
                    onPress={() => setHue(preset.hue)}
                    accessibilityLabel={preset.label}
                    style={[
                      styles.colorSwatch,
                      {
                        backgroundColor: `hsl(${preset.hue}, 55%, 65%)`,
                        borderColor: selected
                          ? colors.primary
                          : 'rgba(255,255,255,0.6)',
                        borderWidth: selected ? 3 : 2,
                      },
                    ]}
                  />
                );
              })}
            </View>
          </View>

          {/* Custom hue (numeric + buttons fallback for slider) */}
          <View style={styles.field}>
            <Text style={styles.label}>カスタムカラー (色相)</Text>
            <View style={styles.hueRow}>
              <Pressable
                onPress={() => adjustHue(-10)}
                style={styles.hueButton}
                hitSlop={8}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={colors.textPrimary}
                />
              </Pressable>
              <View style={styles.hueValueWrap}>
                <View
                  style={[
                    styles.hueDot,
                    { backgroundColor: `hsl(${hue}, 55%, 65%)` },
                  ]}
                />
                <Text style={styles.hueValue}>{Math.round(hue)}°</Text>
              </View>
              <Pressable
                onPress={() => adjustHue(10)}
                style={styles.hueButton}
                hitSlop={8}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={colors.textPrimary}
                />
              </Pressable>
            </View>
            <View style={styles.hueGradientWrap}>
              <LinearGradient
                colors={[
                  'hsl(0, 60%, 65%)',
                  'hsl(60, 60%, 65%)',
                  'hsl(120, 60%, 65%)',
                  'hsl(180, 60%, 65%)',
                  'hsl(240, 60%, 65%)',
                  'hsl(300, 60%, 65%)',
                  'hsl(360, 60%, 65%)',
                ]}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={styles.hueGradient}
              />
              <View
                style={[
                  styles.hueIndicator,
                  { left: `${(hue / 360) * 100}%` },
                ]}
              />
            </View>
          </View>

          {/* Actions */}
          <View style={styles.actions}>
            {mode === 'edit' && onDelete ? (
              <Pressable
                onPress={handleDelete}
                style={styles.deleteButton}
                disabled={submitting}
                hitSlop={6}
              >
                <Ionicons name="trash-outline" size={16} color="#e74c3c" />
                <Text style={styles.deleteText}>削除</Text>
              </Pressable>
            ) : null}
            <View style={styles.actionsSpacer} />
            <Pressable
              onPress={onClose}
              style={styles.cancelButton}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>キャンセル</Text>
            </Pressable>
            <Pressable
              onPress={handleSave}
              disabled={!canSave}
              style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
            >
              <LinearGradient
                colors={['#a388c8', colors.primary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.saveGradient}
              />
              <Text style={styles.saveText}>
                {mode === 'create' ? '作成' : '保存'}
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  panel: {
    width: 460,
    maxWidth: '92%',
    backgroundColor: colors.backgroundBase,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  field: {
    marginBottom: spacing.md,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    color: colors.textPrimary,
  },
  counter: {
    marginTop: 4,
    fontSize: 10,
    color: colors.textMuted,
    textAlign: 'right',
  },
  colorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  hueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  hueButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hueValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  hueDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
  },
  hueValue: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hueGradientWrap: {
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
  },
  hueGradient: {
    height: 6,
    borderRadius: 3,
  },
  hueIndicator: {
    position: 'absolute',
    top: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: colors.primary,
    transform: [{ translateX: -5 }],
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  actionsSpacer: {
    flex: 1,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
  },
  deleteText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#e74c3c',
  },
  cancelButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  cancelText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  saveButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: 8,
    borderRadius: borderRadius.md,
    overflow: 'hidden',
    minWidth: 84,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveGradient: {
    ...StyleSheet.absoluteFillObject,
  },
  saveText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.white,
  },
});
