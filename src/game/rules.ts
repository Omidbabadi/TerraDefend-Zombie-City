import {
  CachedSectorRoad,
  CitySector,
  DeployableBlueprint,
  DeployableId,
  FortressZone,
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
    roleClue: 'Rapid Point-Defense Tower',
    category: 'tower',
    baseCost: 100,
    range: 140,
    damage: 16,
    fireRate: 3.2,
    color: '#38bdf8',
  },
  sniper_nest: {
    id: 'sniper_nest',
    name: 'Rail Sniper Tower',
    keyBinding: '2',
    roleClue: 'Long-Range Armor Piercer',
    category: 'tower',
    baseCost: 160,
    range: 250,
    damage: 82,
    fireRate: 0.72,
    color: '#f59e0b',
  },
  emp_pylon: {
    id: 'emp_pylon',
    name: 'Cryo EMP Tower',
    keyBinding: '3',
    roleClue: 'Area Crowd Slow & Shock',
    category: 'tower',
    baseCost: 145,
    range: 122,
    damage: 14,
    fireRate: 1.2,
    color: '#a855f7',
  },
  fortress: {
    id: 'fortress',
    name: 'Heavy Fortress',
    keyBinding: '4',
    roleClue: 'Armored Bastion · Dual Cannons (680 HP)',
    category: 'fortress',
    baseCost: 190,
    range: 195,
    damage: 38,
    fireRate: 2.8,
    color: '#fb923c',
    controlRadius: 0.16,
  },
  scrap_collector: {
    id: 'scrap_collector',
    name: 'Scrap Refinery',
    keyBinding: '5',
    roleClue: 'Economy: +5 Scrap/sec Income',
    category: 'economy',
    baseCost: 120,
    range: 70,
    damage: 0,
    fireRate: 0.5,
    color: '#eab308',
    scrapPerSecond: 5,
  },
  infantry_barracks: {
    id: 'infantry_barracks',
    name: 'Infantry Barracks',
    keyBinding: '6',
    roleClue: 'Trains Controllable Soldier Squads',
    category: 'producer',
    baseCost: 150,
    range: 95,
    damage: 15,
    fireRate: 2.6,
    color: '#10b981',
    spawnIntervalSeconds: 7.0,
    spawnUnitType: 'soldier',
  },
  vehicle_factory: {
    id: 'vehicle_factory',
    name: 'Heavy Vehicle Factory',
    keyBinding: '7',
    roleClue: 'Produces Controllable Siege Tanks',
    category: 'producer',
    baseCost: 210,
    range: 145,
    damage: 52,
    fireRate: 1.1,
    color: '#06b6d4',
    spawnIntervalSeconds: 10.5,
    spawnUnitType: 'heavy_vehicle',
  },
  forward_hq: {
    id: 'forward_hq',
    name: 'Forward HQ Base',
    keyBinding: '8',
    roleClue: 'Expands Player Map Area + HQ Cannon',
    category: 'hq',
    baseCost: 260,
    range: 175,
    damage: 26,
    fireRate: 2.4,
    color: '#22c55e',
    controlRadius: 0.30,
  },
  airstrike: {
    id: 'airstrike',
    name: 'Orbital Napalm Strike',
    keyBinding: '9',
    roleClue: 'Heavy Area Bombardment',
    category: 'ability',
    baseCost: 225,
    range: 110,
    damage: 250,
    fireRate: 1,
    color: '#ef4444',
  },
  unit_command: {
    id: 'unit_command',
    name: 'Command Army',
    keyBinding: 'M',
    roleClue: 'Click Map to Move Soldiers & Vehicles',
    category: 'command',
    baseCost: 0,
    range: 0,
    damage: 0,
    fireRate: 0,
    color: '#34d399',
  },
};

export const INITIAL_UPGRADES: UpgradeStat[] = [
  {
    id: 'turret_damage',
    name: 'Tungsten Core Rounds',
    description: 'Increases all deployed tower & heavy tank ballistic damage.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 50,
    baseCostScrap: 150,
    bonusPerLevel: 0.15,
    unitLabel: '+15% Tower & Tank DMG',
  },
  {
    id: 'troop_Training',
    name: 'Exoskeleton Squad Rig',
    description:
      'Boosts Barracks Soldier & Heavy Vehicle armor HP, speed, and capture rate.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 60,
    baseCostScrap: 180,
    bonusPerLevel: 0.18,
    unitLabel: '+18% Unit Power',
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
    description:
      'Increases Scrap Refinery output and Scrap harvested from every eliminated zombie.',
    level: 1,
    maxLevel: 10,
    baseCostGems: 75,
    baseCostScrap: 200,
    bonusPerLevel: 0.2,
    unitLabel: '+20% Scrap Economy',
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
 * Converts a sequence of real-world GPS road coordinates from OpenStreetMap OSRM
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
 * so OSRM can trace real-world street paths from all 4 directions into HQ.
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
    name: 'New York City (Full Satellite Map)',
    city: 'New York, USA',
    lat: 40.758,
    lng: -73.9855,
    zoom: 15,
    cachedAt: 1730980000000,
    tileSizeKb: 4280,
    threatRating: 'SATELLITE CITY MAP · REAL NYC ROAD NETWORK',
    realRoadSynced: true,
    roads: [
      convertLatLngPathToSectorRoad(
        'broadway_nw',
        'Broadway & West Side Hwy (NW Artery)',
        [
          { lat: 40.7620, lng: -73.9932 },
          { lat: 40.7608, lng: -73.9902 },
          { lat: 40.7598, lng: -73.9875 },
          { lat: 40.7589, lng: -73.9855 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        1420
      ),
      convertLatLngPathToSectorRoad(
        'fdr_ne',
        'FDR Drive & Lexington Ave (NE Artery)',
        [
          { lat: 40.7620, lng: -73.9775 },
          { lat: 40.7605, lng: -73.9802 },
          { lat: 40.7592, lng: -73.9825 },
          { lat: 40.7584, lng: -73.9842 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        1380
      ),
      convertLatLngPathToSectorRoad(
        'queens_midtown_se',
        '3rd Ave & E 34th St (SE Artery)',
        [
          { lat: 40.7540, lng: -73.9775 },
          { lat: 40.7556, lng: -73.9802 },
          { lat: 40.7574, lng: -73.9818 },
          { lat: 40.7578, lng: -73.9838 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        1460
      ),
      convertLatLngPathToSectorRoad(
        'lincoln_sw',
        '9th Ave & W 34th St (SW Artery)',
        [
          { lat: 40.7540, lng: -73.9932 },
          { lat: 40.7554, lng: -73.9904 },
          { lat: 40.7566, lng: -73.9882 },
          { lat: 40.7574, lng: -73.9866 },
          { lat: 40.7580, lng: -73.9855 },
        ],
        40.758,
        -73.9855,
        1390
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
    name: 'Tokyo Metropolis (Full Satellite Map)',
    city: 'Tokyo, Japan',
    lat: 35.6595,
    lng: 139.7004,
    zoom: 15,
    cachedAt: 1730980000000,
    tileSizeKb: 5120,
    threatRating: 'SATELLITE CITY MAP · REAL TOKYO ARTERIAL ROADS',
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
    name: 'London City (Full Satellite Map)',
    city: 'London, UK',
    lat: 51.5101,
    lng: -0.134,
    zoom: 15,
    cachedAt: null,
    tileSizeKb: 3890,
    threatRating: 'SATELLITE CITY MAP · REAL LONDON ROAD NETWORK',
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
 * Returns the flat deployment cost of a building or ability.
 * Placing additional towers or buildings does NOT increase the price of the next one.
 */
export function getDynamicDeployCost(
  blueprintId: DeployableId,
  _existingCountOfSameType = 0
): number {
  const bp = DEPLOYABLE_BLUEPRINTS[blueprintId];
  if (!bp) return 999;
  return bp.baseCost;
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
 * Creates the 5 strategic territorial zones on the city map:
 * - Central HQ Zone (captured at start)
 * - 4 Outer Fortresses (NW, NE, SE, SW) that must be captured by Soldiers & Heavy Vehicles
 *   to expand buildable territory and liberate the entire sector.
 */
export function createInitialFortressZones(sector?: CitySector): FortressZone[] {
  // Position outer fortresses near the mid-outer approach of each road or 4 quadrants
  const defaultPositions = [
    { id: 'fortress_nw', name: 'NW Bastion Fortress', x: 0.24, y: 0.24 },
    { id: 'fortress_ne', name: 'NE Citadel Fortress', x: 0.76, y: 0.24 },
    { id: 'fortress_se', name: 'SE Armory Fortress', x: 0.76, y: 0.74 },
    { id: 'fortress_sw', name: 'SW Transit Fortress', x: 0.24, y: 0.74 },
  ];

  const outerZones: FortressZone[] = defaultPositions.map((pos, idx) => {
    const road = sector?.roads[idx];
    // Anchor near the second waypoint of the road if within safe bounds, or use quadrant anchor
    let fx = pos.x;
    let fy = pos.y;
    if (road && road.points.length >= 2) {
      const pt = road.points[1];
      const distFromHq = Math.hypot(pt.x - 0.5, pt.y - 0.5);
      if (distFromHq >= 0.16 && distFromHq <= 0.42) {
        fx = Number(Math.max(0.14, Math.min(0.86, pt.x)).toFixed(3));
        fy = Number(Math.max(0.16, Math.min(0.82, pt.y)).toFixed(3));
      }
    }
    return {
      id: pos.id,
      name: pos.name,
      x: fx,
      y: fy,
      radius: 0.23,
      isHq: false,
      status: 'hostile',
      captureProgress: 0,
      garrisonCount: 0,
      hostileCount: 0,
    };
  });

  return [
    {
      id: 'hq_zone',
      name: 'Central HQ Command Zone',
      x: 0.5,
      y: 0.5,
      radius: 0.26,
      isHq: true,
      status: 'captured',
      captureProgress: 1,
      garrisonCount: 1,
      hostileCount: 0,
    },
    ...outerZones,
  ];
}

/**
 * Checks whether a normalized map coordinate (normX, normY) lies inside at least one
 * player-captured territory zone (Central HQ Zone or any captured Outer Fortress).
 */
export function isPointInsideCapturedZone(
  normX: number,
  normY: number,
  zones: FortressZone[]
): boolean {
  if (!zones || zones.length === 0) return true;
  for (const z of zones) {
    if (z.status === 'captured') {
      const squareDist = Math.max(Math.abs(normX - z.x), Math.abs(normY - z.y));
      if (squareDist <= z.radius) return true;
    }
  }
  return false;
}

/**
 * Steps a Fortress Zone's capture progress and handles Zone Fall when zombies
 * eliminate defending soldiers/vehicles inside the fortress perimeter.
 */
export function stepFortressZoneCaptureAndFall(
  zone: FortressZone,
  friendlyUnitsInZone: number,
  zombiesInZone: number,
  dt: number
): {
  updatedZone: FortressZone;
  justCaptured: boolean;
  justFell: boolean;
} {
  if (zone.isHq) {
    return {
      updatedZone: {
        ...zone,
        status: 'captured',
        captureProgress: 1,
        garrisonCount: friendlyUnitsInZone,
        hostileCount: zombiesInZone,
      },
      justCaptured: false,
      justFell: false,
    };
  }

  let progress = zone.captureProgress;
  let status = zone.status;
  let justCaptured = false;
  let justFell = false;

  if (friendlyUnitsInZone > 0 && zombiesInZone === 0) {
    // Uncontested friendly troops capturing or reinforcing the Fortress
    progress = Math.min(1, progress + dt * (0.16 + friendlyUnitsInZone * 0.08));
    if (progress >= 1) {
      if (status !== 'captured') {
        justCaptured = true;
      }
      status = 'captured';
    } else {
      status = 'contesting';
    }
  } else if (friendlyUnitsInZone > 0 && zombiesInZone > 0) {
    // Active firefight inside the Fortress perimeter
    if (friendlyUnitsInZone > zombiesInZone) {
      progress = Math.min(
        1,
        progress + dt * (friendlyUnitsInZone - zombiesInZone) * 0.05
      );
      if (progress >= 1 && status !== 'captured') {
        status = 'captured';
        justCaptured = true;
      }
    } else if (zombiesInZone > friendlyUnitsInZone && status !== 'captured') {
      progress = Math.max(0, progress - dt * 0.08);
    }
  } else if (friendlyUnitsInZone === 0 && zombiesInZone > 0) {
    // No living soldiers defending the Fortress while zombies swarm it -> Zone Falls when progress hits 0!
    progress = Math.max(0, progress - dt * (0.28 + zombiesInZone * 0.12));
    if (progress <= 0) {
      if (status === 'captured') {
        justFell = true;
      }
      status = 'hostile';
      progress = 0;
    }
  }

  return {
    updatedZone: {
      ...zone,
      status,
      captureProgress: Number(progress.toFixed(4)),
      garrisonCount: friendlyUnitsInZone,
      hostileCount: zombiesInZone,
    },
    justCaptured,
    justFell,
  };
}

export interface TerritoryCircle {
  id: string;
  label: string;
  x: number;
  y: number;
  radius: number; // Half-width / half-height of the SQUARE zone
  isHq: boolean;
}

export interface TrainableUnitBlueprint {
  id: 'soldier' | 'heavy_vehicle';
  name: string;
  costScrap: number;
  requiredBuildingId: DeployableId;
  requiredBuildingName: string;
  roleClue: string;
}

export const TRAINABLE_UNITS: Record<'soldier' | 'heavy_vehicle', TrainableUnitBlueprint> = {
  soldier: {
    id: 'soldier',
    name: 'Rifle Soldier Squad',
    costScrap: 75,
    requiredBuildingId: 'infantry_barracks',
    requiredBuildingName: 'Infantry Barracks',
    roleClue: 'Mobile Infantry · 125 HP · Assault Rifle',
  },
  heavy_vehicle: {
    id: 'heavy_vehicle',
    name: 'Heavy Siege Tank',
    costScrap: 130,
    requiredBuildingId: 'vehicle_factory',
    requiredBuildingName: 'Heavy Vehicle Factory',
    roleClue: 'Armored Tank · 380 HP · Splash Cannon',
  },
};

export function canTrainUnit(
  unitType: 'soldier' | 'heavy_vehicle',
  scrap: number,
  builtCountsByType: Partial<Record<DeployableId, number>>
): {
  allowed: boolean;
  unlocked: boolean;
  costScrap: number;
  reason?: string;
} {
  const unit = TRAINABLE_UNITS[unitType];
  const producerCount = builtCountsByType[unit.requiredBuildingId] ?? 0;
  const unlocked = producerCount > 0;
  if (!unlocked) {
    return {
      allowed: false,
      unlocked: false,
      costScrap: unit.costScrap,
      reason: `LOCKED — BUILD ${unit.requiredBuildingName.toUpperCase()} FIRST`,
    };
  }
  if (scrap < unit.costScrap) {
    return {
      allowed: false,
      unlocked: true,
      costScrap: unit.costScrap,
      reason: `NEED ${unit.costScrap} SCRAP`,
    };
  }
  return {
    allowed: true,
    unlocked: true,
    costScrap: unit.costScrap,
  };
}

/**
 * Returns all active Player-Controlled SQUARE territory zones across the map:
 * - Primary HQ Command Base at (0.5, 0.5) (square half-width 0.25)
 * - Every built Forward HQ Base ('forward_hq') (square half-width 0.28 + level bonus)
 * Note: ONLY HQs gain Player-Controlled Map Zones! Heavy Fortresses ('fortress')
 * have square defensive firing zones around them, but do not expand map control.
 */
export function getPlayerTerritoryCircles(
  towers: {
    id?: number;
    blueprintId?: DeployableId;
    x: number;
    y: number;
    level?: number;
    hp?: number;
    buildProgress?: number;
    controlRadius?: number;
  }[],
  primaryHqAlive = true
): TerritoryCircle[] {
  const squares: TerritoryCircle[] = [];
  if (primaryHqAlive) {
    squares.push({
      id: 'primary_hq',
      label: 'PRIMARY HQ COMMAND',
      x: 0.5,
      y: 0.5,
      radius: 0.25,
      isHq: true,
    });
  }

  let hqIdx = 2;
  for (const t of towers) {
    const alive = t.hp === undefined || t.hp > 0;
    const built = t.buildProgress === undefined || t.buildProgress >= 1;
    if (!alive || !built) continue;

    if (t.blueprintId === 'forward_hq') {
      const lvl = t.level ?? 1;
      squares.push({
        id: `forward_hq_${t.id ?? hqIdx}`,
        label: `FORWARD HQ 0${hqIdx++}`,
        x: t.x,
        y: t.y,
        radius: (t.controlRadius ?? 0.28) + (lvl - 1) * 0.025,
        isHq: true,
      });
    }
  }
  return squares;
}

/**
 * Computes the percentage of the entire city map controlled by the Player vs. Zombies.
 * Samples a 20x20 grid over the map using SQUARE HQ zones. Building more Forward HQs
 * expands Player-Controlled Area until reaching 100% Full Map Liberation.
 */
export function calculateMapControlPercentage(
  towers: {
    id?: number;
    blueprintId?: DeployableId;
    x: number;
    y: number;
    level?: number;
    hp?: number;
    buildProgress?: number;
    controlRadius?: number;
  }[],
  primaryHqAlive = true
): {
  playerPercent: number;
  zombiePercent: number;
  hqCount: number;
} {
  const squares = getPlayerTerritoryCircles(towers, primaryHqAlive);
  const hqCount = squares.length;
  if (squares.length === 0) {
    return { playerPercent: 0, zombiePercent: 100, hqCount: 0 };
  }

  const gridN = 20;
  let controlledCells = 0;
  const totalCells = gridN * gridN;

  for (let gx = 0; gx < gridN; gx++) {
    const px = 0.04 + (gx / (gridN - 1)) * 0.92;
    for (let gy = 0; gy < gridN; gy++) {
      const py = 0.06 + (gy / (gridN - 1)) * 0.88;
      let inside = false;
      for (const c of squares) {
        if (Math.max(Math.abs(px - c.x), Math.abs(py - c.y)) <= c.radius) {
          inside = true;
          break;
        }
      }
      if (inside) controlledCells++;
    }
  }

  const rawRatio = controlledCells / totalCells;
  // Normalize so ~88% physical square coverage across the viewport = 100% Map Liberation
  const playerPercent = Math.min(100, Math.round((rawRatio / 0.88) * 100));
  return {
    playerPercent,
    zombiePercent: Math.max(0, 100 - playerPercent),
    hqCount,
  };
}

/**
 * Checks whether a normalized map coordinate (normX, normY) is inside Player-Controlled SQUARE Area
 * or secured by nearby friendly Soldiers / Heavy Vehicles.
 */
export function isPointInPlayerControlledArea(
  normX: number,
  normY: number,
  towers: {
    id?: number;
    blueprintId?: DeployableId;
    x: number;
    y: number;
    level?: number;
    hp?: number;
    buildProgress?: number;
    controlRadius?: number;
  }[],
  troops: { x: number; y: number }[] = [],
  blueprintId?: DeployableId
): boolean {
  const squares = getPlayerTerritoryCircles(towers, true);
  // Forward HQs and Heavy Fortresses can be built on the frontline border (+0.16 expansion reach)
  const expansionBonus =
    blueprintId === 'forward_hq'
      ? 0.16
      : blueprintId === 'fortress'
      ? 0.10
      : 0;

  for (const c of squares) {
    if (
      Math.max(Math.abs(normX - c.x), Math.abs(normY - c.y)) <=
      c.radius + expansionBonus
    ) {
      return true;
    }
  }

  // Friendly Soldiers & Heavy Vehicles project a tactical vanguard zone around themselves,
  // allowing the player to march units into Zombie-Controlled Area and build a Forward HQ or Fortress!
  const unitVanguardRadius =
    blueprintId === 'forward_hq' || blueprintId === 'fortress' ? 0.18 : 0.12;
  for (const u of troops) {
    if (Math.max(Math.abs(normX - u.x), Math.abs(normY - u.y)) <= unitVanguardRadius) {
      return true;
    }
  }

  return false;
}

/**
 * Generates a 360-degree zombie spawn coordinate on the outer entries of the city's real roads
 * across all 4 quadrants, ensuring zombies enter from all directions and strictly follow real roads.
 */
export function create360ZombieSpawnPoint(
  spawnIndex: number,
  _totalInWave: number,
  sector: CitySector
): { x: number; y: number; roadIndex: number } {
  if (sector.roads.length > 0) {
    const roadIndex = spawnIndex % sector.roads.length;
    const road = sector.roads[roadIndex];
    if (road.points.length >= 2) {
      const p0 = road.points[0];
      const p1 = road.points[1];
      // Stagger slightly along the initial real road segment [0..0.22] so zombies stay 100% on the road
      const staggerT = ((Math.floor(spawnIndex / sector.roads.length) % 4) * 0.05);
      const x = Number((p0.x + (p1.x - p0.x) * staggerT).toFixed(4));
      const y = Number((p0.y + (p1.y - p0.y) * staggerT).toFixed(4));
      return { x, y, roadIndex };
    }
    if (road.points.length === 1) {
      return { x: road.points[0].x, y: road.points[0].y, roadIndex };
    }
  }

  const sectorIdx = spawnIndex % 8;
  const angle = sectorIdx * (Math.PI / 4);
  return {
    x: Number((0.5 + Math.cos(angle) * 0.44).toFixed(3)),
    y: Number((0.5 + Math.sin(angle) * 0.42).toFixed(3)),
    roadIndex: 0,
  };
}

/**
 * Maximum number of static buildings the sector command power grid can support simultaneously.
 * Starts at 8 in the Primary HQ zone; each additional HQ Base or captured zone adds +3 Power Grid slots!
 */
export function getMaxTowerSlots(
  upgrades: UpgradeStat[],
  activeHqOrZoneCount = 1
): number {
  const fort = upgrades.find((u) => u.id === 'base_fortification');
  const level = fort ? fort.level : 1;
  const extraBases = Math.max(0, activeHqOrZoneCount - 1);
  return 8 + Math.floor((level - 1) / 2) + extraBases * 3;
}

/**
 * Calculates Scrap/sec generated by a Scrap Refinery economy building.
 */
export function getScrapCollectorYieldPerSecond(
  buildingLevel: number,
  upgrades: UpgradeStat[]
): number {
  const scanner = upgrades.find((u) => u.id === 'salvage_scanner');
  const mult =
    1 + ((scanner ? scanner.level : 1) - 1) * (scanner?.bonusPerLevel ?? 0.2);
  const baseRate = 5 + (buildingLevel - 1) * 2.5;
  return Number((baseRate * mult).toFixed(1));
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

export interface RoadProjectionResult {
  x: number;
  y: number;
  roadIndex: number;
  segmentIndex: number;
  segmentT: number;
  distance: number;
}

/**
 * Projects any normalized city coordinate (px, py) onto the closest point on the real road network.
 * Used when a unit exits an off-road Barracks/Vehicle Factory onto the street, and when snapping
 * player move orders onto real roads.
 */
export function projectPointToNearestRoad(
  px: number,
  py: number,
  roads: CachedSectorRoad[]
): RoadProjectionResult {
  if (!roads || roads.length === 0) {
    return {
      x: px,
      y: py,
      roadIndex: 0,
      segmentIndex: 0,
      segmentT: 0,
      distance: 0,
    };
  }

  let bestX = px;
  let bestY = py;
  let bestRoadIdx = 0;
  let bestSegIdx = 0;
  let bestT = 0;
  let bestDist = Infinity;

  for (let rIdx = 0; rIdx < roads.length; rIdx++) {
    const pts = roads[rIdx].points;
    for (let sIdx = 0; sIdx < pts.length - 1; sIdx++) {
      const p1 = pts[sIdx];
      const p2 = pts[sIdx + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const lenSq = dx * dx + dy * dy;
      const t =
        lenSq === 0
          ? 0
          : Math.max(0, Math.min(1, ((px - p1.x) * dx + (py - p1.y) * dy) / lenSq));
      const projX = p1.x + t * dx;
      const projY = p1.y + t * dy;
      const d = Math.hypot(px - projX, py - projY);
      if (d < bestDist) {
        bestDist = d;
        bestX = projX;
        bestY = projY;
        bestRoadIdx = rIdx;
        bestSegIdx = sIdx;
        bestT = t;
      }
    }
  }

  return {
    x: Number(bestX.toFixed(4)),
    y: Number(bestY.toFixed(4)),
    roadIndex: bestRoadIdx,
    segmentIndex: bestSegIdx,
    segmentT: Number(bestT.toFixed(4)),
    distance: Number(bestDist.toFixed(4)),
  };
}

/**
 * Computes a strict real-road path for a Soldier Squad or Heavy Siege Tank from (startX, startY)
 * to (targetX, targetY):
 * 1. If the unit starts at an off-road producer building (Barracks / Vehicle Factory), its first
 *    waypoint exits the building directly onto the nearest real road segment.
 * 2. The unit then follows the real road vertices (and central road intersections if switching
 *    arterial roads) to the point on the real road network closest to (targetX, targetY).
 */
export function computeRoadNetworkPath(
  startX: number,
  startY: number,
  targetX: number,
  targetY: number,
  roads: CachedSectorRoad[]
): { x: number; y: number }[] {
  if (!roads || roads.length === 0) {
    return [{ x: targetX, y: targetY }];
  }

  const startProj = projectPointToNearestRoad(startX, startY, roads);
  const endProj = projectPointToNearestRoad(targetX, targetY, roads);
  const rawWaypoints: { x: number; y: number }[] = [];

  // Step 1: Exit off-road building (or current off-road position) onto the nearest real road
  rawWaypoints.push({ x: startProj.x, y: startProj.y });

  if (startProj.roadIndex === endProj.roadIndex) {
    const pts = roads[startProj.roadIndex].points;
    const posA = startProj.segmentIndex + startProj.segmentT;
    const posB = endProj.segmentIndex + endProj.segmentT;

    if (posA < posB) {
      for (let i = startProj.segmentIndex + 1; i <= endProj.segmentIndex; i++) {
        rawWaypoints.push({ x: pts[i].x, y: pts[i].y });
      }
    } else if (posA > posB) {
      for (let i = startProj.segmentIndex; i >= endProj.segmentIndex + 1; i--) {
        rawWaypoints.push({ x: pts[i].x, y: pts[i].y });
      }
    }
  } else {
    // Traverse along start road to the central road hub (last vertex of road), then outward along destination road
    const ptsA = roads[startProj.roadIndex].points;
    for (let i = startProj.segmentIndex + 1; i < ptsA.length; i++) {
      rawWaypoints.push({ x: ptsA[i].x, y: ptsA[i].y });
    }

    const ptsB = roads[endProj.roadIndex].points;
    for (let i = ptsB.length - 2; i >= endProj.segmentIndex + 1; i--) {
      rawWaypoints.push({ x: ptsB[i].x, y: ptsB[i].y });
    }
  }

  // Final point on the real road
  rawWaypoints.push({ x: endProj.x, y: endProj.y });

  // Deduplicate very close consecutive points
  const cleaned: { x: number; y: number }[] = [];
  for (const pt of rawWaypoints) {
    const prev = cleaned[cleaned.length - 1];
    if (!prev || Math.hypot(pt.x - prev.x, pt.y - prev.y) >= 0.004) {
      cleaned.push(pt);
    }
  }

  return cleaned.length > 0 ? cleaned : [{ x: endProj.x, y: endProj.y }];
}

/**
 * Enforces tactical city placement constraints for static buildings (Towers, Heavy Fortresses,
 * Scrap Refineries, Barracks, Vehicle Factories, and Forward HQ Bases):
 * 1. Sector Power Grid cap (note: Forward HQ Bases expand the grid so they never get blocked by grid cap)
 * 2. Must be inside Player-Controlled Area (or near frontline / friendly Soldiers & Vehicles)
 * 3. Safe viewport perimeter margin
 * 4. HQ Command Bunker center exclusion buffer
 * 5. Cannot build directly on real-world road asphalt (must build OUTSIDE of roads on blocks/lots)
 * 6. Minimum spacing between adjacent buildings (no stacking)
 */
export function validateTowerPlacement(
  normX: number,
  normY: number,
  sector: CitySector,
  existingTowers: {
    id?: number;
    blueprintId?: DeployableId;
    x: number;
    y: number;
    level?: number;
    controlRadius?: number;
  }[],
  maxTowers = 8,
  zones?: FortressZone[],
  troops: { x: number; y: number }[] = [],
  blueprintId?: DeployableId
): PlacementValidationResult {
  if (blueprintId !== 'forward_hq' && existingTowers.length >= maxTowers) {
    return {
      valid: false,
      reason: `POWER GRID FULL (${existingTowers.length}/${maxTowers} BUILDINGS) · BUILD FORWARD HQ`,
    };
  }

  if (normX < 0.04 || normX > 0.96 || normY < 0.06 || normY > 0.92) {
    return { valid: false, reason: 'OUTSIDE CITY PERIMETER' };
  }

  // Check whole-map Player-Controlled Area (and optional legacy FortressZones if passed in tests)
  const inPlayerArea = isPointInPlayerControlledArea(
    normX,
    normY,
    existingTowers,
    troops,
    blueprintId
  );
  const inCapturedZone =
    zones && zones.length > 0
      ? isPointInsideCapturedZone(normX, normY, zones)
      : false;

  if (!inPlayerArea && !inCapturedZone) {
    return {
      valid: false,
      reason:
        blueprintId === 'forward_hq'
          ? 'ZOMBIE AREA: MOVE SOLDIERS/VEHICLES ON ROADS HERE OR BUILD NEAR HQ BORDER'
          : 'OUTSIDE PLAYER AREA: BUILD FORWARD HQ OR MOVE UNITS HERE FIRST',
    };
  }

  const distToHq = Math.hypot(normX - 0.5, normY - 0.5);
  if (distToHq < 0.062) {
    return { valid: false, reason: 'BLOCKED: PRIMARY HQ PERIMETER' };
  }

  for (const road of sector.roads) {
    for (let i = 0; i < road.points.length - 1; i++) {
      const p1 = road.points[i];
      const p2 = road.points[i + 1];
      const dRoad = pointToSegmentDistance(normX, normY, p1.x, p1.y, p2.x, p2.y);
      if (dRoad < 0.028) {
        return {
          valid: false,
          reason: 'BLOCKED: REAL ROAD ASPHALT (PLACE BUILDINGS OUTSIDE ROADS)',
        };
      }
    }
  }

  for (const t of existingTowers) {
    const minSpacing =
      blueprintId === 'forward_hq' && t.blueprintId === 'forward_hq'
        ? 0.16
        : 0.056;
    if (Math.hypot(normX - t.x, normY - t.y) < minSpacing) {
      return { valid: false, reason: 'BLOCKED: TOO CLOSE TO BUILDING' };
    }
  }

  return { valid: true, reason: 'OFF-ROAD BUILDING SITE CLEAR' };
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

  const baseHp =
    blueprintId === 'forward_hq'
      ? 900
      : blueprintId === 'fortress'
      ? 680
      : 240;

  return {
    damage: Math.round(bp.damage * globalMultiplier * levelMultiplier),
    range: Math.round(bp.range * (1 + (towerLevel - 1) * 0.055)),
    fireRate: Number((bp.fireRate * (1 + (towerLevel - 1) * 0.07)).toFixed(2)),
    maxHp: Math.round(baseHp * (1 + (towerLevel - 1) * 0.35)),
    upgradeCostScrap: Math.round(bp.baseCost * 0.85 * Math.pow(1.35, towerLevel - 1)),
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
  const hpMultiplier = Number((Math.pow(1.22, w - 1) + (w - 1) * 0.2).toFixed(2));
  const speedMultiplier = Number(Math.min(2.25, 0.92 + (w - 1) * 0.05).toFixed(2));
  const damageMultiplier = Number((1 + (w - 1) * 0.15).toFixed(2));
  // Start with a light Wave 1 (6 zombies) and scale progressively harder each wave
  const hostileCount = Math.round(3 + w * 2 + Math.floor(Math.pow(w, 1.38)));
  const spawnIntervalSeconds = Number(
    Math.max(0.22, 2.1 * Math.pow(0.88, w - 1)).toFixed(2)
  );

  return {
    waveNumber: w,
    hostileCount,
    hpMultiplier,
    speedMultiplier,
    damageMultiplier,
    spawnIntervalSeconds,
    waveClearScrapBonus: 42 + w * 16,
    waveClearGemsBonus: 10 + Math.floor(w * 3),
  };
}

export function createZombieWaveComposition(waveNumber: number): ZombieArchetype[] {
  const scaling = getWaveDifficultyScaling(waveNumber);
  const w = scaling.waveNumber;
  const count = scaling.hostileCount;
  const list: ZombieArchetype[] = [];

  for (let i = 0; i < count; i++) {
    const juggernautMod = Math.max(3, 7 - Math.floor(w / 3));
    const spitterMod = Math.max(2, 5 - Math.floor(w / 4));

    if (w >= 3 && i > 0 && i % juggernautMod === 0) {
      list.push('juggernaut');
    } else if (w >= 2 && i > 0 && i % spitterMod === 0) {
      list.push('spitter');
    } else if (w >= 2 && i % 3 === 0) {
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
        ? 'OSRM OPENSTREETMAP · REAL STREET GEOMETRY'
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
