export type GameScreenState = 'title' | 'playing' | 'paused' | 'gameover';

export type DeployableId =
  | 'rotary_turret'
  | 'sniper_nest'
  | 'emp_pylon'
  | 'rifle_squad'
  | 'airstrike';

export interface DeployableBlueprint {
  id: DeployableId;
  name: string;
  keyBinding: string;
  roleClue: string;
  category: 'tower' | 'troop' | 'ability';
  baseCost: number;
  range: number; // in pixels on 960x600 tactical coordinate space
  damage: number;
  fireRate: number; // shots per second
  color: string;
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
  x: number;
  y: number;
  rallyX: number;
  rallyY: number;
  hp: number;
  maxHp: number;
  range: number;
  damage: number;
  fireRate: number;
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
  threatMultiplier: number;
  zombiesEliminated: number;
  scrapEarned: number;
  gemsEarned: number;
  baseHpRemaining: number;
  baseMaxHp: number;
  score: number;
  bestScore: number;
}
