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
  '#瞑想',
  '#リラックス',
  '#朝活',
  '#ヒーリング',
  '#脳波調整',
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

const PAID_OPTIONS: ReadonlyArray<{ label: string; value: boolean | null }> = [
  { label: 'すべて', value: null },
  { label: '無料のみ', value: false },
  { label: '有料のみ', value: true },
];

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { filters, setFilters, resetFilters, hasActiveFilters } = useSearchFilters();
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

  const handleSubmit = useCallback(() => {
    router.push('/(tabs)');
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
          {hasActiveFilters ? (
            <Pressable
              onPress={resetFilters}
              style={({ pressed }) => [
                styles.resetButton,
                pressed && styles.resetButtonPressed,
              ]}
            >
              <Ionicons
                name="refresh"
                size={16}
                color={colors.textPrimary}
              />
              <Text style={styles.resetButtonText}>リセット</Text>
            </Pressable>
          ) : null}
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
          {/* ── Section: モード・再生環境 ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>モード・再生環境</Text>

            <ToggleRow
              label="周波数モード（Frequency）"
              value={filters.frequencyMode}
              onChange={(v) => update('frequencyMode', v)}
            />
            <ToggleRow
              label="旋律モード（Melody）"
              value={filters.melodyMode}
              onChange={(v) => update('melodyMode', v)}
            />
            <ToggleRow
              label="イヤホン最適化"
              value={filters.earphoneOptimized}
              onChange={(v) => update('earphoneOptimized', v)}
            />
            <ToggleRow
              label="スピーカー最適化"
              value={filters.speakerOptimized}
              onChange={(v) => update('speakerOptimized', v)}
            />

            <View style={styles.subBlock}>
              <Text style={styles.subLabel}>商用利用可</Text>
              <View style={styles.pillRow}>
                {PAID_OPTIONS.map((opt) => {
                  const active = filters.paidMusic === opt.value;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => update('paidMusic', opt.value)}
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

          {/* ── Section: 目的から選ぶ ── */}
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
          </View>

          {/* ── Section: 空間を調律する ── */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>空間を調律する</Text>
            <Text style={styles.sectionDesc}>
              スライダー操作で、言葉にできない「今の空気感」を即座に音へ反映。
            </Text>

            <RangeSliderRow
              label="周囲のノイズレベル"
              leftLabel="Low"
              rightLabel="High"
              range={filters.noiseLevel}
              onChange={(r) => update('noiseLevel', r)}
            />
            <RangeSliderRow
              label="音色特性（Tone）"
              leftLabel="Cool"
              rightLabel="Warm"
              range={filters.toneCharacter}
              onChange={(r) => update('toneCharacter', r)}
            />
            <RangeSliderRow
              label="リズム調整"
              leftLabel="Ambient"
              rightLabel="Rhythmic"
              range={filters.rhythmIntensity}
              onChange={(r) => update('rhythmIntensity', r)}
            />
          </View>

          {/* ── Section: 深層設定 ── */}
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
              </View>
            ) : null}
          </View>

          {/* ── Footer: 決定 ── */}
          <Pressable
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.confirmButton,
              pressed && styles.confirmButtonPressed,
            ]}
          >
            <Text style={styles.confirmButtonText}>決定</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}

/* ── Sub-components ── */

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

interface RangeSliderRowProps {
  label: string;
  leftLabel: string;
  rightLabel: string;
  range: [number, number];
  onChange: (next: [number, number]) => void;
}

function RangeSliderRow({
  label,
  leftLabel,
  rightLabel,
  range,
  onChange,
}: RangeSliderRowProps) {
  const [minVal, maxVal] = range;

  const handleMinChange = useCallback(
    (next: number) => {
      const clamped = Math.min(next, maxVal);
      onChange([Math.round(clamped), maxVal]);
    },
    [maxVal, onChange],
  );

  const handleMaxChange = useCallback(
    (next: number) => {
      const clamped = Math.max(next, minVal);
      onChange([minVal, Math.round(clamped)]);
    },
    [minVal, onChange],
  );

  return (
    <View style={styles.sliderBlock}>
      <View style={styles.sliderHeader}>
        <Text style={styles.sliderLabel}>{label}</Text>
        <Text style={styles.sliderValue}>
          {minVal} – {maxVal}
        </Text>
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderEndLabel}>下限 {leftLabel}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={minVal}
          onValueChange={handleMinChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="rgba(200,195,215,0.5)"
          thumbTintColor={colors.primary}
        />
      </View>

      <View style={styles.sliderRow}>
        <Text style={styles.sliderEndLabel}>上限 {rightLabel}</Text>
        <Slider
          style={styles.slider}
          minimumValue={0}
          maximumValue={100}
          step={1}
          value={maxVal}
          onValueChange={handleMaxChange}
          minimumTrackTintColor={colors.primary}
          maximumTrackTintColor="rgba(200,195,215,0.5)"
          thumbTintColor={colors.primary}
        />
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
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.glassBorder,
  },
  resetButtonPressed: {
    opacity: 0.7,
  },
  resetButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  section: {
    backgroundColor: colors.glass,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.glassBorder,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionLabel: {
    fontSize: 14,
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
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
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
    paddingVertical: 5,
    borderRadius: borderRadius.full,
    backgroundColor: 'rgba(145,120,189,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(145,120,189,0.2)',
  },
  tagActive: {
    backgroundColor: colors.primaryMuted,
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.primary,
  },
  tagTextActive: {
    color: colors.white,
    fontWeight: '600',
  },
  sliderBlock: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sliderLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sliderValue: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  sliderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderEndLabel: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.textSecondary,
    width: 80,
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
  confirmButton: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  confirmButtonPressed: {
    opacity: 0.85,
  },
  confirmButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 1,
  },
});
