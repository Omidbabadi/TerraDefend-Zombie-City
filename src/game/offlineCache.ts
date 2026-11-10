import { CitySector, UpgradeStat } from './types';
import { INITIAL_UPGRADES, PRESET_CITY_SECTORS } from './rules';

const SECTORS_STORAGE_KEY = 'sector_zero_cached_sectors_v4';
const ECONOMY_STORAGE_KEY = 'sector_zero_economy_v2';

export interface PersistedEconomyState {
  gems: number;
  scrapBank: number;
  bestScore: number;
  bestWave: number;
  upgrades: UpgradeStat[];
}

export function loadCachedSectors(): CitySector[] {
  if (typeof window === 'undefined') return PRESET_CITY_SECTORS;
  try {
    const raw = window.localStorage.getItem(SECTORS_STORAGE_KEY);
    if (!raw) return PRESET_CITY_SECTORS;
    const parsed = JSON.parse(raw) as CitySector[];
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Fallback to presets
  }
  return PRESET_CITY_SECTORS;
}

export function saveCachedSectors(sectors: CitySector[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SECTORS_STORAGE_KEY, JSON.stringify(sectors));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadPersistedEconomy(): PersistedEconomyState {
  const defaultState: PersistedEconomyState = {
    gems: 350,
    scrapBank: 600,
    bestScore: 0,
    bestWave: 1,
    upgrades: INITIAL_UPGRADES,
  };
  if (typeof window === 'undefined') return defaultState;
  try {
    const raw = window.localStorage.getItem(ECONOMY_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<PersistedEconomyState>;
    return {
      gems: typeof parsed.gems === 'number' ? parsed.gems : defaultState.gems,
      scrapBank: typeof parsed.scrapBank === 'number' ? parsed.scrapBank : defaultState.scrapBank,
      bestScore: typeof parsed.bestScore === 'number' ? parsed.bestScore : 0,
      bestWave: typeof parsed.bestWave === 'number' ? parsed.bestWave : 1,
      upgrades: Array.isArray(parsed.upgrades) ? parsed.upgrades : INITIAL_UPGRADES,
    };
  } catch {
    return defaultState;
  }
}

export function savePersistedEconomy(state: PersistedEconomyState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ECONOMY_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}
