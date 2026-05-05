import { useCallback, useMemo, useState } from 'react';
import {
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
import Slider from '@react-native-community/slider';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { GradientBackground } from '@/components/ui/GradientBackground';
import { useSearchFilters } from '@/hooks/useSearchFilters';
import type { SearchFilters } from '@/types/searchFilters';
import { colors } from '@/theme/colors';
import { spacing, borderRadius } from '@/theme/spacing';

const QUICK_TAGS: readonly string[] = [
  '#528Hz',
  '#安眠',
  '#集中',
  '#浄化',
  '#自然音',
  '#ピアノ',
  '#瞑想',
  '#リラックス',
];

const ROOT_FREQUENCY_OPTIONS: readonly string[] = ['432', '440', '444'];

const BRAINWAVE_OPTIONS: readonly string[] = [
  'OFF',
  'Alpha',
  'Beta',
  'Theta',
  'Delta',
  'Gamma',
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters } = useSearchFilters();
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(false);

  const update = useCallback(
    <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
      setFilters({ ...filters, [key]: value });
    },
    [filters, setFilters],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const exists = filters.tags.includes(tag);
      const nextTags = exists
        ? filters.tags.filter((t) => t !== tag)
        : [...filters.tags, tag];
      setFilters({ ...filters, tags: nextTags });
    },
    [filters, setFilters],
  );

  const handleClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/(tabs)');
    }
  }, [router]);

  const bottomPad = useMemo(
    () => insets.bottom + 68 + spacing.md,
    [insets.bottom],
  );

  return (
    <GradientBackground>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>サーチ</Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={({ pressed }) => [
              styles.closeButton,
              pressed && styles.closeButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="閉じる"
          >
            <Ionicons name="close" size={20} color={colors.textPrimary} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: bottomPad },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section 1: モード・再生環境 */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>モード・再生環境</Text>

            <ToggleRow
              label="空間調律（Frequency）"
              value={filters.frequencyMode}
              onChange={(v) => update('frequencyMode', v)}
            />
            <ToggleRow
              label="空間演出（Melody）"
              value={filters.melodyMode}
              onChange={(v) => update('melodyMode', v)}
            />

            <View style={styles.subBlock}>
              <Text style={styles.subLabel}>再生環境</Text>
              <View style={styles.checkboxRow}>
                <CheckboxRow
                  label="イヤホン"
                  value={filters.earphoneOptimized}
                  onChange={(v) => update('earphoneOptimized', v)}
                />
                <CheckboxRow
                  label="スピーカー"
                  value={filters.speakerOptimized}
                  onChange={(v) => update('speakerOptimized', v)}
                />
              </View>
            </View>

            <ConfirmButton onPress={handleClose} />
          </View>

          {/* Section 2: 目的から選ぶ */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>目的から選ぶ</Text>

            <View style={styles.searchBar}>
              <Ionicons
                name="search"
                size={18}
                color={colors.textSecondary}
              />
              <TextInput
                value={filters.keyword}
                onChangeText={(t) => update('keyword', t)}
                placeholder="例: 「深い眠り」「集中力を高める」"
                placeholderTextColor={colors.textMuted}
                style={styles.searchInput}
                autoCapitalize="none"
                returnKeyType="search"
              />
              {filters.keyword.length > 0 ? (
                <Pressable
                  onPress={() => update('keyword', '')}
                  hitSlop={8}
                >
                  <Ionicons
                    name="close-circle"
                    size={18}
                    color={colors.textMuted}
                  />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.tagsRow}>
              {QUICK_TAGS.map((tag) => {
                const active = filters.tags.includes(tag);
                return (
                  <Pressable
                    key={tag}
                    onPress={() => toggleTag(tag)}
                    style={({ pressed }) => [
                      styles.tag,
                      active && styles.tagActive,
                      pressed && styles.pillPressed,
                    ]}
                  >
                    <Text
                      style={[
                        styles.tagText,
                        active && styles.tagTextActive,
                      ]}
                    >
                      {tag}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <ConfirmButton onPress={handleClose} />
          </View>

          {/* Section 3: 空間を調律する */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>空間を調律する</Text>
            <Text style={styles.sectionDesc}>
              スライダー操作で、言葉にできない「今の空気感」を即座に音へ反映。
            </Text>

            <SingleSliderRow
              label="周囲のノイズレベル"
              leftLabel="Low"
              rightLabel="High"
              range={filters.noiseLevel}
              onChange={(r) => update('noiseLevel', r)}
            />
            <SingleSliderRow
              label="音色特性（Tone）"
              leftLabel="Low"
              rightLabel="High"
              range={filters.toneCharacter}
              onChange={(r) => update('toneCharacter', r)}
            />
            <SingleSliderRow
              label="リズム調整"
              leftLabel="Low"
              rightLabel="High"
              range={filters.rhythmIntensity}
              onChange={(r) => update('rhythmIntensity', r)}
            />

            <ConfirmButton onPress={handleClose} />
          </View>

          {/* Section 4: 深層設定 — Advanced Protocol (collapsible) */}
          <View style={styles.section}>
            <Pressable
              onPress={() => setAdvancedOpen((v) => !v)}
              style={styles.advancedHeader}
            >
              <Text style={styles.sectionLabel}>
                深層設定 — Advanced Protocol
              </Text>
              <Ionicons
                name={advancedOpen ? 'chevron-up' : 'chevron-down'}
                size={18}
                color={colors.textSecondary}
              />
            </Pressable>
            <Text style={styles.sectionDesc}>
              周波数・音律・脳波同調など、深層レベルのサウンド設計。
            </Text>

            {advancedOpen ? (
              <View style={styles.advancedBody}>
                <TriStateRow
                  label="純正律"
                  value={filters.justIntonation}
                  onChange={(v) => update('justIntonation', v)}
                />
                <TriStateRow
                  label="平均律"
                  value={filters.equalTemperament}
                  onChange={(v) => update('equalTemperament', v)}
                />

                <View style={styles.subBlock}>
                  <Text style={styles.subLabel}>
                    特定周波数の効果（Root Frequency）
                  </Text>
                  <View style={styles.pillRow}>
                    {ROOT_FREQUENCY_OPTIONS.map((freq) => {
                      const active = filters.rootFrequency === freq;
                      return (
                        <Pressable
                          key={freq}
                          onPress={() =>
                            update(
                              'rootFrequency',
                              active ? null : freq,
                            )
                          }
                          style={({ pressed }) => [
                            styles.pill,
                            active && styles.pillActive,
                            pressed && styles.pillPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && styles.pillTextActive,
                            ]}
                          >
                            {freq} Hz
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <View style={styles.subBlock}>
                  <Text style={styles.subLabel}>
                    脳波同調（Brainwave Entrainment）
                  </Text>
                  <View style={styles.pillRow}>
                    {BRAINWAVE_OPTIONS.map((wave) => {
                      const isOff = wave === 'OFF';
                      const active = isOff
                        ? filters.brainwaveEntrainment === null ||
                          filters.brainwaveEntrainment === 'OFF'
                        : filters.brainwaveEntrainment === wave;
                      return (
                        <Pressable
                          key={wave}
                          onPress={() =>
                            update(
                              'brainwaveEntrainment',
                              isOff ? null : wave,
                            )
                          }
                          style={({ pressed }) => [
                            styles.pill,
                            active && styles.pillActive,
                            pressed && styles.pillPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && styles.pillTextActive,
                            ]}
                          >
                            {wave}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                <TriStateRow
                  label="1/f ゆらぎ"
                  value={filters.pinkNoiseFluctuation}
                  onChange={(v) => update('pinkNoiseFluctuation', v)}
                />

                <View style={styles.subBlock}>
                  <Text style={styles.subLabel}>商用利用可</Text>
                  <View style={styles.pillRow}>
                    {[
                      { label: 'すべて', value: null },
                      { label: '無料のみ', value: false },
                      { label: '有料のみ', value: true },
                    ].map((opt) => {
                      const active = filters.paidMusic === opt.value;
                      return (
                        <Pressable
                          key={opt.label}
                          onPress={() =>
                            update(
                              'paidMusic',
                              opt.value as boolean | null,
                            )
                          }
                          style={({ pressed }) => [
                            styles.pill,
                            active && styles.pillActive,
                            pressed && styles.pillPressed,
                          ]}
                        >
                          <Text
                            style={[
                              styles.pillText,
                              active && styles.pillTextActive,
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </View>
            ) : null}

            <ConfirmButton onPress={handleClose} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Sub-components ── */

interface ConfirmButtonProps {
  onPress: () => void;
}

function ConfirmButton({ onPress }: ConfirmButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.confirmButtonWrap,
        pressed && styles.confirmButtonPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel="決定"
    >
      <LinearGradient
        colors={['#a388c8', '#9178BD']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.confirmButton}
      >
        <Text style={styles.confirmButtonText}>決定</Text>
      </LinearGradient>
    </Pressable>
  );
}

interface ToggleRowProps {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function ToggleRow({ label, value, onChange }: ToggleRowProps) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{
          false: 'rgba(200,195,215,0.5)',
          true: colors.primary,
        }}
        thumbColor={colors.white}
        ios_backgroundColor="rgba(200,195,215,0.5)"
      />
    </View>
  );
}

interface CheckboxRowProps {
  label: string;
  value: boolean;
  onChange: (next: boolean) => void;
}

function CheckboxRow({ label, value, onChange }: CheckboxRowProps) {
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        styles.checkboxItem,
        pressed && styles.checkboxItemPressed,
      ]}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
    >
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={20}
        color={value ? colors.primary : colors.textSecondary}
      />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

interface TriStateRowProps {
  label: string;
  value: boolean | null;
  onChange: (next: boolean | null) => void;
}

function TriStateRow({ label, value, onChange }: TriStateRowProps) {
  const options: ReadonlyArray<{ label: string; value: boolean | null }> = [
    { label: '指定なし', value: null },
    { label: 'ON', value: true },
    { label: 'OFF', value: false },
  ];
  return (
    <View style={styles.triRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.pillRow}>
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.label}
              onPress={() => onChange(opt.value)}
              style={({ pressed }) => [
                styles.pillSm,
                active && styles.pillActive,
                pressed && styles.pillPressed,
              ]}
            >
              <Text
                style={[
                  styles.pillTextSm,
                  active && styles.pillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

interface SingleSliderRowProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  /** Range stored in filters; we read/write a single value as [v, v]. */
  range: [number, number];
  onChange: (next: [number, number]) => void;
}

function SingleSliderRow({
  label,
  leftLabel,
  rightLabel,
  range,
  onChange,
}: SingleSliderRowProps) {
  // Use the upper bound as the single-thumb value so the default
  // [0,100] state shows the thumb at "High" — matches the screenshot
  // where untouched sliders sit at the right edge of the gradient.
  const value = range[1];

  const handleChange = useCallback(
    (next: number) => {
      const v = Math.round(next);
      onChange([v, v]);
    },
    [onChange],
  );

  return (
    <View style={styles.sliderBlock}>
      <Text style={styles.sliderLabel}>{label}</Text>
      <View style={styles.sliderRow}>
        <Text style={styles.sliderEndLabel}>{leftLabel}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={value}
          onValueChange={handleChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="rgba(200,195,215,0.5)"
          thumbTintColor={colors.primary}
        />
        <Text style={styles.sliderEndLabel}>{rightLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonPressed: {
    opacity: 0.7,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.85)',
    padding: spacing.lg,
    gap: 14,
    shadowColor: '#9b8dff',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 2,
  },
  sectionLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sectionDesc: {
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  toggleLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
    flex: 1,
    paddingRight: spacing.sm,
  },
  subBlock: {
    gap: spacing.sm,
    paddingTop: spacing.xs,
  },
  subLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  checkboxRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.lg,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xs,
    paddingRight: spacing.sm,
  },
  checkboxItemPressed: {
    opacity: 0.6,
  },
  checkboxLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(200,195,215,0.4)',
  },
  pillSm: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(200,195,215,0.4)',
  },
  pillActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  pillPressed: {
    opacity: 0.65,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  pillTextSm: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  pillTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    padding: 0,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  tag: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(200,195,215,0.4)',
  },
  tagActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  tagTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  sliderBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderEndLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    width: 36,
    textAlign: 'center',
    flexShrink: 0,
  },
  slider: {
    flex: 1,
    height: 32,
  },
  advancedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedBody: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  triRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  confirmButtonWrap: {
    marginTop: spacing.sm,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmButton: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.full,
  },
  confirmButtonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
