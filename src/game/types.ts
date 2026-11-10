export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type DeployableId =
  | 'rotary_turret'
  | 'sniper_nest'
  | 'emp_pylon'
  | 'fortress'
  | 'scrap_collector'
  | 'infantry_barracks'
  | 'vehicle_factory'
  | 'forward_hq'
  | 'airstrike'
  | 'unit_command';

export type BuildingCategory =
  | 'tower'
  | 'fortress'
  | 'economy'
  | 'producer'
  | 'hq'
  | 'ability'
  | 'command';

export interface DeployableBlueprint {
  id: DeployableId;
  name: string;
  keyBinding: string;
  roleClue: string;
  category: BuildingCategory;
  baseCost: number;
  range: number; // in pixels on tactical coordinate space
  damage: number;
  fireRate: number; // shots per second (or production/income rate clue)
  color: string;
  controlRadius?: number; // normalized [0..1] territory control radius projected by HQs & Fortresses
  scrapPerSecond?: number;
  spawnIntervalSeconds?: number;
  spawnUnitType?: 'soldier' | 'heavy_vehicle';
}

export interface FortressZone {
  id: string;
  name: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  radius: number; // normalized zone control radius (e.g. 0.28)
  isHq: boolean;
  status: 'captured' | 'contesting' | 'hostile';
  captureProgress: number; // 0..1 (1 = captured by player)
  garrisonCount: number; // number of living friendly units inside zone
  hostileCount: number; // number of living zombies inside zone
}

export interface UpgradeStat {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  baseCostGems: number;
  baseCostScrap: number;
  bonusPerLevel: number;
  unitLabel: string;
}

export interface StorePack {
  id: string;
  name: string;
  subtitle: string;
  gemsReward: number;
  scrapReward: number;
  priceTag: string;
  badgeText: string;
}

export interface CachedSectorRoad {
  id: string;
  name: string;
  points: { x: number; y: number }[]; // normalized 0..1 coordinates inside tactical sector
  latLngPoints?: { lat: number; lng: number }[]; // exact real-world road GPS polyline points
  width: number;
  distanceMeters?: number;
}

export interface CachedSectorBlock {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  heightLevel: number;
  type: 'commercial' | 'industrial' | 'park' | 'water';
}

export interface CitySector {
  id: string;
  name: string;
  city: string;
  lat: number;
  lng: number;
  zoom: number;
  cachedAt: number | null;
  tileSizeKb: number;
  threatRating: string;
  realRoadSynced?: boolean;
  roads: CachedSectorRoad[];
  blocks: CachedSectorBlock[];
}

export type ZombieArchetype = 'walker' | 'runner' | 'spitter' | 'juggernaut';

export interface ZombieEntity {
  id: number;
  archetype: ZombieArchetype;
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  scrapReward: number;
  roadIndex: number;
  waypointIndex: number;
  slowTimer: number;
  flashTimer: number;
  windupTimer: number;
  isWindingUp: boolean;
  koTimer: number; // > 0 when defeated and playing knockback/dissolve
  koVx: number;
  koVy: number;
  gaitPhase: number;
}

export interface TowerEntity {
  id: number;
  blueprintId: DeployableId;
  x: number;
  y: number;
  level: number;
  hp: number;
  maxHp: number;
  buildProgress: number; // 0..1 (1 = construction complete & operational)
  heat: number; // 0..1 barrel thermal load
  overheated: boolean; // true while venting heat
  range: number;
  damage: number;
  fireRate: number;
  cooldown: number;
  productionTimer: number; // used by scrap_collector, infantry_barracks, vehicle_factory
  controlRadius?: number; // territory control radius for forward_hq and fortress
  angle: number;
  recoil: number;
  kills: number;
}

export interface PlacementValidationResult {
  valid: boolean;
  reason?: string;
}

export interface TroopEntity {
  id: number;
  unitType: 'soldier' | 'heavy_vehicle';
  ownerBuildingId?: number;
  targetZoneId?: string;
  selected?: boolean;
  x: number;
  y: number;
  rallyX: number;
  rallyY: number;
  roadPath?: { x: number; y: number }[];
  roadPathIndex?: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  fireRate: number;
  speed: number;
  cooldown: number;
  angle: number;
  gaitPhase: number;
  flashTimer: number;
}

export interface ProjectileEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  targetX: number;
  targetY: number;
  damage: number;
  isEmp: boolean;
  isSplash: boolean;
  isZombieSpit: boolean;
  targetTowerId?: number;
  color: string;
  radius: number;
}

export interface ParticleEntity {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export interface RunSnapshot {
  victory: boolean;
  sectorName: string;
  waveReached: number;
  bestWave: number;
  zonesCaptured: number;
  totalZones: number;
  mapControlPercent?: number;
  hqCount?: number;
  threatMultiplier: number;
  zombiesEliminated: number;
  scrapEarned: number;
  gemsEarned: number;
  baseHpRemaining: number;
  baseMaxHp: number;
  score: number;
  bestScore: number;
}
