/**
 * Shared search filter shape used by the Search tab and the Home tab.
 *
 * Mirrors the original web app's `SearchFilters` (see
 * `.reference/web/src/components/search/SearchModal.tsx`) but normalises slider
 * values to `[min, max]` ranges so the Home screen can quickly check whether a
 * filter is "active" (i.e. tighter than the full 0..100 span).
 *
 * Tri-state booleans (`boolean | null`) follow the original convention:
 *   - `true`  → require the property
 *   - `false` → require the property to be absent
 *   - `null`  → don't filter on this property (any value is fine)
 */
export interface SearchFilters {
  /** Mode toggles — true means "only tracks with this mode". */
  frequencyMode: boolean;
  melodyMode: boolean;

  /** Playback environment — true means "only tracks optimised for this env". */
  earphoneOptimized: boolean;
  speakerOptimized: boolean;

  /** Paid-music filter. `null` = any, `true` = paid only, `false` = free only. */
  paidMusic: boolean | null;

  /** Free-text keyword search across title / artist / description. */
  keyword: string;

  /** Quick tags (e.g. '#528Hz', '#安眠'). Empty array = no tag filter. */
  tags: string[];

  /** Range filters [min, max] over 0..100. Full-span = inactive. */
  noiseLevel: [number, number];
  toneCharacter: [number, number];
  rhythmIntensity: [number, number];

  /** Advanced protocol — tri-state. */
  justIntonation: boolean | null;
  equalTemperament: boolean | null;

  /** Root frequency string (e.g. '440', '432'). `null` = any. */
  rootFrequency: string | null;

  /** Brainwave entrainment label (e.g. 'OFF', 'Alpha', 'Theta'). `null` = any. */
  brainwaveEntrainment: string | null;

  /** 1/f fluctuation tri-state. */
  pinkNoiseFluctuation: boolean | null;
}

/**
 * Inactive / "show everything" baseline.  A `SearchFilters` value equal to this
 * constant means no filtering is applied.
 */
export const defaultSearchFilters: SearchFilters = {
  frequencyMode: false,
  melodyMode: false,
  earphoneOptimized: false,
  speakerOptimized: false,
  paidMusic: null,
  keyword: '',
  tags: [],
  noiseLevel: [0, 100],
  toneCharacter: [0, 100],
  rhythmIntensity: [0, 100],
  justIntonation: null,
  equalTemperament: null,
  rootFrequency: null,
  brainwaveEntrainment: null,
  pinkNoiseFluctuation: null,
};
