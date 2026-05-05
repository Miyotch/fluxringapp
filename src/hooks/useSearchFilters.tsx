import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import {
  defaultSearchFilters,
  type SearchFilters,
} from '../types/searchFilters';

/**
 * Shared search filter state for the Search tab and the Home tab.
 *
 * INTEGRATION NOTE for `frontend-developer`:
 *   The provider must be mounted high in the tree so both `(tabs)/search.tsx`
 *   and `(tabs)/index.tsx` can read it. Wrap the root stack inside
 *   `app/_layout.tsx` with `<SearchFiltersProvider>...</SearchFiltersProvider>`.
 *
 *   Example:
 *     import { SearchFiltersProvider } from '../src/hooks/useSearchFilters';
 *     ...
 *     <SearchFiltersProvider>
 *       <Stack ... />
 *     </SearchFiltersProvider>
 */

interface SearchFiltersContextValue {
  filters: SearchFilters;
  setFilters: (next: SearchFilters) => void;
  resetFilters: () => void;
  /** True if `filters` differs from `defaultSearchFilters` in any way. */
  hasActiveFilters: boolean;
}

const SearchFiltersContext = createContext<SearchFiltersContextValue | null>(null);

function isFiltersEqualToDefault(f: SearchFilters): boolean {
  const d = defaultSearchFilters;
  return (
    f.frequencyMode === d.frequencyMode &&
    f.melodyMode === d.melodyMode &&
    f.earphoneOptimized === d.earphoneOptimized &&
    f.speakerOptimized === d.speakerOptimized &&
    f.paidMusic === d.paidMusic &&
    f.keyword === d.keyword &&
    f.tags.length === 0 &&
    f.noiseLevel[0] === d.noiseLevel[0] &&
    f.noiseLevel[1] === d.noiseLevel[1] &&
    f.toneCharacter[0] === d.toneCharacter[0] &&
    f.toneCharacter[1] === d.toneCharacter[1] &&
    f.rhythmIntensity[0] === d.rhythmIntensity[0] &&
    f.rhythmIntensity[1] === d.rhythmIntensity[1] &&
    f.justIntonation === d.justIntonation &&
    f.equalTemperament === d.equalTemperament &&
    f.rootFrequency === d.rootFrequency &&
    f.brainwaveEntrainment === d.brainwaveEntrainment &&
    f.pinkNoiseFluctuation === d.pinkNoiseFluctuation
  );
}

interface SearchFiltersProviderProps {
  children: React.ReactNode;
  initialFilters?: SearchFilters;
}

export function SearchFiltersProvider({
  children,
  initialFilters,
}: SearchFiltersProviderProps) {
  const [filters, setFiltersState] = useState<SearchFilters>(
    initialFilters ?? defaultSearchFilters,
  );

  const setFilters = useCallback((next: SearchFilters) => {
    setFiltersState(next);
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState(defaultSearchFilters);
  }, []);

  const hasActiveFilters = useMemo(
    () => !isFiltersEqualToDefault(filters),
    [filters],
  );

  const value = useMemo<SearchFiltersContextValue>(
    () => ({ filters, setFilters, resetFilters, hasActiveFilters }),
    [filters, setFilters, resetFilters, hasActiveFilters],
  );

  return (
    <SearchFiltersContext.Provider value={value}>
      {children}
    </SearchFiltersContext.Provider>
  );
}

export function useSearchFilters(): SearchFiltersContextValue {
  const ctx = useContext(SearchFiltersContext);
  if (!ctx) {
    throw new Error(
      'useSearchFilters must be used inside <SearchFiltersProvider>. ' +
        'Mount the provider in app/_layout.tsx.',
    );
  }
  return ctx;
}
