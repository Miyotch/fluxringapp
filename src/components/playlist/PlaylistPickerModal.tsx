import { useEffect, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { OrbSphere } from '../ui/OrbSphere';
import { usePlaylists } from '../../hooks/usePlaylists';
import type { Track } from '../../types/track';
import { colors } from '../../theme/colors';
import { spacing, borderRadius } from '../../theme/spacing';

interface PlaylistPickerModalProps {
  visible: boolean;
  track: Track | null;
  onClose: () => void;
  onPick: (playlistId: string) => Promise<void>;
}

const DEFAULT_NEW_HUE = 266;

export function PlaylistPickerModal({
  visible,
  track,
  onClose,
  onPick,
}: PlaylistPickerModalProps) {
  const { playlists, createPlaylistWithTrack } = usePlaylists();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setCreating(false);
      setNewName('');
      setBusy(false);
    }
  }, [visible]);

  const handlePick = async (playlistId: string) => {
    if (!track || busy) return;
    setBusy(true);
    try {
      await onPick(playlistId);
    } finally {
      setBusy(false);
    }
  };

  const handleCreateAndAdd = () => {
    const name = newName.trim();
    if (!name || !track || busy) return;
    setBusy(true);
    try {
      createPlaylistWithTrack(name, DEFAULT_NEW_HUE, track.id);
      setCreating(false);
      setNewName('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
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
            <Text style={styles.headerTitle}>プレイリストに追加</Text>
            <Pressable
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={8}
              accessibilityLabel="閉じる"
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          {/* Track preview */}
          {track ? (
            <View style={styles.trackPreview}>
              <View style={styles.artwork}>
                {track.artworkUrl ? (
                  <Image
                    source={{ uri: track.artworkUrl }}
                    style={styles.artworkImage}
                  />
                ) : (
                  <View style={styles.artworkPlaceholder} />
                )}
              </View>
              <View style={styles.trackText}>
                <Text style={styles.trackTitle} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackArtist} numberOfLines={1}>
                  {track.artist}
                </Text>
              </View>
            </View>
          ) : null}

          <Text style={styles.helper}>
            追加先のプレイリストを選んでください
          </Text>

          <ScrollView
            style={styles.list}
            contentContainerStyle={styles.listContent}
          >
            {playlists.map((pl) => {
              const alreadyIn = track
                ? pl.trackIds.includes(track.id)
                : false;
              return (
                <Pressable
                  key={pl.id}
                  onPress={() => !alreadyIn && handlePick(pl.id)}
                  disabled={alreadyIn || busy || !track}
                  style={({ pressed }) => [
                    styles.item,
                    alreadyIn && styles.itemDisabled,
                    pressed && !alreadyIn && styles.itemPressed,
                  ]}
                >
                  <OrbSphere size={44} hue={pl.hue} />
                  <View style={styles.itemText}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {pl.name}
                    </Text>
                    <Text style={styles.itemCount}>
                      {pl.trackIds.length} 曲
                    </Text>
                  </View>
                  {alreadyIn ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={colors.primary}
                    />
                  ) : null}
                </Pressable>
              );
            })}

            {creating ? (
              <View style={styles.createForm}>
                <TextInput
                  value={newName}
                  onChangeText={setNewName}
                  placeholder="プレイリスト名"
                  placeholderTextColor={colors.textMuted}
                  style={styles.createInput}
                  autoFocus
                  maxLength={32}
                  onSubmitEditing={handleCreateAndAdd}
                  returnKeyType="done"
                />
                <View style={styles.createButtons}>
                  <Pressable
                    onPress={handleCreateAndAdd}
                    disabled={!newName.trim() || busy || !track}
                    style={[
                      styles.createConfirm,
                      (!newName.trim() || busy) && styles.disabled,
                    ]}
                  >
                    <LinearGradient
                      colors={['#a388c8', colors.primary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={StyleSheet.absoluteFillObject}
                    />
                    <Text style={styles.createConfirmText}>作成</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      setCreating(false);
                      setNewName('');
                    }}
                    style={styles.createCancel}
                  >
                    <Text style={styles.createCancelText}>キャンセル</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                onPress={() => setCreating(true)}
                style={styles.newPlaylistButton}
              >
                <Ionicons name="add" size={18} color={colors.primary} />
                <Text style={styles.newPlaylistText}>
                  新しいプレイリストを作成
                </Text>
              </Pressable>
            )}
          </ScrollView>
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
    width: 480,
    maxWidth: '92%',
    maxHeight: '85%',
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
    fontSize: 16,
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
  trackPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    marginBottom: spacing.sm,
  },
  artwork: {
    width: 44,
    height: 44,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: colors.backgroundDither,
  },
  artworkImage: {
    width: '100%',
    height: '100%',
  },
  artworkPlaceholder: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.backgroundDither,
  },
  trackText: {
    flex: 1,
    minWidth: 0,
  },
  trackTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  trackArtist: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  helper: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.sm,
    paddingBottom: 4,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardBackground,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  itemDisabled: {
    opacity: 0.55,
  },
  itemPressed: {
    backgroundColor: colors.cardActiveBackground,
  },
  itemText: {
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  itemCount: {
    fontSize: 11,
    color: colors.textSecondary,
    marginTop: 2,
  },
  newPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(145,120,189,0.06)',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(145,120,189,0.25)',
  },
  newPlaylistText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  createForm: {
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    gap: spacing.sm,
  },
  createInput: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.3)',
    backgroundColor: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    color: colors.textPrimary,
  },
  createButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  createConfirm: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createConfirmText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.white,
  },
  createCancel: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(200,190,220,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  createCancelText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  disabled: {
    opacity: 0.4,
  },
});
