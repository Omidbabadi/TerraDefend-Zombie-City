import React, { useEffect, useRef } from 'react';
import {
  CitySector,
  DeployableId,
  FortressZone,
  GameScreenState,
  ParticleEntity,
  ProjectileEntity,
  RunSnapshot,
  TowerEntity,
  TroopEntity,
  UpgradeStat,
  ZombieArchetype,
  ZombieEntity,
} from '../game/types';
import {
  DEPLOYABLE_BLUEPRINTS,
  TRAINABLE_UNITS,
  calculateMapControlPercentage,
  canTrainUnit,
  computeRoadNetworkPath,
  create360ZombieSpawnPoint,
  createInitialFortressZones,
  createZombieWaveComposition,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getHqDefenseWeaponStats,
  getMaxBaseHp,
  getMaxTowerSlots,
  getPlayerTerritoryCircles,
  getScrapCollectorYieldPerSecond,
  getScrapRewardWithBonus,
  getWaveDifficultyScaling,
  projectPointToNearestRoad,
  validateTowerPlacement,
} from '../game/rules';
import { soundEngine } from '../game/audio';
import { triggerAndroidHaptic } from '../game/haptics';

export interface HudSyncPayload {
  baseHp: number;
  baseMaxHp: number;
  wave: number;
  threatMultiplier: number;
  zombiesRemaining: number;
  breathingTimeRemaining: number;
  activeTowerCount: number;
  maxTowerSlots: number;
  scrapPerSec: number;
  playerControlPercent: number;
  zombieControlPercent: number;
  hqCount: number;
  capturedZonesCount: number;
  totalZonesCount: number;
  zones: FortressZone[];
  priorityZoneId: string | null;
  soldierCount: number;
  heavyVehicleCount: number;
  selectedUnitCount: number;
  unitCountsByType: Record<DeployableId, number>;
  selectedTower: TowerEntity | null;
  statusAlert: string | null;
}

interface TacticalBattleCanvasProps {
  gameState: GameScreenState;
  activeSector: CitySector;
  isOfflineMode: boolean;
  selectedDeployable: DeployableId;
  scrap: number;
  gems: number;
  upgrades: UpgradeStat[];
  resetSignal: number;
  nextWaveSignal: number;
  trainUnitSignal?: {
    unitType: 'soldier' | 'heavy_vehicle';
    seq: number;
  } | null;
  unitSelectFilterSignal?: {
    filter: 'all' | 'soldier' | 'heavy_vehicle';
    seq: number;
  } | null;
  focusZoneIdSignal?: { zoneId: string; seq: number } | null;
  onSpendScrap: (amount: number) => void;
  onEarnScrapAndGems: (
    scrapDelta: number,
    gemsDelta: number,
    scoreDelta: number
  ) => void;
  onHudSync: (hud: HudSyncPayload) => void;
  onGameEnd: (snapshot: Omit<RunSnapshot, 'bestScore' | 'bestWave'>) => void;
  upgradeTowerSignal: number;
  repairTowerSignal: number;
  sellTowerSignal: number;
  deselectTowerSignal?: number;
  touchActionMode?: 'build' | 'move_units';
}

const MAX_PARTICLES = 180;
const MAX_PROJECTILES = 110;
const INITIAL_PREP_SECONDS = 12.0;
const WAVE_BREATHING_SECONDS = 16.0;

export const TacticalBattleCanvas: React.FC<TacticalBattleCanvasProps> = ({
  gameState,
  activeSector,
  isOfflineMode,
  selectedDeployable,
  scrap,
  upgrades,
  resetSignal,
  nextWaveSignal,
  trainUnitSignal,
  unitSelectFilterSignal,
  focusZoneIdSignal,
  onSpendScrap,
  onEarnScrapAndGems,
  onHudSync,
  onGameEnd,
  upgradeTowerSignal,
  repairTowerSignal,
  sellTowerSignal,
  deselectTowerSignal = 0,
  touchActionMode = 'build',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const touchDownRef = useRef<{
    x: number;
    y: number;
    longPressed: boolean;
  } | null>(null);

  // Store latest React props in refs synchronously so 60Hz loop and pointer handlers always read latest state immediately
  const propsRef = useRef({
    gameState,
    activeSector,
    isOfflineMode,
    selectedDeployable,
    touchActionMode,
    scrap,
    upgrades,
    onSpendScrap,
    onEarnScrapAndGems,
    onHudSync,
    onGameEnd,
  });

  propsRef.current = {
    gameState,
    activeSector,
    isOfflineMode,
    selectedDeployable,
    touchActionMode,
    scrap,
    upgrades,
    onSpendScrap,
    onEarnScrapAndGems,
    onHudSync,
    onGameEnd,
  };

  // Simulation mutable state ref
  const simRef = useRef<{
    baseHp: number;
    baseMaxHp: number;
    wave: number;
    waveQueue: ZombieArchetype[];
    totalSpawnedInWave: number;
    spawnTimer: number;
    waveCooldownTimer: number;
    zones: FortressZone[];
    priorityZoneId: string | null;
    liberationHoldTimer: number;
    statusAlert: string | null;
    statusAlertTimer: number;
    armyRallyX: number;
    armyRallyY: number;
    armyOrderTimer: number;
    zombies: ZombieEntity[];
    towers: TowerEntity[];
    troops: TroopEntity[];
    projectiles: ProjectileEntity[];
    particles: ParticleEntity[];
    particleCursor: number;
    projectileCursor: number;
    nextEntityId: number;
    selectedTowerId: number | null;
    hoverX: number;
    hoverY: number;
    hitstopTimer: number;
    cameraTrauma: number;
    radarAngle: number;
    hqCooldown: number;
    hqAngle: number;
    hqRecoil: number;
    zombiesEliminated: number;
    scrapEarnedRun: number;
    gemsEarnedRun: number;
    scoreRun: number;
    ended: boolean;
  }>({
    baseHp: 1000,
    baseMaxHp: 1000,
    wave: 1,
    waveQueue: [],
    totalSpawnedInWave: 0,
    spawnTimer: 1.5,
    waveCooldownTimer: 0,
    zones: createInitialFortressZones(activeSector),
    priorityZoneId: 'fortress_nw',
    liberationHoldTimer: 0,
    statusAlert: null,
    statusAlertTimer: 0,
    armyRallyX: 0.5,
    armyRallyY: 0.36,
    armyOrderTimer: 0,
    zombies: [],
    towers: [],
    troops: [],
    projectiles: Array.from({ length: MAX_PROJECTILES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      targetX: 0,
      targetY: 0,
      damage: 0,
      isEmp: false,
      isSplash: false,
      isZombieSpit: false,
      color: '#38bdf8',
      radius: 3,
    })),
    particles: Array.from({ length: MAX_PARTICLES }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
      maxLife: 1,
      size: 2,
      color: '#f59e0b',
    })),
    particleCursor: 0,
    projectileCursor: 0,
    nextEntityId: 1,
    selectedTowerId: null,
    hoverX: -1000,
    hoverY: -1000,
    hitstopTimer: 0,
    cameraTrauma: 0,
    radarAngle: 0,
    hqCooldown: 0,
    hqAngle: -Math.PI / 2,
    hqRecoil: 0,
    zombiesEliminated: 0,
    scrapEarnedRun: 0,
    gemsEarnedRun: 0,
    scoreRun: 0,
    ended: false,
  });

  const spawnParticles = (
    x: number,
    y: number,
    count: number,
    color: string,
    speedScale = 90
  ) => {
    const sim = simRef.current;
    for (let i = 0; i < count; i++) {
      const p = sim.particles[sim.particleCursor];
      sim.particleCursor = (sim.particleCursor + 1) % MAX_PARTICLES;
      const angle = Math.random() * Math.PI * 2;
      const spd = (0.25 + Math.random() * 0.75) * speedScale;
      p.active = true;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.life = 0;
      p.maxLife = 0.25 + Math.random() * 0.35;
      p.size = 2 + Math.random() * 3.5;
      p.color = color;
    }
  };

  const spawnProjectile = (
    x: number,
    y: number,
    targetX: number,
    targetY: number,
    damage: number,
    color: string,
    isEmp = false,
    isZombieSpit = false,
    targetTowerId?: number,
    isSplash = false
  ) => {
    const sim = simRef.current;
    const proj = sim.projectiles[sim.projectileCursor];
    sim.projectileCursor = (sim.projectileCursor + 1) % MAX_PROJECTILES;
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = isZombieSpit ? 240 : isSplash ? 420 : isEmp ? 360 : 560;
    proj.active = true;
    proj.x = x;
    proj.y = y;
    proj.vx = (dx / dist) * speed;
    proj.vy = (dy / dist) * speed;
    proj.targetX = targetX;
    proj.targetY = targetY;
    proj.damage = damage;
    proj.color = color;
    proj.isEmp = isEmp;
    proj.isSplash = isSplash;
    proj.isZombieSpit = isZombieSpit;
    proj.targetTowerId = targetTowerId;
    proj.radius = isSplash ? 5.5 : isEmp ? 5 : isZombieSpit ? 4.5 : 3;
  };

  const computeUnitCounts = (): Record<DeployableId, number> => {
    const sim = simRef.current;
    const counts: Record<DeployableId, number> = {
      rotary_turret: 0,
      sniper_nest: 0,
      emp_pylon: 0,
      fortress: 0,
      scrap_collector: 0,
      infantry_barracks: 0,
      vehicle_factory: 0,
      forward_hq: 0,
      airstrike: 0,
      unit_command: sim.troops.length,
    };
    for (const t of sim.towers) {
      counts[t.blueprintId] = (counts[t.blueprintId] || 0) + 1;
    }
    return counts;
  };

  const computeTotalScrapPerSec = (currUpgrades: UpgradeStat[]): number => {
    const sim = simRef.current;
    let rate = 0;
    for (const t of sim.towers) {
      if (t.blueprintId === 'scrap_collector' && t.buildProgress >= 1) {
        rate += getScrapCollectorYieldPerSecond(t.level, currUpgrades);
      }
    }
    return Number(rate.toFixed(1));
  };

  const buildHudPayload = (currUpgrades: UpgradeStat[]): HudSyncPayload => {
    const sim = simRef.current;
    const selTower =
      sim.towers.find((t) => t.id === sim.selectedTowerId) || null;
    const mapControl = calculateMapControlPercentage(
      sim.towers,
      sim.baseHp > 0
    );
    const soldierCount = sim.troops.filter(
      (u) => u.unitType === 'soldier'
    ).length;
    const heavyVehicleCount = sim.troops.filter(
      (u) => u.unitType === 'heavy_vehicle'
    ).length;
    const selectedUnitCount = sim.troops.filter((u) => u.selected).length;

    const activeHostiles = sim.zombies.filter((z) => z.koTimer <= 0).length;
    const isInitialPrep =
      sim.wave === 1 &&
      sim.totalSpawnedInWave === 0 &&
      activeHostiles === 0 &&
      sim.spawnTimer > 2.5;
    const isBetweenWaves =
      sim.waveQueue.length === 0 && activeHostiles === 0 && !sim.ended;
    const breathingTimeRemaining = isInitialPrep
      ? Math.ceil(sim.spawnTimer)
      : isBetweenWaves
      ? Math.max(0, Math.ceil(WAVE_BREATHING_SECONDS - sim.waveCooldownTimer))
      : 0;

    return {
      baseHp: Math.round(sim.baseHp),
      baseMaxHp: sim.baseMaxHp,
      wave: sim.wave,
      threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
      zombiesRemaining: sim.waveQueue.length + activeHostiles,
      breathingTimeRemaining,
      activeTowerCount: sim.towers.length,
      maxTowerSlots: getMaxTowerSlots(currUpgrades, mapControl.hqCount),
      scrapPerSec: computeTotalScrapPerSec(currUpgrades),
      playerControlPercent: mapControl.playerPercent,
      zombieControlPercent: mapControl.zombiePercent,
      hqCount: mapControl.hqCount,
      capturedZonesCount: mapControl.hqCount,
      totalZonesCount: 5,
      zones: sim.zones.map((z) => ({ ...z })),
      priorityZoneId: sim.priorityZoneId,
      soldierCount,
      heavyVehicleCount,
      selectedUnitCount,
      unitCountsByType: computeUnitCounts(),
      selectedTower: selTower ? { ...selTower } : null,
      statusAlert: sim.statusAlert,
    };
  };

  // Manual Unit Recruitment from the UNITS Tab (Unlocked when Barracks / Vehicle Factory is built)
  useEffect(() => {
    if (!trainUnitSignal) return;
    const sim = simRef.current;
    if (sim.ended) return;
    const { unitType } = trainUnitSignal;
    const counts = computeUnitCounts();
    const check = canTrainUnit(unitType, propsRef.current.scrap, counts);
    if (!check.allowed) {
      sim.statusAlert = check.reason || 'CANNOT TRAIN UNIT';
      sim.statusAlertTimer = 3.0;
      propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
      return;
    }

    const requiredBuildingId = TRAINABLE_UNITS[unitType].requiredBuildingId;
    const producer =
      sim.towers.find((t) => t.blueprintId === requiredBuildingId) || null;
    const spawnOriginX = producer ? producer.x : 0.5;
    const spawnOriginY = producer ? producer.y : 0.5;
    const producerLevel = producer ? producer.level : 1;

    propsRef.current.onSpendScrap(check.costScrap);

    const currUpgrades = propsRef.current.upgrades;
    const trainingUpgrade = currUpgrades.find((u) => u.id === 'troop_Training');
    const dmgUpgrade = currUpgrades.find((u) => u.id === 'turret_damage');
    const unitMult =
      1 +
      ((trainingUpgrade ? trainingUpgrade.level : 1) - 1) * 0.18 +
      (producerLevel - 1) * 0.22;
    const dmgMult =
      1 +
      ((dmgUpgrade ? dmgUpgrade.level : 1) - 1) * 0.15 +
      (producerLevel - 1) * 0.22;

    const isVehicle = unitType === 'heavy_vehicle';
    const hp = Math.round((isVehicle ? 460 : 185) * unitMult);
    const damage = Math.round((isVehicle ? 56 : 17) * dmgMult);

    // New unit spawns at its off-road producer building, exits onto the nearest real road, and follows real roads!
    const roadExit = projectPointToNearestRoad(
      spawnOriginX,
      spawnOriginY,
      propsRef.current.activeSector.roads
    );
    const offsetAngle = (sim.troops.length * 1.1) % (Math.PI * 2);
    const desiredTargetX =
      sim.armyOrderTimer > 0
        ? sim.armyRallyX
        : Math.max(
            0.12,
            Math.min(0.88, roadExit.x + Math.cos(offsetAngle) * 0.08)
          );
    const desiredTargetY =
      sim.armyOrderTimer > 0
        ? sim.armyRallyY
        : Math.max(
            0.12,
            Math.min(0.86, roadExit.y + Math.sin(offsetAngle) * 0.08)
          );

    const roadPath = computeRoadNetworkPath(
      spawnOriginX,
      spawnOriginY,
      desiredTargetX,
      desiredTargetY,
      propsRef.current.activeSector.roads
    );
    const finalRoadDest = roadPath[roadPath.length - 1] || roadExit;

    sim.troops.push({
      id: sim.nextEntityId++,
      unitType,
      ownerBuildingId: producer?.id,
      selected: true,
      x: spawnOriginX,
      y: spawnOriginY,
      rallyX: finalRoadDest.x,
      rallyY: finalRoadDest.y,
      roadPath,
      roadPathIndex: 0,
      hp,
      maxHp: hp,
      range: isVehicle ? 160 : 125,
      damage,
      fireRate: isVehicle ? 1.2 : 2.6,
      speed: isVehicle ? 0.062 : 0.082,
      cooldown: 0,
      angle: Math.atan2(roadExit.y - spawnOriginY, roadExit.x - spawnOriginX),
      gaitPhase: 0,
      flashTimer: 0,
    });

    soundEngine.playDeploy();
    triggerAndroidHaptic('deploy');
    spawnParticles(
      spawnOriginX * 1000,
      spawnOriginY * 650,
      14,
      isVehicle ? '#06b6d4' : '#10b981',
      95
    );
    sim.statusAlert = `${TRAINABLE_UNITS[unitType].name.toUpperCase()} EXITED BUILDING ONTO REAL ROAD! TAP [MOVE UNITS] OR LONG-PRESS MAP`;
    sim.statusAlertTimer = 3.4;
    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  }, [trainUnitSignal]);

  // Filter / Select Soldiers & Heavy Vehicles from HUD Army Bar
  useEffect(() => {
    if (!unitSelectFilterSignal) return;
    const sim = simRef.current;
    const { filter } = unitSelectFilterSignal;
    let count = 0;
    for (const u of sim.troops) {
      if (filter === 'all') {
        u.selected = true;
        count++;
      } else if (u.unitType === filter) {
        u.selected = true;
        count++;
      } else {
        u.selected = false;
      }
    }
    const label =
      filter === 'all'
        ? 'ALL SOLDIERS & VEHICLES'
        : filter === 'soldier'
        ? 'SOLDIER SQUADS'
        : 'HEAVY SIEGE VEHICLES';
    sim.statusAlert = `${count} ${label} SELECTED — CLICK OR RIGHT-CLICK MAP TO MOVE/ATTACK`;
    sim.statusAlertTimer = 3.5;
    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  }, [unitSelectFilterSignal]);

  // Quick-rally units to a quadrant along real roads when clicked in HUD
  useEffect(() => {
    if (!focusZoneIdSignal) return;
    const sim = simRef.current;
    const targetZone = sim.zones.find((z) => z.id === focusZoneIdSignal.zoneId);
    if (!targetZone) return;
    const snappedZoneRoad = projectPointToNearestRoad(
      targetZone.x,
      targetZone.y,
      propsRef.current.activeSector.roads
    );
    sim.priorityZoneId = targetZone.id;
    sim.armyRallyX = snappedZoneRoad.x;
    sim.armyRallyY = snappedZoneRoad.y;
    sim.armyOrderTimer = 2.5;
    sim.statusAlert = `ARMY MOVING ALONG REAL ROADS TO SECURE ${targetZone.name.toUpperCase()}`;
    sim.statusAlertTimer = 3.0;
    for (const unit of sim.troops) {
      if (unit.selected || sim.troops.every((t) => !t.selected)) {
        unit.selected = true;
        const path = computeRoadNetworkPath(
          unit.x,
          unit.y,
          snappedZoneRoad.x,
          snappedZoneRoad.y,
          propsRef.current.activeSector.roads
        );
        const dest = path[path.length - 1] || snappedZoneRoad;
        unit.roadPath = path;
        unit.roadPathIndex = 0;
        unit.rallyX = dest.x;
        unit.rallyY = dest.y;
      }
    }
    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  }, [focusZoneIdSignal]);

  // Initialize or reset simulation when sector or resetSignal changes
  useEffect(() => {
    const sim = simRef.current;
    const maxHp = getMaxBaseHp(propsRef.current.upgrades);
    const initialZones = createInitialFortressZones(
      propsRef.current.activeSector
    );

    sim.baseMaxHp = maxHp;
    sim.baseHp = maxHp;
    sim.wave = 1;
    sim.waveQueue = createZombieWaveComposition(1);
    sim.totalSpawnedInWave = 0;
    sim.spawnTimer = INITIAL_PREP_SECONDS;
    sim.waveCooldownTimer = 0;
    sim.zones = initialZones;
    sim.priorityZoneId = 'fortress_nw';
    sim.liberationHoldTimer = 0;
    sim.armyRallyX = 0.5;
    sim.armyRallyY = 0.36;
    sim.armyOrderTimer = 0;
    sim.statusAlert =
      '12s PREP TIME: BUILD ECONOMY/DEFENSES, UNLOCK BARRACKS/FACTORY FOR UNITS, AND EXPAND SQUARE HQ ZONES';
    sim.statusAlertTimer = 6.0;
    sim.zombies = [];
    sim.towers = [];
    // Units unlock when player builds Infantry Barracks or Heavy Vehicle Factory first, then trains them in UNITS tab
    sim.troops = [];
    sim.selectedTowerId = null;
    sim.zombiesEliminated = 0;
    sim.scrapEarnedRun = 0;
    sim.gemsEarnedRun = 0;
    sim.scoreRun = 0;
    sim.ended = false;

    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  }, [resetSignal, activeSector.id]);

  // Trigger early next wave when requested (skips remaining breathing time)
  useEffect(() => {
    if (nextWaveSignal === 0) return;
    const sim = simRef.current;
    if (sim.ended) return;
    const activeHostiles = sim.zombies.filter((z) => z.koTimer <= 0).length;
    if (sim.wave === 1 && sim.totalSpawnedInWave === 0 && sim.spawnTimer > 0.5) {
      // Skip initial prep time for Wave 1
      sim.spawnTimer = 0.2;
      sim.scrapEarnedRun += 25;
      propsRef.current.onEarnScrapAndGems(25, 4, 90);
      return;
    }
    if (sim.waveQueue.length === 0 && activeHostiles === 0) {
      // Currently in breathing time between waves -> start next wave immediately
      sim.waveCooldownTimer = WAVE_BREATHING_SECONDS;
      sim.scrapEarnedRun += 25;
      propsRef.current.onEarnScrapAndGems(25, 4, 90);
      return;
    }
    sim.wave += 1;
    const nextWaveHostiles = createZombieWaveComposition(sim.wave);
    sim.waveQueue.push(...nextWaveHostiles);
    sim.totalSpawnedInWave = 0;
    sim.spawnTimer = 0.25;
    sim.waveCooldownTimer = 0;
    sim.scrapEarnedRun += 25;
    propsRef.current.onEarnScrapAndGems(25, 4, 90);
  }, [nextWaveSignal]);

  // Upgrade selected building
  useEffect(() => {
    if (upgradeTowerSignal === 0) return;
    const sim = simRef.current;
    if (!sim.selectedTowerId) return;
    const tower = sim.towers.find((t) => t.id === sim.selectedTowerId);
    if (!tower || tower.level >= 5) return;

    const eff = getEffectiveTowerStats(
      tower.blueprintId,
      tower.level,
      propsRef.current.upgrades
    );
    if (propsRef.current.scrap < eff.upgradeCostScrap) return;

    propsRef.current.onSpendScrap(eff.upgradeCostScrap);
    tower.level += 1;
    const nextStats = getEffectiveTowerStats(
      tower.blueprintId,
      tower.level,
      propsRef.current.upgrades
    );
    tower.damage = nextStats.damage;
    tower.range = nextStats.range;
    tower.fireRate = nextStats.fireRate;
    tower.maxHp = nextStats.maxHp;
    tower.hp = nextStats.maxHp;
    tower.heat = 0;
    tower.overheated = false;
    soundEngine.playDeploy();
    spawnParticles(tower.x * 1000, tower.y * 650, 14, '#f59e0b', 110);
  }, [upgradeTowerSignal]);

  // Repair & Vent selected building
  useEffect(() => {
    if (repairTowerSignal === 0) return;
    const sim = simRef.current;
    if (!sim.selectedTowerId) return;
    const tower = sim.towers.find((t) => t.id === sim.selectedTowerId);
    if (!tower) return;
    if (tower.hp >= tower.maxHp && !tower.overheated && tower.heat < 0.25) return;

    const missingRatio = Math.max(0.25, 1 - tower.hp / tower.maxHp);
    const repairCost = Math.max(25, Math.round(missingRatio * 75));
    if (propsRef.current.scrap < repairCost) return;

    propsRef.current.onSpendScrap(repairCost);
    tower.hp = tower.maxHp;
    tower.heat = 0;
    tower.overheated = false;
    soundEngine.playDeploy();
    spawnParticles(tower.x * 1000, tower.y * 650, 12, '#10b981', 90);
  }, [repairTowerSignal]);

  // Sell selected building
  useEffect(() => {
    if (sellTowerSignal === 0) return;
    const sim = simRef.current;
    if (!sim.selectedTowerId) return;
    const idx = sim.towers.findIndex((t) => t.id === sim.selectedTowerId);
    if (idx === -1) return;
    const tower = sim.towers[idx];
    const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];
    const hpFactor = Math.max(0.25, tower.hp / tower.maxHp);
    const refund = Math.round(bp.baseCost * 0.6 * tower.level * hpFactor);
    sim.towers.splice(idx, 1);
    sim.selectedTowerId = null;
    propsRef.current.onEarnScrapAndGems(refund, 0, 0);
    soundEngine.playDeploy();
    triggerAndroidHaptic('tap');
  }, [sellTowerSignal]);

  // Deselect currently inspected building (used by Android touch sheet 'Done' button)
  useEffect(() => {
    if (deselectTowerSignal === 0) return;
    simRef.current.selectedTowerId = null;
    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  }, [deselectTowerSignal]);

  // Issue Move / Attack-Move command to selected Soldiers & Heavy Vehicles strictly along REAL ROADS
  const orderUnitsToMapCoordinate = (
    normX: number,
    normY: number,
    clickX: number,
    clickY: number
  ) => {
    const sim = simRef.current;
    if (sim.troops.length === 0) {
      sim.statusAlert =
        'NO UNITS ACTIVE — BUILD INFANTRY BARRACKS OR HEAVY VEHICLE FACTORY';
      sim.statusAlertTimer = 2.8;
      return;
    }

    // Snap target destination to the nearest real road in the city
    const roads = propsRef.current.activeSector.roads;
    const snappedTarget = projectPointToNearestRoad(normX, normY, roads);

    // If no units are currently selected, select all units automatically
    const hasSelected = sim.troops.some((u) => u.selected);
    const orderedUnits = hasSelected
      ? sim.troops.filter((u) => u.selected)
      : sim.troops;

    orderedUnits.forEach((u, idx) => {
      u.selected = true;
      const spreadAngle = (idx / Math.max(1, orderedUnits.length)) * Math.PI * 2;
      const spreadOffset = orderedUnits.length > 1 ? 0.015 : 0;
      const desiredX = snappedTarget.x + Math.cos(spreadAngle) * spreadOffset;
      const desiredY = snappedTarget.y + Math.sin(spreadAngle) * spreadOffset;
      const roadPath = computeRoadNetworkPath(u.x, u.y, desiredX, desiredY, roads);
      const finalPt = roadPath[roadPath.length - 1] || snappedTarget;
      u.roadPath = roadPath;
      u.roadPathIndex = 0;
      u.rallyX = finalPt.x;
      u.rallyY = finalPt.y;
    });

    sim.armyRallyX = snappedTarget.x;
    sim.armyRallyY = snappedTarget.y;
    sim.armyOrderTimer = 2.4;
    sim.statusAlert = `ORDERED ${orderedUnits.length} UNIT${
      orderedUnits.length > 1 ? 'S' : ''
    } ALONG REAL ROADS TO (${Math.round(snappedTarget.x * 100)}%, ${Math.round(
      snappedTarget.y * 100
    )}%)`;
    sim.statusAlertTimer = 2.8;
    soundEngine.playDeploy();
    triggerAndroidHaptic('command');
    spawnParticles(clickX, clickY, 12, '#34d399', 85);
    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  };

  // Main 60Hz simulation & rendering loop mounted once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!maskCanvasRef.current) {
      maskCanvasRef.current = document.createElement('canvas');
    }

    let animationFrameId = 0;
    let lastTime = performance.now();
    let hudSyncAccumulator = 0;

    const updateDimensions = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (rect.width > 0 && rect.height > 0) {
        canvas.width = Math.floor(rect.width * dpr);
        canvas.height = Math.floor(rect.height * dpr);
      }
    };

    updateDimensions();
    const resizeObserver = new ResizeObserver(updateDimensions);
    resizeObserver.observe(canvas);

    // Spawn zombies from EVERY direction (360° around the map perimeter and out of Zombie-Controlled Area)
    const spawnNextZombieFromQueue = (sector: CitySector, waveNum: number) => {
      const sim = simRef.current;
      const arch = sim.waveQueue.shift();
      if (!arch) return;

      const spawnInfo = create360ZombieSpawnPoint(
        sim.totalSpawnedInWave++,
        18 + waveNum * 4,
        sector
      );
      const scaling = getWaveDifficultyScaling(waveNum);

      let baseHp = 74;
      let baseSpeed = 0.052;
      let radius = 9;
      let baseDamage = 18;
      let scrapReward = 12;

      if (arch === 'runner') {
        baseHp = 48;
        baseSpeed = 0.092;
        radius = 7.5;
        baseDamage = 15;
        scrapReward = 15;
      } else if (arch === 'spitter') {
        baseHp = 64;
        baseSpeed = 0.048;
        radius = 8.5;
        baseDamage = 23;
        scrapReward = 19;
      } else if (arch === 'juggernaut') {
        baseHp = 275;
        baseSpeed = 0.032;
        radius = 14;
        baseDamage = 65;
        scrapReward = 42;
      }

      const hp = Math.round(baseHp * scaling.hpMultiplier);
      const speed = baseSpeed * scaling.speedMultiplier;
      const damage = Math.round(baseDamage * scaling.damageMultiplier);

      sim.zombies.push({
        id: sim.nextEntityId++,
        archetype: arch,
        x: spawnInfo.x,
        y: spawnInfo.y,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        speed,
        radius,
        damage,
        scrapReward,
        roadIndex: spawnInfo.roadIndex,
        waypointIndex: 1,
        slowTimer: 0,
        flashTimer: 0,
        windupTimer: 0,
        isWindingUp: false,
        koTimer: 0,
        koVx: 0,
        koVy: 0,
        gaitPhase: Math.random() * Math.PI * 2,
      });
    };

    const tick = (now: number) => {
      const rawDt = (now - lastTime) / 1000;
      lastTime = now;
      const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

      const {
        gameState: currentState,
        activeSector: sector,
        upgrades: currUpgrades,
      } = propsRef.current;
      const sim = simRef.current;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;

      sim.radarAngle = (sim.radarAngle + dt * 1.1) % (Math.PI * 2);
      sim.cameraTrauma = Math.max(0, sim.cameraTrauma - dt * 1.8);
      sim.armyOrderTimer = Math.max(0, sim.armyOrderTimer - dt);
      if (sim.statusAlertTimer > 0) {
        sim.statusAlertTimer = Math.max(0, sim.statusAlertTimer - dt);
        if (sim.statusAlertTimer <= 0) {
          sim.statusAlert = null;
        }
      }

      // Advance simulation when in 'playing'
      if (currentState === 'playing' && !sim.ended && width > 0 && height > 0) {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          // 1. Spawn zombies from 360° wave queue with generous breathing time between waves
          const currentWaveScaling = getWaveDifficultyScaling(sim.wave);
          if (sim.waveQueue.length > 0) {
            sim.spawnTimer -= dt;
            if (sim.spawnTimer <= 0) {
              spawnNextZombieFromQueue(sector, sim.wave);
              sim.spawnTimer = currentWaveScaling.spawnIntervalSeconds;
            }
          } else if (sim.zombies.length === 0) {
            if (sim.waveCooldownTimer === 0) {
              // Wave just cleared! Award wave clear bonus and begin 16s Breathing Time
              const clearBonusScrap = currentWaveScaling.waveClearScrapBonus;
              const clearBonusGems = currentWaveScaling.waveClearGemsBonus;
              sim.scrapEarnedRun += clearBonusScrap;
              sim.gemsEarnedRun += clearBonusGems;
              sim.scoreRun += clearBonusScrap * 5;
              propsRef.current.onEarnScrapAndGems(
                clearBonusScrap,
                clearBonusGems,
                clearBonusScrap * 5
              );
              sim.statusAlert = `WAVE ${sim.wave} CLEARED (+${clearBonusScrap} SCRAP) — ${WAVE_BREATHING_SECONDS}s BREATHING TIME BEFORE NEXT ATTACK`;
              sim.statusAlertTimer = 5.0;
            }
            sim.waveCooldownTimer += dt;
            if (sim.waveCooldownTimer >= WAVE_BREATHING_SECONDS) {
              sim.wave += 1;
              sim.waveQueue = createZombieWaveComposition(sim.wave);
              sim.totalSpawnedInWave = 0;
              sim.spawnTimer = 1.2;
              sim.waveCooldownTimer = 0;
              sim.statusAlert = `WARNING: WAVE ${sim.wave} ZOMBIE ASSAULT INCOMING FROM ALL DIRECTIONS!`;
              sim.statusAlertTimer = 3.5;
              soundEngine.playDeploy();
            }
          }

          // 1.5. Check Whole-Map Territory Control Victory (100% Player-Controlled Area)
          const mapControl = calculateMapControlPercentage(
            sim.towers,
            sim.baseHp > 0
          );
          if (mapControl.playerPercent >= 100) {
            sim.liberationHoldTimer += dt;
            if (sim.liberationHoldTimer >= 1.0 && !sim.ended) {
              sim.ended = true;
              soundEngine.playFanfare(true);
              const victoryBonusScrap = 500;
              const victoryBonusGems = 75;
              sim.scrapEarnedRun += victoryBonusScrap;
              sim.gemsEarnedRun += victoryBonusGems;
              sim.scoreRun += 3000;
              propsRef.current.onEarnScrapAndGems(
                victoryBonusScrap,
                victoryBonusGems,
                3000
              );
              propsRef.current.onGameEnd({
                victory: true,
                sectorName: sector.name,
                waveReached: sim.wave,
                zonesCaptured: mapControl.hqCount,
                totalZones: 5,
                mapControlPercent: 100,
                hqCount: mapControl.hqCount,
                threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
                zombiesEliminated: sim.zombiesEliminated,
                scrapEarned: sim.scrapEarnedRun,
                gemsEarned: sim.gemsEarnedRun,
                baseHpRemaining: Math.round(sim.baseHp),
                baseMaxHp: sim.baseMaxHp,
                score: sim.scoreRun,
              });
            }
          } else {
            sim.liberationHoldTimer = 0;
          }

          // 2. Update Player-Controlled Soldiers & Heavy Vehicles
          for (let i = sim.troops.length - 1; i >= 0; i--) {
            const troop = sim.troops[i];
            troop.flashTimer = Math.max(0, troop.flashTimer - dt);
            troop.cooldown = Math.max(0, troop.cooldown - dt);

            let closestZ: ZombieEntity | null = null;
            let closestDistPx = troop.range;

            for (const z of sim.zombies) {
              if (z.koTimer > 0) continue;
              const dPx = Math.hypot(
                (z.x - troop.x) * width,
                (z.y - troop.y) * height
              );
              if (dPx < closestDistPx) {
                closestDistPx = dPx;
                closestZ = z;
              }
            }

            // Move strictly along real road waypoints (`troop.roadPath`) after exiting producer building
            const activePath = troop.roadPath;
            const pathIdx = troop.roadPathIndex ?? 0;
            const currentWp =
              activePath && activePath.length > 0
                ? activePath[Math.min(pathIdx, activePath.length - 1)]
                : { x: troop.rallyX, y: troop.rallyY };

            const dxR = currentWp.x - troop.x;
            const dyR = currentWp.y - troop.y;
            const distR = Math.hypot(dxR, dyR);
            if (distR > 0.005) {
              const step = Math.min(distR, troop.speed * dt);
              troop.x += (dxR / distR) * step;
              troop.y += (dyR / distR) * step;
              troop.gaitPhase +=
                dt * (troop.unitType === 'heavy_vehicle' ? 6 : 12);
              troop.angle = Math.atan2(dyR, dxR);
            } else if (activePath && pathIdx < activePath.length - 1) {
              troop.roadPathIndex = pathIdx + 1;
            }

            // Fire on zombies in range while moving or holding ground
            if (closestZ) {
              troop.angle = Math.atan2(
                (closestZ.y - troop.y) * height,
                (closestZ.x - troop.x) * width
              );
              if (troop.cooldown <= 0) {
                troop.cooldown = 1 / troop.fireRate;
                const isTank = troop.unitType === 'heavy_vehicle';
                spawnProjectile(
                  troop.x * width,
                  troop.y * height,
                  closestZ.x * width,
                  closestZ.y * height,
                  troop.damage,
                  isTank ? '#06b6d4' : '#10b981',
                  false,
                  false,
                  undefined,
                  isTank
                );
                soundEngine.playShot(isTank ? 'sniper' : 'troop');
              }
            }
          }

          // 2.5. Update Primary HQ Automated Point-Defense Cannon at (0.5, 0.5)
          const hqWeapon = getHqDefenseWeaponStats(currUpgrades);
          sim.hqCooldown = Math.max(0, sim.hqCooldown - dt);
          sim.hqRecoil = Math.max(0, sim.hqRecoil - dt * 6.5);

          let hqTarget: ZombieEntity | null = null;
          let hqBestDist = hqWeapon.range;
          const hqCenterX = 0.5 * width;
          const hqCenterY = 0.5 * height;

          for (const z of sim.zombies) {
            if (z.koTimer > 0) continue;
            const dHqPx = Math.hypot(
              z.x * width - hqCenterX,
              z.y * height - hqCenterY
            );
            if (dHqPx <= hqBestDist) {
              hqBestDist = dHqPx;
              hqTarget = z;
            }
          }

          if (hqTarget) {
            sim.hqAngle = Math.atan2(
              hqTarget.y * height - hqCenterY,
              hqTarget.x * width - hqCenterX
            );
            if (sim.hqCooldown <= 0) {
              sim.hqCooldown = 1 / hqWeapon.fireRate;
              sim.hqRecoil = 1;
              const barrelTipX = hqCenterX + Math.cos(sim.hqAngle) * 24;
              const barrelTipY = hqCenterY + Math.sin(sim.hqAngle) * 24;
              spawnProjectile(
                barrelTipX,
                barrelTipY,
                hqTarget.x * width,
                hqTarget.y * height,
                hqWeapon.damage,
                '#fbbf24',
                false,
                false
              );
              spawnParticles(barrelTipX, barrelTipY, 4, '#f59e0b', 65);
              soundEngine.playShot('turret');
            }
          } else {
            sim.hqAngle = sim.radarAngle + 0.25;
          }

          // 3. Update All Built Base Structures (Towers, Heavy Fortresses, Scrap Refineries, Barracks, Vehicle Factories, Forward HQs)
          for (const tower of sim.towers) {
            tower.cooldown = Math.max(0, tower.cooldown - dt);
            tower.recoil = Math.max(0, tower.recoil - dt * 6);

            // On-site construction assembly takes 2.2 seconds
            if (tower.buildProgress < 1) {
              tower.buildProgress = Math.min(1, tower.buildProgress + dt / 2.2);
              if (tower.buildProgress >= 1) {
                if (tower.blueprintId === 'infantry_barracks') {
                  sim.statusAlert =
                    'INFANTRY BARRACKS READY! OPEN [UNITS] TAB TO TRAIN RIFLE SOLDIERS';
                  sim.statusAlertTimer = 4.0;
                } else if (tower.blueprintId === 'vehicle_factory') {
                  sim.statusAlert =
                    'VEHICLE FACTORY READY! OPEN [UNITS] TAB TO TRAIN HEAVY SIEGE TANKS';
                  sim.statusAlertTimer = 4.0;
                }
              }
              continue;
            }

            const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];

            // 3A. Economy Building: Scrap Refinery (`scrap_collector`)
            if (bp.category === 'economy') {
              tower.angle = (tower.angle + dt * 1.8) % (Math.PI * 2);
              tower.productionTimer += dt;
              if (tower.productionTimer >= 2.0) {
                tower.productionTimer -= 2.0;
                const yieldPerSec = getScrapCollectorYieldPerSecond(
                  tower.level,
                  currUpgrades
                );
                const scrapBatch = Math.round(yieldPerSec * 2);
                sim.scrapEarnedRun += scrapBatch;
                sim.scoreRun += scrapBatch * 2;
                propsRef.current.onEarnScrapAndGems(
                  scrapBatch,
                  0,
                  scrapBatch * 2
                );
                spawnParticles(
                  tower.x * width,
                  tower.y * height,
                  6,
                  '#eab308',
                  55
                );
              }
              continue;
            }

            // 3C. Combat Firing (Defensive Towers, Heavy Fortresses, Forward HQs, and Producer Self-Defense)
            if (tower.overheated) {
              tower.heat = Math.max(0, tower.heat - dt * 0.42);
              if (tower.heat <= 0.02) {
                tower.heat = 0;
                tower.overheated = false;
              }
              continue;
            } else {
              tower.heat = Math.max(0, tower.heat - dt * 0.16);
            }

            let target: ZombieEntity | null = null;
            let bestDist = tower.range;

            for (const z of sim.zombies) {
              if (z.koTimer > 0) continue;
              const dPx = Math.hypot(
                (z.x - tower.x) * width,
                (z.y - tower.y) * height
              );
              if (dPx <= bestDist) {
                bestDist = dPx;
                target = z;
              }
            }

            if (target) {
              tower.angle = Math.atan2(
                (target.y - tower.y) * height,
                (target.x - tower.x) * width
              );
              if (tower.cooldown <= 0) {
                tower.cooldown = 1 / tower.fireRate;
                tower.recoil = 1;
                const isEmp = tower.blueprintId === 'emp_pylon';
                const isFortress = tower.blueprintId === 'fortress';

                if (bp.category === 'tower') {
                  const heatPerShot =
                    tower.blueprintId === 'rotary_turret'
                      ? 0.07
                      : tower.blueprintId === 'sniper_nest'
                      ? 0.2
                      : 0.13;
                  tower.heat = Math.min(1, tower.heat + heatPerShot);
                  if (tower.heat >= 1) {
                    tower.overheated = true;
                    spawnParticles(
                      tower.x * width,
                      tower.y * height,
                      10,
                      '#f97316',
                      75
                    );
                  }
                }

                spawnProjectile(
                  tower.x * width,
                  tower.y * height,
                  target.x * width,
                  target.y * height,
                  bp.category === 'producer'
                    ? Math.round(tower.damage * 0.45)
                    : tower.damage,
                  bp.color,
                  isEmp,
                  false,
                  undefined,
                  isFortress
                );
                soundEngine.playShot(
                  tower.blueprintId === 'sniper_nest' || isFortress
                    ? 'sniper'
                    : isEmp
                    ? 'emp'
                    : 'turret'
                );
              }
            }
          }

          // 4. Update Zombies (360° Assault on Player HQs, Heavy Fortresses, Buildings, and Soldiers/Vehicles)
          for (let i = sim.zombies.length - 1; i >= 0; i--) {
            const z = sim.zombies[i];
            z.flashTimer = Math.max(0, z.flashTimer - dt);
            z.slowTimer = Math.max(0, z.slowTimer - dt);

            if (z.koTimer > 0) {
              z.koTimer -= dt;
              z.x += z.koVx * dt;
              z.y += z.koVy * dt;
              if (z.koTimer <= 0) {
                sim.zombies.splice(i, 1);
              }
              continue;
            }

            // 4A. Engage nearby Soldiers & Heavy Vehicles
            let nearestTroop: TroopEntity | null = null;
            let nearestTroopDistPx = Infinity;
            for (const u of sim.troops) {
              const dU = Math.hypot((u.x - z.x) * width, (u.y - z.y) * height);
              if (dU < nearestTroopDistPx) {
                nearestTroopDistPx = dU;
                nearestTroop = u;
              }
            }

            if (nearestTroop && nearestTroopDistPx <= 42) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              if (z.windupTimer >= 0.42) {
                z.windupTimer = 0;
                nearestTroop.hp -= z.damage * 0.9;
                nearestTroop.flashTimer = 0.08;
                spawnParticles(
                  nearestTroop.x * width,
                  nearestTroop.y * height,
                  6,
                  '#ef4444',
                  75
                );
                if (nearestTroop.hp <= 0) {
                  spawnParticles(
                    nearestTroop.x * width,
                    nearestTroop.y * height,
                    18,
                    '#f97316',
                    120
                  );
                  const uIdx = sim.troops.findIndex(
                    (u) => u.id === nearestTroop!.id
                  );
                  if (uIdx !== -1) sim.troops.splice(uIdx, 1);
                }
              }
              continue;
            }

            // 4B. Find nearest Player Building (Forward HQ, Heavy Fortress, Tower, Refinery, Barracks, Factory)
            let nearestTower: TowerEntity | null = null;
            let nearestTowerDistPx = Infinity;
            for (const t of sim.towers) {
              const dT = Math.hypot((t.x - z.x) * width, (t.y - z.y) * height);
              if (dT < nearestTowerDistPx) {
                nearestTowerDistPx = dT;
                nearestTower = t;
              }
            }

            const distToHqPx = Math.hypot(
              (0.5 - z.x) * width,
              (0.5 - z.y) * height
            );

            // Spitter ranged acid attack on buildings or Primary HQ
            if (
              z.archetype === 'spitter' &&
              (nearestTowerDistPx <= 145 || distToHqPx <= 155)
            ) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              if (z.windupTimer >= 0.72) {
                z.windupTimer = 0;
                const aimAtTower =
                  nearestTower &&
                  nearestTowerDistPx <= 145 &&
                  nearestTowerDistPx < distToHqPx;
                spawnProjectile(
                  z.x * width,
                  z.y * height,
                  aimAtTower ? nearestTower!.x * width : 0.5 * width,
                  aimAtTower ? nearestTower!.y * height : 0.5 * height,
                  z.damage,
                  '#84cc16',
                  false,
                  true,
                  aimAtTower ? nearestTower!.id : undefined
                );
              }
              continue;
            }

            // Melee attack on any roadside Player Building (Forward HQ, Heavy Fortress, Tower, etc.)
            if (nearestTower && nearestTowerDistPx <= 54) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              if (z.windupTimer >= 0.44) {
                z.windupTimer = 0;
                nearestTower.hp -= z.damage * 0.85;
                spawnParticles(
                  nearestTower.x * width,
                  nearestTower.y * height,
                  8,
                  '#f59e0b',
                  90
                );
                if (nearestTower.hp <= 0) {
                  soundEngine.playHeavyExplosion();
                  sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.45);
                  spawnParticles(
                    nearestTower.x * width,
                    nearestTower.y * height,
                    26,
                    '#ef4444',
                    145
                  );
                  if (
                    nearestTower.blueprintId === 'forward_hq' ||
                    nearestTower.blueprintId === 'fortress'
                  ) {
                    sim.statusAlert = `WARNING: ${DEPLOYABLE_BLUEPRINTS[
                      nearestTower.blueprintId
                    ].name.toUpperCase()} DESTROYED — AREA LOST TO ZOMBIES!`;
                    sim.statusAlertTimer = 4.0;
                  }
                  const tIdx = sim.towers.findIndex(
                    (t) => t.id === nearestTower!.id
                  );
                  if (tIdx !== -1) sim.towers.splice(tIdx, 1);
                  if (sim.selectedTowerId === nearestTower.id) {
                    sim.selectedTowerId = null;
                  }
                }
              }
              continue;
            }

            // Reaching Primary HQ Perimeter (44px)
            if (distToHqPx <= 44) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              const requiredWindup = z.archetype === 'juggernaut' ? 0.65 : 0.35;
              if (z.windupTimer >= requiredWindup) {
                z.windupTimer = 0;
                sim.baseHp = Math.max(0, sim.baseHp - z.damage);
                sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.45);
                soundEngine.playBaseHit();
                spawnParticles(0.5 * width, 0.5 * height, 14, '#ef4444', 120);

                if (z.archetype !== 'juggernaut') {
                  sim.zombies.splice(i, 1);
                }

                if (sim.baseHp <= 0 && !sim.ended) {
                  sim.ended = true;
                  soundEngine.playFanfare(false);
                  const ctrl = calculateMapControlPercentage(sim.towers, false);
                  propsRef.current.onGameEnd({
                    victory: false,
                    sectorName: sector.name,
                    waveReached: sim.wave,
                    zonesCaptured: ctrl.hqCount,
                    totalZones: 5,
                    mapControlPercent: ctrl.playerPercent,
                    hqCount: ctrl.hqCount,
                    threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
                    zombiesEliminated: sim.zombiesEliminated,
                    scrapEarned: sim.scrapEarnedRun,
                    gemsEarned: sim.gemsEarnedRun,
                    baseHpRemaining: 0,
                    baseMaxHp: sim.baseMaxHp,
                    score: sim.scoreRun,
                  });
                }
              }
              continue;
            }

            // 4C. Real-Road-Only Zombie Pathfinding: Zombies strictly follow the real city road segments (`road.points`)!
            const road =
              sector.roads[z.roadIndex % Math.max(1, sector.roads.length)];
            let goalX = 0.5;
            let goalY = 0.5;
            if (road && road.points.length > 0) {
              const wpIndex = Math.min(
                z.waypointIndex,
                road.points.length - 1
              );
              const wp = road.points[wpIndex];
              goalX = wp.x;
              goalY = wp.y;
              if (
                Math.hypot(goalX - z.x, goalY - z.y) <= 0.012 &&
                z.waypointIndex < road.points.length - 1
              ) {
                z.waypointIndex += 1;
                const nextWp = road.points[z.waypointIndex];
                goalX = nextWp.x;
                goalY = nextWp.y;
              }
            }

            const dx = goalX - z.x;
            const dy = goalY - z.y;
            const dist = Math.hypot(dx, dy) || 1;
            const slowMult = z.slowTimer > 0 ? 0.48 : 1;
            const effSpeed = z.speed * slowMult;
            const nx = dx / dist;
            const ny = dy / dist;
            z.x += nx * effSpeed * dt;
            z.y += ny * effSpeed * dt;
            z.gaitPhase += dt * (z.archetype === 'runner' ? 14 : 8);
          }

          // 5. Update Projectiles
          for (const proj of sim.projectiles) {
            if (!proj.active) continue;
            proj.x += proj.vx * dt;
            proj.y += proj.vy * dt;

            if (
              proj.x < 0 ||
              proj.x > width ||
              proj.y < 0 ||
              proj.y > height
            ) {
              proj.active = false;
              continue;
            }

            if (proj.isZombieSpit) {
              let hitTower = false;
              for (let tIdx = sim.towers.length - 1; tIdx >= 0; tIdx--) {
                const t = sim.towers[tIdx];
                const dT = Math.hypot(
                  proj.x - t.x * width,
                  proj.y - t.y * height
                );
                if (dT <= 20) {
                  proj.active = false;
                  hitTower = true;
                  t.hp -= proj.damage * 0.85;
                  spawnParticles(proj.x, proj.y, 8, '#84cc16', 80);
                  if (t.hp <= 0) {
                    soundEngine.playHeavyExplosion();
                    spawnParticles(
                      t.x * width,
                      t.y * height,
                      22,
                      '#ef4444',
                      135
                    );
                    if (sim.selectedTowerId === t.id) sim.selectedTowerId = null;
                    sim.towers.splice(tIdx, 1);
                  }
                  break;
                }
              }
              if (hitTower) continue;

              const dHq = Math.hypot(
                proj.x - 0.5 * width,
                proj.y - 0.5 * height
              );
              if (dHq <= 32) {
                proj.active = false;
                sim.baseHp = Math.max(0, sim.baseHp - proj.damage);
                soundEngine.playBaseHit();
                spawnParticles(proj.x, proj.y, 8, '#84cc16', 80);
                if (sim.baseHp <= 0 && !sim.ended) {
                  sim.ended = true;
                  soundEngine.playFanfare(false);
                  const ctrl = calculateMapControlPercentage(sim.towers, false);
                  propsRef.current.onGameEnd({
                    victory: false,
                    sectorName: sector.name,
                    waveReached: sim.wave,
                    zonesCaptured: ctrl.hqCount,
                    totalZones: 5,
                    mapControlPercent: ctrl.playerPercent,
                    hqCount: ctrl.hqCount,
                    threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
                    zombiesEliminated: sim.zombiesEliminated,
                    scrapEarned: sim.scrapEarnedRun,
                    gemsEarned: sim.gemsEarnedRun,
                    baseHpRemaining: 0,
                    baseMaxHp: sim.baseMaxHp,
                    score: sim.scoreRun,
                  });
                }
              }
              continue;
            }

            // Check collision with zombies
            for (const z of sim.zombies) {
              if (z.koTimer > 0) continue;
              const zx = z.x * width;
              const zy = z.y * height;
              const d = Math.hypot(proj.x - zx, proj.y - zy);
              if (d <= z.radius + proj.radius + 6) {
                proj.active = false;
                z.hp -= proj.damage;
                z.flashTimer = 0.06;

                if (proj.isSplash) {
                  for (const other of sim.zombies) {
                    if (other.id !== z.id && other.koTimer <= 0) {
                      const od = Math.hypot(
                        other.x * width - zx,
                        other.y * height - zy
                      );
                      if (od <= 68) {
                        other.hp -= proj.damage * 0.55;
                        other.flashTimer = 0.05;
                      }
                    }
                  }
                  spawnParticles(zx, zy, 12, '#fb923c', 95);
                } else if (proj.isEmp) {
                  z.slowTimer = 2.4;
                  for (const other of sim.zombies) {
                    if (other.id !== z.id && other.koTimer <= 0) {
                      const od = Math.hypot(
                        other.x * width - zx,
                        other.y * height - zy
                      );
                      if (od <= 70) {
                        other.slowTimer = 2.0;
                        other.hp -= proj.damage * 0.5;
                      }
                    }
                  }
                  spawnParticles(zx, zy, 10, '#a855f7', 85);
                } else {
                  spawnParticles(zx, zy, 5, proj.color, 65);
                }

                if (z.hp <= 0 && z.koTimer <= 0) {
                  z.koTimer = 0.28;
                  const norm = Math.hypot(proj.vx, proj.vy) || 1;
                  z.koVx = (proj.vx / norm) * 0.06;
                  z.koVy = (proj.vy / norm) * 0.06;
                  sim.hitstopTimer =
                    z.archetype === 'juggernaut' ? 0.045 : 0.02;
                  sim.cameraTrauma = Math.min(
                    1,
                    sim.cameraTrauma +
                      (z.archetype === 'juggernaut' ? 0.35 : 0.1)
                  );
                  spawnParticles(zx, zy, 16, '#ef4444', 130);

                  const scrapGain = getScrapRewardWithBonus(
                    z.scrapReward,
                    currUpgrades
                  );
                  const gemGain = z.archetype === 'juggernaut' ? 8 : 2;
                  sim.zombiesEliminated += 1;
                  sim.scrapEarnedRun += scrapGain;
                  sim.gemsEarnedRun += gemGain;
                  sim.scoreRun += scrapGain * 10;
                  propsRef.current.onEarnScrapAndGems(
                    scrapGain,
                    gemGain,
                    scrapGain * 10
                  );
                }
                break;
              }
            }
          }
        }
      }

      // 6. Update Pooled Particles
      for (const p of sim.particles) {
        if (!p.active) continue;
        p.life += dt;
        if (p.life >= p.maxLife) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }

      // Throttle HUD state sync to ~6Hz
      hudSyncAccumulator += dt;
      if (hudSyncAccumulator >= 0.15) {
        hudSyncAccumulator = 0;
        propsRef.current.onHudSync(buildHudPayload(currUpgrades));
      }

      // ==================== RENDERING ====================
      ctx.save();
      ctx.scale(dpr, dpr);

      const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 10;
      const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
      const shakeY = (Math.random() - 0.5) * 2 * shakeMag;
      ctx.translate(shakeX, shakeY);

      // Keep canvas transparent when online so the real OpenStreetMap underneath is clearly visible!
      if (propsRef.current.isOfflineMode) {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(9, 13, 22, 0.16)';
        ctx.fillRect(0, 0, width, height);
      }

      // Tactical Geo-Grid Lines
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.08)';
      ctx.lineWidth = 1;
      const gridStep = 64;
      for (let gx = 0; gx < width; gx += gridStep) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, height);
        ctx.stroke();
      }
      for (let gy = 0; gy < height; gy += gridStep) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(width, gy);
        ctx.stroke();
      }

      // ==================== WHOLE-MAP TERRITORY OVERLAY (PLAYER AREA VS. ZOMBIE AREA) ====================
      const territoryCircles = getPlayerTerritoryCircles(
        sim.towers,
        sim.baseHp > 0
      );

      // 1. Render Zombie-Controlled Area across the ENTIRE map outside Player-Controlled circles
      const maskCanvas = maskCanvasRef.current;
      if (maskCanvas && width > 0 && height > 0) {
        const mw = Math.max(1, Math.floor(width));
        const mh = Math.max(1, Math.floor(height));
        if (maskCanvas.width !== mw || maskCanvas.height !== mh) {
          maskCanvas.width = mw;
          maskCanvas.height = mh;
        }
        const mCtx = maskCanvas.getContext('2d');
        if (mCtx) {
          mCtx.clearRect(0, 0, mw, mh);
          // Fill entire map with crimson Zombie-Controlled territory fog
          mCtx.fillStyle = 'rgba(220, 38, 38, 0.24)';
          mCtx.fillRect(0, 0, mw, mh);

          // Diagonal hazard stripes inside Zombie-Controlled Area
          mCtx.strokeStyle = 'rgba(239, 68, 68, 0.10)';
          mCtx.lineWidth = 2;
          mCtx.beginPath();
          for (let d = -mh; d < mw + mh; d += 36) {
            mCtx.moveTo(d, 0);
            mCtx.lineTo(d - mh, mh);
          }
          mCtx.stroke();

          // Punch out Player-Controlled SQUARE Territory Zones (Primary HQ & Forward HQs ONLY)
          mCtx.globalCompositeOperation = 'destination-out';
          mCtx.fillStyle = '#000000';
          for (const c of territoryCircles) {
            const halfW = c.radius * mw;
            const halfH = c.radius * mh;
            mCtx.fillRect(c.x * mw - halfW, c.y * mh - halfH, halfW * 2, halfH * 2);
          }
          // Also punch out small square Vanguard Safe Zones around friendly Soldiers & Heavy Vehicles
          for (const u of sim.troops) {
            const uHalfW = 0.09 * mw;
            const uHalfH = 0.09 * mh;
            mCtx.fillRect(u.x * mw - uHalfW, u.y * mh - uHalfH, uHalfW * 2, uHalfH * 2);
          }
          mCtx.globalCompositeOperation = 'source-over';

          ctx.drawImage(maskCanvas, 0, 0, width, height);
        }
      }

      // 2. Render Player-Controlled SQUARE HQ Zones & Front-Line Borders (ONLY HQs gain Player Zones!)
      for (const c of territoryCircles) {
        const cx = c.x * width;
        const cy = c.y * height;
        const halfW = c.radius * width;
        const halfH = c.radius * height;
        ctx.save();
        ctx.fillStyle = 'rgba(16, 185, 129, 0.08)';
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.82)';
        ctx.lineWidth = 2.5;
        ctx.fillRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);
        ctx.strokeRect(cx - halfW, cy - halfH, halfW * 2, halfH * 2);

        // Tactical Square Corner Brackets
        const brk = 16;
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        // Top-Left
        ctx.moveTo(cx - halfW, cy - halfH + brk);
        ctx.lineTo(cx - halfW, cy - halfH);
        ctx.lineTo(cx - halfW + brk, cy - halfH);
        // Top-Right
        ctx.moveTo(cx + halfW - brk, cy - halfH);
        ctx.lineTo(cx + halfW, cy - halfH);
        ctx.lineTo(cx + halfW, cy - halfH + brk);
        // Bottom-Right
        ctx.moveTo(cx + halfW, cy + halfH - brk);
        ctx.lineTo(cx + halfW, cy + halfH);
        ctx.lineTo(cx + halfW - brk, cy + halfH);
        // Bottom-Left
        ctx.moveTo(cx - halfW + brk, cy + halfH);
        ctx.lineTo(cx - halfW, cy + halfH);
        ctx.lineTo(cx - halfW, cy + halfH - brk);
        ctx.stroke();

        // Square HQ Zone Header Label
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#34d399';
        ctx.fillText(
          `${c.label} · SQUARE HQ PLAYER ZONE`,
          cx,
          Math.max(76, cy - halfH + 16)
        );
        ctx.restore();
      }

      // 2.5. Render Heavy Fortress SQUARE Defensive Perimeter Zones (Fortresses have square defensive zones, not HQ capture zones)
      for (const t of sim.towers) {
        if (t.blueprintId !== 'fortress') continue;
        const fx = t.x * width;
        const fy = t.y * height;
        const fortHalfW = (t.controlRadius ?? 0.16) * width;
        const fortHalfH = (t.controlRadius ?? 0.16) * height;
        ctx.save();
        ctx.fillStyle = 'rgba(251, 146, 60, 0.08)';
        ctx.strokeStyle = 'rgba(251, 146, 60, 0.80)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 5]);
        ctx.fillRect(fx - fortHalfW, fy - fortHalfH, fortHalfW * 2, fortHalfH * 2);
        ctx.strokeRect(fx - fortHalfW, fy - fortHalfH, fortHalfW * 2, fortHalfH * 2);
        ctx.setLineDash([]);
        ctx.font = 'bold 9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fdba74';
        ctx.fillText(
          `FORTRESS L${t.level} · SQUARE DEFENSE ZONE`,
          fx,
          Math.max(76, fy - fortHalfH + 14)
        );
        ctx.restore();
      }

      // 3. Render Zombie-Controlled Area Warning Labels in outer uncaptured quadrants
      const isCompactCanvas = width < 580;
      const outerQuadrants = [
        {
          label: isCompactCanvas ? 'NW ZOMBIE ZONE' : 'NW ZOMBIE-CONTROLLED AREA',
          x: 0.18,
          y: 0.18,
        },
        {
          label: isCompactCanvas ? 'NE ZOMBIE ZONE' : 'NE ZOMBIE-CONTROLLED AREA',
          x: 0.82,
          y: 0.18,
        },
        {
          label: isCompactCanvas ? 'SE ZOMBIE ZONE' : 'SE ZOMBIE-CONTROLLED AREA',
          x: 0.82,
          y: 0.78,
        },
        {
          label: isCompactCanvas ? 'SW ZOMBIE ZONE' : 'SW ZOMBIE-CONTROLLED AREA',
          x: 0.18,
          y: 0.78,
        },
      ];
      for (const q of outerQuadrants) {
        const isControlled = territoryCircles.some(
          (c) =>
            Math.max(Math.abs(q.x - c.x), Math.abs(q.y - c.y)) <= c.radius * 0.9
        );
        if (!isControlled) {
          const clampedX = Math.max(72, Math.min(width - 72, q.x * width));
          ctx.save();
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = 'rgba(252, 165, 165, 0.85)';
          ctx.fillText(q.label, clampedX, q.y * height);
          if (!isCompactCanvas) {
            ctx.font = '9px "JetBrains Mono", monospace';
            ctx.fillStyle = 'rgba(248, 113, 113, 0.72)';
            ctx.fillText(
              'BUILD FORWARD HQ IN ECONOMY TAB TO CAPTURE ZONE',
              clampedX,
              q.y * height + 13
            );
          }
          ctx.restore();
        }
      }

      // Cached Urban Building Footprints (Offline mode or subtle block outlines)
      if (propsRef.current.isOfflineMode) {
        for (const b of sector.blocks) {
          const bx = b.x * width;
          const by = b.y * height;
          const bw = b.w * width;
          const bh = b.h * height;

          ctx.fillStyle =
            b.type === 'park'
              ? 'rgba(16, 185, 129, 0.16)'
              : 'rgba(30, 41, 59, 0.75)';
          ctx.strokeStyle = 'rgba(71, 85, 105, 0.55)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.roundRect(bx, by, bw, bh, 6);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Real-World Road Approach Polylines
      for (const road of sector.roads) {
        if (road.points.length < 2) continue;
        ctx.save();
        ctx.strokeStyle = propsRef.current.isOfflineMode
          ? 'rgba(30, 41, 59, 0.9)'
          : 'rgba(15, 23, 42, 0.35)';
        ctx.lineWidth = road.width * 0.75;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        road.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * width, pt.y * height);
          else ctx.lineTo(pt.x * width, pt.y * height);
        });
        ctx.stroke();

        ctx.strokeStyle = 'rgba(239, 68, 68, 0.42)';
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 12]);
        ctx.lineDashOffset = -(now * 0.03) % 20;
        ctx.beginPath();
        road.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * width, pt.y * height);
          else ctx.lineTo(pt.x * width, pt.y * height);
        });
        ctx.stroke();
        ctx.restore();
      }

      // Primary HQ Command Base at (0.5, 0.5) with Active CIWS Point-Defense Auto-Cannon
      const hqX = 0.5 * width;
      const hqY = 0.5 * height;
      const hqStats = getHqDefenseWeaponStats(currUpgrades);

      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.22)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 8]);
      ctx.strokeRect(
        hqX - hqStats.range,
        hqY - hqStats.range,
        hqStats.range * 2,
        hqStats.range * 2
      );
      ctx.restore();

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.28)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 54, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
      ctx.beginPath();
      ctx.moveTo(hqX, hqY);
      ctx.arc(hqX, hqY, 54, sim.radarAngle, sim.radarAngle + 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.save();
      ctx.translate(hqX, hqY);
      ctx.rotate(sim.hqAngle);
      const hqRecoilPx = sim.hqRecoil * 5.5;
      ctx.fillStyle = '#fbbf24';
      ctx.fillRect(6 - hqRecoilPx, -7, 22, 4.5);
      ctx.fillRect(6 - hqRecoilPx, 2.5, 22, 4.5);
      if (sim.hqRecoil > 0.6) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(29 - hqRecoilPx, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Selected Building Range Ring or Placement / Unit Command Cursor Preview
      if (currentState === 'playing') {
        const selTower = sim.towers.find((t) => t.id === sim.selectedTowerId);
        if (selTower) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = 1.5;
          if (
            selTower.blueprintId === 'forward_hq' ||
            selTower.blueprintId === 'fortress'
          ) {
            ctx.fillRect(
              selTower.x * width - selTower.range,
              selTower.y * height - selTower.range,
              selTower.range * 2,
              selTower.range * 2
            );
            ctx.strokeRect(
              selTower.x * width - selTower.range,
              selTower.y * height - selTower.range,
              selTower.range * 2,
              selTower.range * 2
            );
          } else {
            ctx.beginPath();
            ctx.arc(
              selTower.x * width,
              selTower.y * height,
              selTower.range,
              0,
              Math.PI * 2
            );
            ctx.fill();
            ctx.stroke();
          }
        } else if (sim.hoverX > 0 && sim.hoverY > 0) {
          const bp = DEPLOYABLE_BLUEPRINTS[propsRef.current.selectedDeployable];
          if (bp.category === 'command') {
            // Unit Command Cursor Preview
            ctx.save();
            ctx.strokeStyle = '#34d399';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.arc(sim.hoverX, sim.hoverY, 22, 0, Math.PI * 2);
            ctx.stroke();
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = '#34d399';
            ctx.fillText(
              'CLICK TO MOVE SOLDIERS & VEHICLES HERE',
              sim.hoverX,
              sim.hoverY - 28
            );
            ctx.restore();
          } else {
            const deployCost = getDynamicDeployCost(bp.id);
            const normHoverX = sim.hoverX / width;
            const normHoverY = sim.hoverY / height;
            const mapCtrl = calculateMapControlPercentage(
              sim.towers,
              sim.baseHp > 0
            );
            const maxSlots = getMaxTowerSlots(currUpgrades, mapCtrl.hqCount);
            const placementCheck =
              bp.category !== 'ability'
                ? validateTowerPlacement(
                    normHoverX,
                    normHoverY,
                    sector,
                    sim.towers,
                    maxSlots,
                    undefined,
                    sim.troops,
                    bp.id
                  )
                : { valid: true, reason: 'TARGET LOCKED' };
            const canAfford = propsRef.current.scrap >= deployCost;
            const isValidAndAffordable = placementCheck.valid && canAfford;

            ctx.save();
            // If placing Forward HQ or Heavy Fortress, preview the new SQUARE Zone!
            if (bp.controlRadius) {
              const halfZoneW = bp.controlRadius * width;
              const halfZoneH = bp.controlRadius * height;
              ctx.fillStyle = isValidAndAffordable
                ? bp.id === 'forward_hq'
                  ? 'rgba(34, 197, 94, 0.10)'
                  : 'rgba(251, 146, 60, 0.10)'
                : 'rgba(239, 68, 68, 0.08)';
              ctx.strokeStyle = isValidAndAffordable
                ? bp.id === 'forward_hq'
                  ? '#22c55e'
                  : '#fb923c'
                : '#ef4444';
              ctx.lineWidth = 2;
              ctx.setLineDash([8, 6]);
              ctx.fillRect(
                sim.hoverX - halfZoneW,
                sim.hoverY - halfZoneH,
                halfZoneW * 2,
                halfZoneH * 2
              );
              ctx.strokeRect(
                sim.hoverX - halfZoneW,
                sim.hoverY - halfZoneH,
                halfZoneW * 2,
                halfZoneH * 2
              );
            }

            ctx.fillStyle = isValidAndAffordable
              ? 'rgba(16, 185, 129, 0.12)'
              : 'rgba(239, 68, 68, 0.14)';
            ctx.strokeStyle = isValidAndAffordable ? bp.color : '#ef4444';
            ctx.lineWidth = 1.8;
            if (!isValidAndAffordable) {
              ctx.setLineDash([6, 6]);
            } else {
              ctx.setLineDash([]);
            }
            if (bp.id === 'forward_hq' || bp.id === 'fortress') {
              ctx.fillRect(
                sim.hoverX - bp.range,
                sim.hoverY - bp.range,
                bp.range * 2,
                bp.range * 2
              );
              ctx.strokeRect(
                sim.hoverX - bp.range,
                sim.hoverY - bp.range,
                bp.range * 2,
                bp.range * 2
              );
            } else {
              ctx.beginPath();
              ctx.arc(sim.hoverX, sim.hoverY, bp.range, 0, Math.PI * 2);
              ctx.fill();
              ctx.stroke();
            }

            ctx.setLineDash([]);
            ctx.strokeRect(sim.hoverX - 16, sim.hoverY - 16, 32, 32);

            const statusLabel = !placementCheck.valid
              ? placementCheck.reason || 'BLOCKED'
              : !canAfford
              ? `NEED ${deployCost} SCRAP`
              : `${bp.name.toUpperCase()} · ${deployCost} SCRAP`;
            ctx.font = 'bold 11px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillStyle = isValidAndAffordable ? '#10b981' : '#f87171';
            ctx.fillText(statusLabel, sim.hoverX, sim.hoverY - 24);
            ctx.restore();
          }
        }
      }

      // Render Buildings (Towers, Heavy Fortresses, Scrap Refineries, Barracks, Vehicle Factories, Forward HQs)
      for (const tower of sim.towers) {
        const tx = tower.x * width;
        const ty = tower.y * height;
        const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];
        const isBuilding = tower.buildProgress < 1;

        ctx.fillStyle = isBuilding ? '#1e293b' : '#0f172a';
        ctx.strokeStyle = tower.overheated
          ? '#ef4444'
          : tower.id === sim.selectedTowerId
          ? '#ffffff'
          : bp.color;
        ctx.lineWidth = tower.id === sim.selectedTowerId ? 3 : 2.4;

        if (bp.category === 'hq') {
          // Forward HQ Command Base Complex
          ctx.beginPath();
          ctx.arc(tx, ty, 22, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#22c55e';
          ctx.beginPath();
          ctx.arc(tx, ty, 9, 0, Math.PI * 2);
          ctx.fill();
        } else if (bp.category === 'fortress') {
          // Heavy Defensive Fortress Bunker (armored octagon/rounded bastion)
          ctx.beginPath();
          ctx.roundRect(tx - 18, ty - 18, 36, 36, 7);
          ctx.fill();
          ctx.stroke();

          ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx - 12, ty - 12, 24, 24);
        } else if (bp.category === 'economy') {
          // Scrap Refinery industrial pad
          ctx.beginPath();
          ctx.roundRect(tx - 15, ty - 15, 30, 30, 5);
          ctx.fill();
          ctx.stroke();
        } else if (bp.category === 'producer') {
          // Barracks / Heavy Vehicle Factory compound pad
          ctx.beginPath();
          ctx.roundRect(tx - 17, ty - 14, 34, 28, 4);
          ctx.fill();
          ctx.stroke();
        } else {
          // Standard Defensive Tower pedestal
          ctx.beginPath();
          ctx.arc(tx, ty, 14, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }

        if (isBuilding) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            tx,
            ty,
            20,
            -Math.PI / 2,
            -Math.PI / 2 + tower.buildProgress * Math.PI * 2
          );
          ctx.stroke();

          ctx.fillStyle = '#fbbf24';
          ctx.font = 'bold 10px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(
            `BUILD ${Math.round(tower.buildProgress * 100)}%`,
            tx,
            ty - 24
          );
        } else if (bp.category === 'economy') {
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(tower.angle);
          ctx.strokeStyle = '#eab308';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-9, 0);
          ctx.lineTo(9, 0);
          ctx.moveTo(0, -9);
          ctx.lineTo(0, 9);
          ctx.stroke();
          ctx.restore();

          const rate = getScrapCollectorYieldPerSecond(tower.level, currUpgrades);
          ctx.fillStyle = '#fde047';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText(`+${rate}/s`, tx, ty - 20);
        } else if (bp.category === 'producer') {
          const isFactory = tower.blueprintId === 'vehicle_factory';
          ctx.fillStyle = bp.color;
          if (isFactory) {
            ctx.fillRect(tx - 8, ty - 5, 16, 10);
          } else {
            ctx.beginPath();
            ctx.moveTo(tx, ty - 8);
            ctx.lineTo(tx + 8, ty + 6);
            ctx.lineTo(tx - 8, ty + 6);
            ctx.closePath();
            ctx.fill();
          }

          const baseInterval = bp.spawnIntervalSeconds || 8.0;
          const effInterval = Math.max(
            3.5,
            baseInterval * Math.pow(0.88, tower.level - 1)
          );
          const prodPct = Math.min(1, tower.productionTimer / effInterval);
          ctx.fillStyle = 'rgba(9, 13, 22, 0.9)';
          ctx.fillRect(tx - 14, ty - 22, 28, 3);
          ctx.fillStyle = bp.color;
          ctx.fillRect(tx - 14, ty - 22, 28 * prodPct, 3);
        } else if (bp.category === 'fortress' || bp.category === 'hq') {
          // Twin heavy cannon barrels on Heavy Fortress and Forward HQ
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(tower.angle);
          const recoilOffset = tower.recoil * 4.5;
          ctx.fillStyle = bp.color;
          ctx.fillRect(4 - recoilOffset, -6, 18, 4);
          ctx.fillRect(4 - recoilOffset, 2, 18, 4);
          ctx.restore();
        } else {
          ctx.save();
          ctx.translate(tx, ty);
          ctx.rotate(tower.angle);
          const recoilOffset = tower.recoil * 4;
          ctx.fillStyle = tower.overheated ? '#f97316' : bp.color;
          ctx.fillRect(2 - recoilOffset, -3.5, 15, 7);
          ctx.restore();

          if (tower.overheated) {
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText('OVERHEATED', tx, ty - 22);
          }
        }

        // Structural HP bar below building
        const barW = bp.category === 'hq' || bp.category === 'fortress' ? 36 : 28;
        const hpPct = Math.max(0, Math.min(1, tower.hp / tower.maxHp));
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(tx - barW / 2, ty + 20, barW, 4);
        ctx.fillStyle = hpPct > 0.4 ? '#10b981' : '#ef4444';
        ctx.fillRect(tx - barW / 2, ty + 20, barW * hpPct, 4);

        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`L${tower.level}`, tx, ty + 34);
      }

      // Render Army Command Destination Waypoint Beacon when units are moving
      if (sim.armyOrderTimer > 0) {
        const bx = sim.armyRallyX * width;
        const by = sim.armyRallyY * height;
        ctx.save();
        ctx.strokeStyle = '#34d399';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          bx,
          by,
          12 + (2.4 - sim.armyOrderTimer) * 8,
          0,
          Math.PI * 2
        );
        ctx.stroke();
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('ARMY MOVE ORDER', bx, by - 16);
        ctx.restore();
      }

      // Render Player-Controllable Soldiers & Heavy Vehicles
      for (const troop of sim.troops) {
        const rx = troop.x * width;
        const ry = troop.y * height;
        const bob = Math.sin(troop.gaitPhase) * 1.5;
        const isTank = troop.unitType === 'heavy_vehicle';

        // Tactical Real-Road Movement Path Polyline (shows unit exiting building onto nearest road and following road segments)
        const distToRally = Math.hypot(
          troop.rallyX - troop.x,
          troop.rallyY - troop.y
        );
        if (distToRally > 0.008) {
          ctx.save();
          ctx.strokeStyle = troop.selected
            ? 'rgba(52, 211, 153, 0.78)'
            : 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = troop.selected ? 2.2 : 1.2;
          ctx.setLineDash([5, 5]);
          ctx.beginPath();
          ctx.moveTo(rx, ry);
          if (troop.roadPath && troop.roadPath.length > 0) {
            const startIdx = troop.roadPathIndex ?? 0;
            for (let wi = startIdx; wi < troop.roadPath.length; wi++) {
              ctx.lineTo(
                troop.roadPath[wi].x * width,
                troop.roadPath[wi].y * height
              );
            }
          } else {
            ctx.lineTo(troop.rallyX * width, troop.rallyY * height);
          }
          ctx.stroke();
          ctx.restore();
        }

        // Unit Selection Ring
        if (troop.selected) {
          ctx.save();
          ctx.strokeStyle = isTank ? '#22d3ee' : '#34d399';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx, ry, isTank ? 18 : 15, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }

        if (isTank) {
          // Armored Heavy Siege Tank / APC
          ctx.save();
          ctx.translate(rx, ry);
          ctx.rotate(troop.angle);
          ctx.fillStyle = troop.flashTimer > 0 ? '#ffffff' : '#083344';
          ctx.strokeStyle = '#06b6d4';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.roundRect(-12, -9, 24, 18, 3);
          ctx.fill();
          ctx.stroke();

          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(0, -2.5, 16, 5);
          ctx.restore();
        } else {
          // Squad 3-soldier chevron formation
          const offsets = [
            { dx: 0, dy: -7 },
            { dx: -7, dy: 6 },
            { dx: 7, dy: 6 },
          ];
          for (const off of offsets) {
            ctx.fillStyle = troop.flashTimer > 0 ? '#ffffff' : '#064e3b';
            ctx.strokeStyle = '#10b981';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(rx + off.dx, ry + off.dy + bob, 5.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }
        }

        // Unit HP Bar
        const uBarW = isTank ? 26 : 20;
        const uPct = Math.max(0, Math.min(1, troop.hp / troop.maxHp));
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(rx - uBarW / 2, ry - 18, uBarW, 3);
        ctx.fillStyle = isTank ? '#06b6d4' : '#10b981';
        ctx.fillRect(rx - uBarW / 2, ry - 18, uBarW * uPct, 3);
      }

      // Render Zombies (Swarming from 360°)
      for (const z of sim.zombies) {
        const zx = z.x * width;
        const zy = z.y * height;
        const squash = 1 + Math.sin(z.gaitPhase) * 0.08;

        ctx.save();
        ctx.translate(zx, zy);
        if (z.koTimer > 0) {
          ctx.globalAlpha = Math.max(0, z.koTimer / 0.28);
          ctx.scale(1.25, 0.75);
        } else {
          ctx.scale(squash, 2 - squash);
        }

        if (z.isWindingUp) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, z.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        let fill = '#dc2626';
        if (z.archetype === 'runner') fill = '#f97316';
        else if (z.archetype === 'spitter') fill = '#84cc16';
        else if (z.archetype === 'juggernaut') fill = '#7f1d1d';

        if (z.flashTimer > 0) fill = '#ffffff';
        else if (z.slowTimer > 0) fill = '#a855f7';

        ctx.fillStyle = fill;
        ctx.strokeStyle = '#090d16';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();

        if (z.hp < z.maxHp && z.koTimer <= 0) {
          const bw = z.radius * 2.2;
          const pct = Math.max(0, z.hp / z.maxHp);
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          ctx.fillRect(zx - bw / 2, zy - z.radius - 8, bw, 4);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(zx - bw / 2, zy - z.radius - 8, bw * pct, 4);
        }
      }

      // Render Projectiles
      for (const proj of sim.projectiles) {
        if (!proj.active) continue;
        ctx.fillStyle = proj.color;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Render Pooled Particles
      for (const p of sim.particles) {
        if (!p.active) continue;
        const alpha = 1 - p.life / p.maxLife;
        ctx.save();
        ctx.globalAlpha = Math.max(0, alpha);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Low HP peripheral danger vignette
      if (sim.baseHp < sim.baseMaxHp * 0.35 && currentState === 'playing') {
        const grad = ctx.createRadialGradient(
          width / 2,
          height / 2,
          width * 0.25,
          width / 2,
          height / 2,
          width * 0.65
        );
        grad.addColorStop(0, 'rgba(239, 68, 68, 0)');
        grad.addColorStop(1, 'rgba(239, 68, 68, 0.32)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      ctx.restore();
      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, []);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  // Core primary-tap action (build off-road, inspect building/unit, or move units on roads)
  const executePrimaryTapAction = (
    clickX: number,
    clickY: number,
    rectWidth: number,
    rectHeight: number,
    shiftKey = false
  ) => {
    const normX = clickX / rectWidth;
    const normY = clickY / rectHeight;
    const sim = simRef.current;

    // Android Touch 'move_units' mode OR [M] Command Army blueprint immediately orders units along real roads!
    const bp = DEPLOYABLE_BLUEPRINTS[propsRef.current.selectedDeployable];
    if (
      propsRef.current.touchActionMode === 'move_units' ||
      bp?.category === 'command'
    ) {
      orderUnitsToMapCoordinate(normX, normY, clickX, clickY);
      return;
    }

    // 1. Tap directly on a Soldier or Heavy Vehicle to select it (generous 26px Android touch radius)
    for (const u of sim.troops) {
      const distUnitPx = Math.hypot(
        u.x * rectWidth - clickX,
        u.y * rectHeight - clickY
      );
      if (distUnitPx <= 26) {
        if (!shiftKey) {
          for (const other of sim.troops) {
            other.selected = other.id === u.id;
          }
        } else {
          u.selected = !u.selected;
        }
        sim.statusAlert = `${
          u.unitType === 'heavy_vehicle' ? 'HEAVY SIEGE TANK' : 'SOLDIER SQUAD'
        } SELECTED — TAP [MOVE UNITS] OR LONG-PRESS MAP TO MOVE ON ROADS`;
        sim.statusAlertTimer = 3.0;
        soundEngine.playDeploy();
        triggerAndroidHaptic('tap');
        propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
        return;
      }
    }

    // 2. Tap an existing building to inspect/upgrade/repair (generous 28px Android touch radius)
    for (const t of sim.towers) {
      const distPx = Math.hypot(
        t.x * rectWidth - clickX,
        t.y * rectHeight - clickY
      );
      if (distPx <= 28) {
        sim.selectedTowerId = t.id;
        triggerAndroidHaptic('tap');
        propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
        return;
      }
    }

    sim.selectedTowerId = null;
    if (!bp) return;

    const deployCost = getDynamicDeployCost(bp.id);

    // 3. Validate Player-Controlled Square Area & Off-Road Clearance for static buildings
    if (bp.category !== 'ability') {
      const mapCtrl = calculateMapControlPercentage(
        sim.towers,
        sim.baseHp > 0
      );
      const maxSlots = getMaxTowerSlots(
        propsRef.current.upgrades,
        mapCtrl.hqCount
      );
      const check = validateTowerPlacement(
        normX,
        normY,
        propsRef.current.activeSector,
        sim.towers,
        maxSlots,
        undefined,
        sim.troops,
        bp.id
      );
      if (!check.valid) {
        sim.statusAlert = check.reason || 'PLACEMENT BLOCKED';
        sim.statusAlertTimer = 2.8;
        triggerAndroidHaptic('error');
        spawnParticles(clickX, clickY, 8, '#ef4444', 70);
        propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
        return;
      }
    }

    if (propsRef.current.scrap < deployCost) {
      sim.statusAlert = `INSUFFICIENT SCRAP: NEED ${deployCost} SCRAP`;
      sim.statusAlertTimer = 2.2;
      triggerAndroidHaptic('error');
      spawnParticles(clickX, clickY, 6, '#ef4444', 55);
      propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
      return;
    }

    propsRef.current.onSpendScrap(deployCost);

    if (bp.category === 'ability') {
      // Orbital Napalm Airstrike
      soundEngine.playHeavyExplosion();
      triggerAndroidHaptic('explosion');
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.7);
      spawnParticles(clickX, clickY, 36, '#ef4444', 180);
      spawnParticles(clickX, clickY, 20, '#f59e0b', 130);

      for (const z of sim.zombies) {
        if (z.koTimer > 0) continue;
        const d = Math.hypot(
          z.x * rectWidth - clickX,
          z.y * rectHeight - clickY
        );
        if (d <= bp.range) {
          z.hp -= bp.damage;
          z.flashTimer = 0.1;
          if (z.hp <= 0) {
            z.koTimer = 0.3;
            z.koVx = (z.x - normX) * 0.25;
            z.koVy = (z.y - normY) * 0.25;
            const scrapGain = getScrapRewardWithBonus(
              z.scrapReward,
              propsRef.current.upgrades
            );
            sim.zombiesEliminated += 1;
            sim.scrapEarnedRun += scrapGain;
            sim.scoreRun += scrapGain * 10;
            propsRef.current.onEarnScrapAndGems(
              scrapGain,
              3,
              scrapGain * 10
            );
          }
        }
      }
    } else {
      // Deploy Static Off-Road Building
      soundEngine.playDeploy();
      triggerAndroidHaptic('deploy');
      spawnParticles(clickX, clickY, 16, bp.color, 100);
      const eff = getEffectiveTowerStats(
        bp.id,
        1,
        propsRef.current.upgrades
      );
      const newTower: TowerEntity = {
        id: sim.nextEntityId++,
        blueprintId: bp.id,
        x: normX,
        y: normY,
        level: 1,
        hp: eff.maxHp,
        maxHp: eff.maxHp,
        buildProgress: 0,
        heat: 0,
        overheated: false,
        range: eff.range,
        damage: eff.damage,
        fireRate: eff.fireRate,
        cooldown: 0,
        productionTimer: 0,
        controlRadius: bp.controlRadius,
        angle: 0,
        recoil: 0,
        kills: 0,
      };
      sim.towers.push(newTower);
      sim.selectedTowerId = null;

      if (bp.id === 'forward_hq') {
        const ctrl = calculateMapControlPercentage(sim.towers, sim.baseHp > 0);
        sim.statusAlert = `FORWARD HQ BASE DEPLOYED! PLAYER MAP CONTROL EXPANDED TO ${ctrl.playerPercent}%`;
        sim.statusAlertTimer = 3.8;
      } else if (bp.id === 'fortress') {
        sim.statusAlert = `HEAVY FORTRESS BASTION DEPLOYED (680 HP · DUAL CANNONS)`;
        sim.statusAlertTimer = 3.0;
      }
    }

    propsRef.current.onHudSync(buildHudPayload(propsRef.current.upgrades));
  };

  // Handle pointer down:
  // - Right-click (mouse) immediately commands units on roads
  // - Mouse left-click acts immediately
  // - Android Touch ('touch' / 'pen') supports BOTH Quick-Tap (build/move) AND 420ms Long-Press (road move command + vibration)!
  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (propsRef.current.gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const normX = clickX / rect.width;
    const normY = clickY / rect.height;

    if (e.button === 2) {
      e.preventDefault();
      orderUnitsToMapCoordinate(normX, normY, clickX, clickY);
      return;
    }

    if (e.pointerType === 'touch' || e.pointerType === 'pen') {
      clearLongPressTimer();
      touchDownRef.current = { x: clickX, y: clickY, longPressed: false };
      simRef.current.hoverX = clickX;
      simRef.current.hoverY = clickY;

      longPressTimerRef.current = window.setTimeout(() => {
        if (touchDownRef.current) {
          touchDownRef.current.longPressed = true;
          orderUnitsToMapCoordinate(normX, normY, clickX, clickY);
        }
      }, 420);
      return;
    }

    executePrimaryTapAction(clickX, clickY, rect.width, rect.height, e.shiftKey);
  };

  const handleCanvasPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
    clearLongPressTimer();
    const down = touchDownRef.current;
    touchDownRef.current = null;
    if (!down || down.longPressed) return;

    if (propsRef.current.gameState !== 'playing') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const upX = e.clientX - rect.left;
    const upY = e.clientY - rect.top;
    if (Math.hypot(upX - down.x, upY - down.y) <= 18) {
      executePrimaryTapAction(upX, upY, rect.width, rect.height, false);
    }
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const moveX = e.clientX - rect.left;
    const moveY = e.clientY - rect.top;
    simRef.current.hoverX = moveX;
    simRef.current.hoverY = moveY;

    if (
      touchDownRef.current &&
      Math.hypot(moveX - touchDownRef.current.x, moveY - touchDownRef.current.y) > 18
    ) {
      clearLongPressTimer();
    }
  };

  const handleCanvasPointerLeave = () => {
    clearLongPressTimer();
    touchDownRef.current = null;
    simRef.current.hoverX = -1000;
    simRef.current.hoverY = -1000;
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="tactical-battle-canvas"
      aria-label="Tactical City Sector Defense Canvas"
      onPointerDown={handleCanvasPointerDown}
      onPointerUp={handleCanvasPointerUp}
      onPointerCancel={handleCanvasPointerLeave}
      onPointerMove={handleCanvasPointerMove}
      onPointerLeave={handleCanvasPointerLeave}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute inset-0 w-full h-full cursor-crosshair z-10 touch-none"
    />
  );
};
