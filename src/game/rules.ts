import {
  CachedSectorRoad,
  CitySector,
  DeployableBlueprint,
  DeployableId,
  PlacementValidationResult,
  StorePack,
  UpgradeStat,
  ZombieArchetype,
} from './types';

export const DEPLOYABLE_BLUEPRINTS: Record<DeployableId, DeployableBlueprint> = {
  rotary_turret: {
    id: 'rotary_turret',
    name: 'Rotary Turret',
    keyBinding: '1',
    roleClue: 'Curbside Point Defense',
    category: 'tower',
    baseCost: 115,
    range: 135,
    damage: 15,
    fireRate: 3.1,
    color: '#38bdf8',
  },
  sniper_nest: {
    id: 'sniper_nest',
    name: 'Rail Sniper Nest',
    keyBinding: '2',
    roleClue: 'Rooftop Armor Piercer',
    category: 'tower',
    baseCost: 185,
    range: 245,
    damage: 78,
    fireRate: 0.68,
    color: '#f59e0b',
  },
  emp_pylon: {
    id: 'emp_pylon',
    name: 'Cryo EMP Pylon',
    keyBinding: '3',
    roleClue: 'Area Crowd Slow & Shock',
    category: 'tower',
    baseCost: 160,
    range: 118,
    damage: 12,
    fireRate: 1.15,
    color: '#a855f7',
  },
  rifle_squad: {
    id: 'rifle_squad',
    name: 'Mobile Strike Squad',
    keyBinding: '4',
    roleClue: 'Street Intercept & Guard',
    category: 'troop',
    baseCost: 140,
    range: 125,
    damage: 14,
    fireRate: 2.5,
    color: '#10b981',
  },
  airstrike: {
    id: 'airstrike',
    name: 'Orbital Napalm Strike',
    keyBinding: '5',
    roleClue: 'Heavy Area Bombardment',
    category: 'ability',
    baseCost: 225,
    range: 105,
    damage: 240,
    fireRate: 1,
    color: '#ef4444',
  },
};

export const INITIAL_UPGRADES: UpgradeStat[] = [
  {
    id: 'turret_damage',
    name: 'Tungsten Core Rounds',
    description: 'Increases all deployed tower ballistic & rail damage.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 50,
    baseCostScrap: 150,
    bonusPerLevel: 0.15,
    unitLabel: '+15% Tower DMG',
  },
  {
    id: 'troop_Training',
    name: 'Exoskeleton Squad Rig',
    description: 'Boosts mobile strike squad vitality, range, and fire rate.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 60,
    baseCostScrap: 180,
    bonusPerLevel: 0.18,
    unitLabel: '+18% Squad Power',
  },
  {
    id: 'base_fortification',
    name: 'Titanium Command Bulkhead',
    description:
      'Reinforces HQ command bunker HP, expands Power Grid slots, and upgrades the HQ Point-Defense Auto-Cannon.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 40,
    baseCostScrap: 120,
    bonusPerLevel: 250,
    unitLabel: '+250 HP & HQ Cannon',
  },
  {
    id: 'salvage_scanner',
    name: 'Automated Drone Salvage',
    description: 'Increases Scrap harvested from every eliminated zombie.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 75,
    baseCostScrap: 200,
    bonusPerLevel: 0.2,
    unitLabel: '+20% Scrap Yield',
  },
];

export const STORE_PACKS: StorePack[] = [
  {
    id: 'starter_drop',
    name: 'Tactical Supply Drop',
    subtitle: 'Instant emergency Scrap & Bio-Core Gems for field deployment',
    gemsReward: 150,
    scrapReward: 400,
    priceTag: 'FREE DAILY DROP',
    badgeText: 'Instant Supply',
  },
  {
    id: 'commander_crate',
    name: 'Sector Commander Crate',
    subtitle: 'High-grade Bio-Core Gems & heavy fortification salvage bundle',
    gemsReward: 500,
    scrapReward: 1200,
    priceTag: 'VIRTUAL SANDBOX CRATE',
    badgeText: 'Most Popular',
  },
  {
    id: 'orbital_vault',
    name: 'Aegis Orbital Warchest',
    subtitle: 'Massive reserve of Bio-Core Gems to max out sector upgrades',
    gemsReward: 1500,
    scrapReward: 3500,
    priceTag: 'VIRTUAL SANDBOX VAULT',
    badgeText: 'Best Value',
  },
];

// Geographic projection helpers: map real-world LatLng road vertices onto the [0..1] tactical sector viewport
const DEFAULT_HALF_SPAN_LAT = 0.0052; // ~580m half-height at zoom 16

export function projectLatLngToSectorPoint(
  lat: number,
  lng: number,
  centerLat: number,
  centerLng: number,
  halfSpanLat = DEFAULT_HALF_SPAN_LAT
): { x: number; y: number } {
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const halfSpanLng = (halfSpanLat / cosLat) * 1.45;
  const rawX = 0.5 + (lng - centerLng) / (2 * halfSpanLng);
  const rawY = 0.5 - (lat - centerLat) / (2 * halfSpanLat);
  return {
    x: Number(Math.max(0.03, Math.min(0.97, rawX)).toFixed(4)),
    y: Number(Math.max(0.03, Math.min(0.97, rawY)).toFixed(4)),
  };
}

export function unprojectSectorPointToLatLng(
  x: number,
  y: number,
  centerLat: number,
  centerLng: number,
  halfSpanLat = DEFAULT_HALF_SPAN_LAT
): { lat: number; lng: number } {
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const halfSpanLng = (halfSpanLat / cosLat) * 1.45;
  return {
    lat: Number((centerLat + (0.5 - y) * 2 * halfSpanLat).toFixed(6)),
    lng: Number((centerLng + (x - 0.5) * 2 * halfSpanLng).toFixed(6)),
  };
}

/**
 * Converts a sequence of real-world GPS road coordinates from Google Maps Routes API
 * into a multi-segment tactical road corridor ending at the HQ center (0.5, 0.5).
 */
export function convertLatLngPathToSectorRoad(
  id: string,
  name: string,
  latLngPath: { lat: number; lng: number }[],
  centerLat: number,
  centerLng: number,
  distanceMeters?: number
): CachedSectorRoad {
  if (!latLngPath || latLngPath.length === 0) {
    return {
      id,
      name,
      points: [
        { x: 0.1, y: 0.1 },
        { x: 0.5, y: 0.5 },
      ],
      width: 24,
    };
  }

  const projected: { x: number; y: number }[] = [];
  const cleanLatLng: { lat: number; lng: number }[] = [];

  for (const pt of latLngPath) {
    const norm = projectLatLngToSectorPoint(pt.lat, pt.lng, centerLat, centerLng);
    const prev = projected[projected.length - 1];
    // Deduplicate points that are extremely close so zombies move smoothly around real road turns
    if (!prev || Math.hypot(norm.x - prev.x, norm.y - prev.y) >= 0.018) {
      projected.push(norm);
      cleanLatLng.push({ lat: pt.lat, lng: pt.lng });
    }
  }

  // Ensure final waypoint locks onto HQ Command Bunker at (0.5, 0.5)
  const last = projected[projected.length - 1];
  if (!last || Math.hypot(last.x - 0.5, last.y - 0.5) > 0.015) {
    projected.push({ x: 0.5, y: 0.5 });
    cleanLatLng.push({ lat: centerLat, lng: centerLng });
  }

  return {
    id,
    name,
    points: projected,
    latLngPoints: cleanLatLng,
    width: 24,
    distanceMeters,
  };
}

/**
 * Generates 4 cardinal/diagonal perimeter spawn origin coordinates around a sector's HQ
 * so Google Maps `Route.computeRoutes` can trace real-world street paths from all 4 directions into HQ.
 */
export function getPerimeterRoadSpawnOrigins(
  centerLat: number,
  centerLng: number,
  halfSpanLat = DEFAULT_HALF_SPAN_LAT * 0.85
): { id: string; name: string; origin: { lat: number; lng: number } }[] {
  const cosLat = Math.max(0.2, Math.cos((centerLat * Math.PI) / 180));
  const halfSpanLng = (halfSpanLat / cosLat) * 1.35;

  return [
    {
      id: 'road_nw',
      name: 'NW Real-Road Approach',
      origin: { lat: centerLat + halfSpanLat, lng: centerLng - halfSpanLng * 0.65 },
    },
    {
      id: 'road_ne',
      name: 'NE Real-Road Approach',
      origin: { lat: centerLat + halfSpanLat * 0.75, lng: centerLng + halfSpanLng },
    },
    {
      id: 'road_se',
      name: 'SE Real-Road Approach',
      origin: { lat: centerLat - halfSpanLat, lng: centerLng + halfSpanLng * 0.6 },
    },
    {
      id: 'road_sw',
      name: 'SW Real-Road Approach',
      origin: { lat: centerLat - halfSpanLat * 0.75, lng: centerLng - halfSpanLng },
    },
  ];
}

export const PRESET_CITY_SECTORS: CitySector[] = [
  {
    id: 'manhattan_midtown',
    name: 'Midtown Grid Sector 04',
    city: 'New York, USA',
    lat: 40.758,
    lng: -73.9855,
    zoom: 16,
    cachedAt: 1730980000000,
    tileSizeKb: 4280,
    threatRating: 'MODERATE · REAL MANHATTAN STREET GRID',
    realRoadSynced: true,
    roads: [
      convertLatLngPathToSectorRoad(
        'broadway_north',
        'Broadway & W 47th St Real Road',
        [
          { lat: 40.7624, lng: -73.9850 },
          { lat: 40.7610, lng: -73.9853 },
          { lat: 40.7598, lng: -73.9854 },
          { lat: 40.7589, lng: -73.9855 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        510
      ),
      convertLatLngPathToSectorRoad(
        'eighth_ave_west',
        '8th Ave -> W 44th St Real Road',
        [
          { lat: 40.7605, lng: -73.9912 },
          { lat: 40.7591, lng: -73.9892 },
          { lat: 40.7591, lng: -73.9873 },
          { lat: 40.7584, lng: -73.9862 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        640
      ),
      convertLatLngPathToSectorRoad(
        'sixth_ave_east',
        'Ave of the Americas -> W 46th St Real Road',
        [
          { lat: 40.7602, lng: -73.9795 },
          { lat: 40.7588, lng: -73.9815 },
          { lat: 40.7588, lng: -73.9838 },
          { lat: 40.7582, lng: -73.9848 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        590
      ),
      convertLatLngPathToSectorRoad(
        'seventh_ave_south',
        '7th Ave -> W 42nd St Real Road',
        [
          { lat: 40.7535, lng: -73.9882 },
          { lat: 40.7552, lng: -73.9868 },
          { lat: 40.7564, lng: -73.9862 },
          { lat: 40.7573, lng: -73.9858 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        540
      ),
    ],
    blocks: [
      { id: 'b1', x: 0.14, y: 0.12, w: 0.14, h: 0.12, heightLevel: 3, type: 'commercial' },
      { id: 'b2', x: 0.58, y: 0.14, w: 0.18, h: 0.14, heightLevel: 4, type: 'commercial' },
      { id: 'b3', x: 0.14, y: 0.56, w: 0.16, h: 0.16, heightLevel: 3, type: 'commercial' },
      { id: 'b4', x: 0.64, y: 0.62, w: 0.20, h: 0.18, heightLevel: 1, type: 'park' },
    ],
  },
  {
    id: 'shibuya_crossing',
    name: 'Shibuya Scramble Hub',
    city: 'Tokyo, Japan',
    lat: 35.6595,
    lng: 139.7004,
    zoom: 16,
    cachedAt: 1730980000000,
    tileSizeKb: 5120,
    threatRating: 'HIGH · REAL SHIBUYA 5-WAY ARTERIES',
    realRoadSynced: true,
    roads: [
      convertLatLngPathToSectorRoad(
        'dogenzaka',
        'Dogenzaka Real Corridor',
        [
          { lat: 35.6582, lng: 139.6952 },
          { lat: 35.6587, lng: 139.6972 },
          { lat: 35.6591, lng: 139.6989 },
          { lat: 35.6595, lng: 139.7004 },
        ],
        35.6595,
        139.7004,
        520
      ),
      convertLatLngPathToSectorRoad(
        'koen_dori_north',
        'Koen-Dori & Jinnan Real Street',
        [
          { lat: 35.6638, lng: 139.6992 },
          { lat: 35.6622, lng: 139.6998 },
          { lat: 35.6608, lng: 139.7001 },
          { lat: 35.6595, lng: 139.7004 },
        ],
        35.6595,
        139.7004,
        490
      ),
      convertLatLngPathToSectorRoad(
        'meiji_dori_east',
        'Meiji-Dori & Miyamasuzaka Real Road',
        [
          { lat: 35.6612, lng: 139.7058 },
          { lat: 35.6604, lng: 139.7038 },
          { lat: 35.6599, lng: 139.7019 },
          { lat: 35.6595, lng: 139.7004 },
        ],
        35.6595,
        139.7004,
        560
      ),
      convertLatLngPathToSectorRoad(
        'route_246_south',
        'Route 246 Aoyama-Dori Real Viaduct',
        [
          { lat: 35.6552, lng: 139.7026 },
          { lat: 35.6568, lng: 139.7016 },
          { lat: 35.6582, lng: 139.7009 },
          { lat: 35.6595, lng: 139.7004 },
        ],
        35.6595,
        139.7004,
        530
      ),
    ],
    blocks: [
      { id: 's1', x: 0.56, y: 0.12, w: 0.16, h: 0.16, heightLevel: 4, type: 'commercial' },
      { id: 's2', x: 0.12, y: 0.18, w: 0.18, h: 0.20, heightLevel: 3, type: 'commercial' },
      { id: 's3', x: 0.72, y: 0.56, w: 0.18, h: 0.18, heightLevel: 4, type: 'industrial' },
    ],
  },
  {
    id: 'london_soho',
    name: 'Piccadilly & Soho Bastion',
    city: 'London, UK',
    lat: 51.5101,
    lng: -0.134,
    zoom: 16,
    cachedAt: null,
    tileSizeKb: 3890,
    threatRating: 'EXTREME · REAL REGENT & SHAFTESBURY ROADS',
    realRoadSynced: true,
    roads: [
      convertLatLngPathToSectorRoad(
        'regent_st_north',
        'Regent Street Quadrant Real Road',
        [
          { lat: 51.5142, lng: -0.1388 },
          { lat: 51.5126, lng: -0.1372 },
          { lat: 51.5112, lng: -0.1355 },
          { lat: 51.5101, lng: -0.1340 },
        ],
        51.5101,
        -0.134,
        580
      ),
      convertLatLngPathToSectorRoad(
        'shaftesbury_east',
        'Shaftesbury Ave Real Road',
        [
          { lat: 51.5124, lng: -0.1278 },
          { lat: 51.5116, lng: -0.1301 },
          { lat: 51.5108, lng: -0.1322 },
          { lat: 51.5101, lng: -0.1340 },
        ],
        51.5101,
        -0.134,
        540
      ),
      convertLatLngPathToSectorRoad(
        'piccadilly_west',
        'Piccadilly Real Thoroughfare',
        [
          { lat: 51.5076, lng: -0.1405 },
          { lat: 51.5085, lng: -0.1382 },
          { lat: 51.5093, lng: -0.1360 },
          { lat: 51.5101, lng: -0.1340 },
        ],
        51.5101,
        -0.134,
        550
      ),
      convertLatLngPathToSectorRoad(
        'haymarket_south',
        'Haymarket & Coventry St Real Road',
        [
          { lat: 51.5062, lng: -0.1315 },
          { lat: 51.5078, lng: -0.1321 },
          { lat: 51.5094, lng: -0.1327 },
          { lat: 51.5101, lng: -0.1340 },
        ],
        51.5101,
        -0.134,
        490
      ),
    ],
    blocks: [
      { id: 'l1', x: 0.36, y: 0.12, w: 0.20, h: 0.14, heightLevel: 3, type: 'commercial' },
      { id: 'l2', x: 0.10, y: 0.44, w: 0.16, h: 0.18, heightLevel: 2, type: 'park' },
      { id: 'l3', x: 0.70, y: 0.54, w: 0.18, h: 0.18, heightLevel: 3, type: 'commercial' },
    ],
  },
];

export function calculateUpgradeCost(stat: UpgradeStat): {
  gems: number;
  scrap: number;
} {
  const multiplier = Math.pow(1.38, stat.level - 1);
  return {
    gems: Math.round(stat.baseCostGems * multiplier),
    scrap: Math.round(stat.baseCostScrap * multiplier),
  };
}

/**
 * Computes progressive construction cost based on how many units of the same blueprint
 * are already deployed on the map (+38% per existing tower/squad of the same type).
 */
export function getDynamicDeployCost(
  blueprintId: DeployableId,
  existingCountOfSameType = 0
): number {
  const bp = DEPLOYABLE_BLUEPRINTS[blueprintId];
  if (!bp) return 999;
  const growthFactor = bp.category === 'ability' ? 1.15 : 1.38;
  return Math.round(
    bp.baseCost * Math.pow(growthFactor, Math.max(0, existingCountOfSameType))
  );
}

export function canAffordDeployable(
  scrap: number,
  blueprintId: DeployableId,
  existingCountOfSameType = 0
): boolean {
  const cost = getDynamicDeployCost(blueprintId, existingCountOfSameType);
  return scrap >= cost;
}

/**
 * Maximum number of static towers the sector command power grid can support simultaneously.
 * Starts at 6 towers; expands by +1 slot every 2 levels of Titanium Command Bulkhead.
 */
export function getMaxTowerSlots(upgrades: UpgradeStat[]): number {
  const fort = upgrades.find((u) => u.id === 'base_fortification');
  const level = fort ? fort.level : 1;
  return 6 + Math.floor((level - 1) / 2);
}

export function pointToSegmentDistance(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

/**
 * Enforces tactical city placement constraints for static towers:
 * 1. Sector Power Grid cap (max active towers)
 * 2. Safe viewport perimeter margin
 * 3. HQ Command Bunker exclusion buffer
 * 4. Zombie Spawn Breach exclusion buffer
 * 5. Cannot build directly on real-world road asphalt (must build on curbs/rooftops/blocks)
 * 6. Minimum spacing between adjacent towers (no stacking)
 */
export function validateTowerPlacement(
  normX: number,
  normY: number,
  sector: CitySector,
  existingTowers: { x: number; y: number }[],
  maxTowers = 6
): PlacementValidationResult {
  if (existingTowers.length >= maxTowers) {
    return {
      valid: false,
      reason: `POWER GRID FULL (${existingTowers.length}/${maxTowers} TOWERS)`,
    };
  }

  if (normX < 0.04 || normX > 0.96 || normY < 0.06 || normY > 0.92) {
    return { valid: false, reason: 'OUTSIDE SECTOR PERIMETER' };
  }

  const distToHq = Math.hypot(normX - 0.5, normY - 0.5);
  if (distToHq < 0.068) {
    return { valid: false, reason: 'BLOCKED: HQ BUNKER PERIMETER' };
  }

  for (const road of sector.roads) {
    if (road.points.length > 0) {
      const spawn = road.points[0];
      if (Math.hypot(normX - spawn.x, normY - spawn.y) < 0.065) {
        return { valid: false, reason: 'BLOCKED: HOSTILE SPAWN BREACH' };
      }
    }
    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];
      const dRoad = pointToSegmentDistance(normX, normY, p1.x, p1.y, p2.x, p2.y);
      if (dRoad < 0.031) {
        return { valid: false, reason: 'BLOCKED: STREET ASPHALT CORRIDOR' };
      }
    }
  }

  for (const t of existingTowers) {
    if (Math.hypot(normX - t.x, normY - t.y) < 0.062) {
      return { valid: false, reason: 'BLOCKED: TOO CLOSE TO TOWER' };
    }
  }

  return { valid: true, reason: 'ROOFTOP / CURB SITE CLEAR' };
}

export function getEffectiveTowerStats(
  blueprintId: DeployableId,
  towerLevel: number,
  upgrades: UpgradeStat[]
): {
  damage: number;
  range: number;
  fireRate: number;
  maxHp: number;
  upgradeCostScrap: number;
} {
  const bp = DEPLOYABLE_BLUEPRINTS[blueprintId];
  const dmgUpgrade = upgrades.find((u) => u.id === 'turret_damage');
  const globalMultiplier =
    1 + ((dmgUpgrade ? dmgUpgrade.level : 1) - 1) * (dmgUpgrade?.bonusPerLevel ?? 0.15);
  const levelMultiplier = 1 + (towerLevel - 1) * 0.26;

  return {
    damage: Math.round(bp.damage * globalMultiplier * levelMultiplier),
    range: Math.round(bp.range * (1 + (towerLevel - 1) * 0.055)),
    fireRate: Number((bp.fireRate * (1 + (towerLevel - 1) * 0.07)).toFixed(2)),
    maxHp: Math.round(220 * (1 + (towerLevel - 1) * 0.35)),
    upgradeCostScrap: Math.round(bp.baseCost * 0.95 * Math.pow(1.45, towerLevel - 1)),
  };
}

export function getMaxBaseHp(upgrades: UpgradeStat[]): number {
  const fort = upgrades.find((u) => u.id === 'base_fortification');
  const bonus = fort ? (fort.level - 1) * fort.bonusPerLevel : 0;
  return 1000 + bonus;
}

/**
 * Returns the active weapon statistics for the central HQ Command Bunker's
 * automated CIWS Point-Defense Cannon. Scales with Titanium Command Bulkhead
 * and Tungsten Core Rounds upgrades.
 */
export function getHqDefenseWeaponStats(upgrades: UpgradeStat[]): {
  damage: number;
  range: number;
  fireRate: number;
} {
  const fort = upgrades.find((u) => u.id === 'base_fortification');
  const dmgUpgrade = upgrades.find((u) => u.id === 'turret_damage');
  const fortLevel = fort ? fort.level : 1;
  const dmgLevel = dmgUpgrade ? dmgUpgrade.level : 1;

  const damageMult =
    1 + (dmgLevel - 1) * (dmgUpgrade?.bonusPerLevel ?? 0.15) + (fortLevel - 1) * 0.1;
  return {
    damage: Math.round(24 * damageMult),
    range: Math.round(168 + (fortLevel - 1) * 10),
    fireRate: Number((2.35 * (1 + (fortLevel - 1) * 0.1)).toFixed(2)),
  };
}

export function getScrapRewardWithBonus(
  baseScrap: number,
  upgrades: UpgradeStat[]
): number {
  const scanner = upgrades.find((u) => u.id === 'salvage_scanner');
  const mult =
    1 + ((scanner ? scanner.level : 1) - 1) * (scanner?.bonusPerLevel ?? 0.2);
  return Math.round(baseScrap * mult);
}

export interface WaveDifficultyScaling {
  waveNumber: number;
  hostileCount: number;
  hpMultiplier: number;
  speedMultiplier: number;
  damageMultiplier: number;
  spawnIntervalSeconds: number;
  waveClearScrapBonus: number;
  waveClearGemsBonus: number;
}

export function getWaveDifficultyScaling(waveNumber: number): WaveDifficultyScaling {
  const w = Math.max(1, waveNumber);
  // High-tension endless scaling: steeper HP, speed, and damage escalation per wave
  const hpMultiplier = Number((Math.pow(1.24, w - 1) + (w - 1) * 0.22).toFixed(2));
  const speedMultiplier = Number(Math.min(2.35, 1 + (w - 1) * 0.055).toFixed(2));
  const damageMultiplier = Number((1 + (w - 1) * 0.16).toFixed(2));
  const hostileCount = Math.round(11 + w * 4 + Math.floor(Math.pow(w, 1.42)));
  const spawnIntervalSeconds = Number(
    Math.max(0.16, 1.18 * Math.pow(0.89, w - 1)).toFixed(2)
  );

  return {
    waveNumber: w,
    hostileCount,
    hpMultiplier,
    speedMultiplier,
    damageMultiplier,
    spawnIntervalSeconds,
    waveClearScrapBonus: 32 + w * 12,
    waveClearGemsBonus: 10 + Math.floor(w * 3),
  };
}

export function createZombieWaveComposition(waveNumber: number): ZombieArchetype[] {
  const scaling = getWaveDifficultyScaling(waveNumber);
  const w = scaling.waveNumber;
  const count = scaling.hostileCount;
  const list: ZombieArchetype[] = [];

  for (let i = 0; i < count; i++) {
    // Juggernauts and Spitters appear earlier and more frequently in endless waves
    const juggernautMod = Math.max(3, 7 - Math.floor(w / 3));
    const spitterMod = Math.max(2, 5 - Math.floor(w / 4));

    if (w >= 2 && i > 0 && i % juggernautMod === 0) {
      list.push('juggernaut');
    } else if (w >= 2 && i % spitterMod === 0) {
      list.push('spitter');
    } else if (i % 2 === 0 && w >= 3) {
      list.push('runner');
    } else if (i % 3 === 0) {
      list.push('runner');
    } else {
      list.push('walker');
    }
  }
  return list;
}

export function buildProceduralSectorFromCoords(
  name: string,
  city: string,
  lat: number,
  lng: number,
  zoom = 16,
  realRoads?: CachedSectorRoad[]
): CitySector {
  const seed = Math.abs(Math.sin(lat * 12.9898 + lng * 78.233) * 43758.5453);
  const frac = (n: number) => ((seed * n) % 1 + 1) % 1;

  const fallbackRoads: CachedSectorRoad[] = [
    convertLatLngPathToSectorRoad(
      'north_artery',
      'Northern Urban Street',
      [
        unprojectSectorPointToLatLng(0.16, 0.06, lat, lng),
        unprojectSectorPointToLatLng(0.24, 0.26, lat, lng),
        unprojectSectorPointToLatLng(0.38, 0.26, lat, lng),
        unprojectSectorPointToLatLng(0.38, 0.44, lat, lng),
        { lat, lng },
      ],
      lat,
      lng
    ),
    convertLatLngPathToSectorRoad(
      'east_boulevard',
      'Eastern Transit Road',
      [
        unprojectSectorPointToLatLng(0.94, 0.24, lat, lng),
        unprojectSectorPointToLatLng(0.76, 0.24, lat, lng),
        unprojectSectorPointToLatLng(0.76, 0.42, lat, lng),
        unprojectSectorPointToLatLng(0.60, 0.42, lat, lng),
        { lat, lng },
      ],
      lat,
      lng
    ),
    convertLatLngPathToSectorRoad(
      'south_avenue',
      'Southern Main Avenue',
      [
        unprojectSectorPointToLatLng(0.56, 0.94, lat, lng),
        unprojectSectorPointToLatLng(0.56, 0.72, lat, lng),
        unprojectSectorPointToLatLng(0.46, 0.72, lat, lng),
        unprojectSectorPointToLatLng(0.46, 0.56, lat, lng),
        { lat, lng },
      ],
      lat,
      lng
    ),
    convertLatLngPathToSectorRoad(
      'west_expressway',
      'Western Cross Street',
      [
        unprojectSectorPointToLatLng(0.06, 0.70, lat, lng),
        unprojectSectorPointToLatLng(0.26, 0.70, lat, lng),
        unprojectSectorPointToLatLng(0.26, 0.54, lat, lng),
        unprojectSectorPointToLatLng(0.42, 0.54, lat, lng),
        { lat, lng },
      ],
      lat,
      lng
    ),
  ];

  const roads = realRoads && realRoads.length > 0 ? realRoads : fallbackRoads;

  return {
    id: `sector_${Math.round(lat * 1000)}_${Math.round(lng * 1000)}`,
    name: name || 'Custom Tactical Sector',
    city: city || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
    lat,
    lng,
    zoom,
    cachedAt: Date.now(),
    tileSizeKb: 3600 + Math.round(frac(5.7) * 1800),
    threatRating:
      realRoads && realRoads.length > 0
        ? 'GOOGLE ROUTES API · REAL STREET GEOMETRY'
        : 'URBAN GRID · CACHED STREET CORRIDORS',
    realRoadSynced: Boolean(realRoads && realRoads.length > 0),
    roads,
    blocks: [
      { id: 'cb1', x: 0.14, y: 0.14, w: 0.16, h: 0.16, heightLevel: 3, type: 'commercial' },
      { id: 'cb2', x: 0.62, y: 0.12, w: 0.2, h: 0.16, heightLevel: 4, type: 'commercial' },
      { id: 'cb3', x: 0.12, y: 0.72, w: 0.2, h: 0.16, heightLevel: 2, type: 'industrial' },
      { id: 'cb4', x: 0.68, y: 0.68, w: 0.18, h: 0.18, heightLevel: 1, type: 'park' },
    ],
  };
}
