import React, { useEffect, useRef } from 'react';
import {
  CitySector,
  DeployableId,
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
  createZombieWaveComposition,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getHqDefenseWeaponStats,
  getMaxBaseHp,
  getMaxTowerSlots,
  getScrapRewardWithBonus,
  getWaveDifficultyScaling,
  validateTowerPlacement,
} from '../game/rules';
import { soundEngine } from '../game/audio';

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
  onSpendScrap: (amount: number) => void;
  onEarnScrapAndGems: (scrapDelta: number, gemsDelta: number, scoreDelta: number) => void;
  onHudSync: (hud: {
    baseHp: number;
    baseMaxHp: number;
    wave: number;
    threatMultiplier: number;
    zombiesRemaining: number;
    activeTowerCount: number;
    maxTowerSlots: number;
    unitCountsByType: Record<DeployableId, number>;
    selectedTower: TowerEntity | null;
  }) => void;
  onGameEnd: (snapshot: Omit<RunSnapshot, 'bestScore' | 'bestWave'>) => void;
  upgradeTowerSignal: number;
  repairTowerSignal: number;
  sellTowerSignal: number;
}

const MAX_PARTICLES = 180;
const MAX_PROJECTILES = 90;

export const TacticalBattleCanvas: React.FC<TacticalBattleCanvasProps> = ({
  gameState,
  activeSector,
  isOfflineMode,
  selectedDeployable,
  scrap,
  upgrades,
  resetSignal,
  nextWaveSignal,
  onSpendScrap,
  onEarnScrapAndGems,
  onHudSync,
  onGameEnd,
  upgradeTowerSignal,
  repairTowerSignal,
  sellTowerSignal,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Store latest React props in refs so 60Hz loop never tears down
  const propsRef = useRef({
    gameState,
    activeSector,
    isOfflineMode,
    selectedDeployable,
    scrap,
    upgrades,
    onSpendScrap,
    onEarnScrapAndGems,
    onHudSync,
    onGameEnd,
  });

  useEffect(() => {
    propsRef.current = {
      gameState,
      activeSector,
      isOfflineMode,
      selectedDeployable,
      scrap,
      upgrades,
      onSpendScrap,
      onEarnScrapAndGems,
      onHudSync,
      onGameEnd,
    };
  }, [
    gameState,
    activeSector,
    isOfflineMode,
    selectedDeployable,
    scrap,
    upgrades,
    onSpendScrap,
    onEarnScrapAndGems,
    onHudSync,
    onGameEnd,
  ]);

  // Simulation mutable state ref
  const simRef = useRef<{
    baseHp: number;
    baseMaxHp: number;
    wave: number;
    waveQueue: ZombieArchetype[];
    spawnTimer: number;
    waveCooldownTimer: number;
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
    spawnTimer: 1.5,
    waveCooldownTimer: 0,
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
    targetTowerId?: number
  ) => {
    const sim = simRef.current;
    const proj = sim.projectiles[sim.projectileCursor];
    sim.projectileCursor = (sim.projectileCursor + 1) % MAX_PROJECTILES;
    const dx = targetX - x;
    const dy = targetY - y;
    const dist = Math.hypot(dx, dy) || 1;
    const speed = isZombieSpit ? 240 : isEmp ? 360 : 560;
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
    proj.isZombieSpit = isZombieSpit;
    proj.targetTowerId = targetTowerId;
    proj.radius = isEmp ? 5 : isZombieSpit ? 4.5 : 3;
  };

  const computeUnitCounts = (): Record<DeployableId, number> => {
    const sim = simRef.current;
    const counts: Record<DeployableId, number> = {
      rotary_turret: 0,
      sniper_nest: 0,
      emp_pylon: 0,
      rifle_squad: sim.troops.length,
      airstrike: 0,
    };
    for (const t of sim.towers) {
      counts[t.blueprintId] = (counts[t.blueprintId] || 0) + 1;
    }
    return counts;
  };

  // Initialize or reset simulation when sector or resetSignal changes
  useEffect(() => {
    const sim = simRef.current;
    const maxHp = getMaxBaseHp(propsRef.current.upgrades);
    sim.baseMaxHp = maxHp;
    sim.baseHp = maxHp;
    sim.wave = 1;
    sim.waveQueue = createZombieWaveComposition(1);
    sim.spawnTimer = 2.8; // 2.8s tactical prep window to place first tower
    sim.waveCooldownTimer = 0;
    sim.zombies = [];
    // No free pre-built towers: Commander must strategically place every fortification!
    sim.towers = [];
    sim.troops = [];
    sim.selectedTowerId = null;
    sim.zombiesEliminated = 0;
    sim.scrapEarnedRun = 0;
    sim.gemsEarnedRun = 0;
    sim.scoreRun = 0;
    sim.ended = false;

    propsRef.current.onHudSync({
      baseHp: sim.baseHp,
      baseMaxHp: sim.baseMaxHp,
      wave: sim.wave,
      threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
      zombiesRemaining: sim.waveQueue.length,
      activeTowerCount: 0,
      maxTowerSlots: getMaxTowerSlots(propsRef.current.upgrades),
      unitCountsByType: computeUnitCounts(),
      selectedTower: null,
    });
  }, [resetSignal, activeSector.id]);

  // Trigger early next wave when requested (Endless mode: always available!)
  useEffect(() => {
    if (nextWaveSignal === 0) return;
    const sim = simRef.current;
    if (sim.ended) return;
    sim.wave += 1;
    const nextWaveHostiles = createZombieWaveComposition(sim.wave);
    sim.waveQueue.push(...nextWaveHostiles);
    sim.spawnTimer = 0.25;
    sim.waveCooldownTimer = 0;
    // Early wave rush bonus
    sim.scrapEarnedRun += 25;
    propsRef.current.onEarnScrapAndGems(25, 4, 90);
  }, [nextWaveSignal]);

  // Upgrade selected tower
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

  // Repair & Vent selected tower
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

  // Sell selected tower
  useEffect(() => {
    if (sellTowerSignal === 0) return;
    const sim = simRef.current;
    if (!sim.selectedTowerId) return;
    const idx = sim.towers.findIndex((t) => t.id === sim.selectedTowerId);
    if (idx === -1) return;
    const tower = sim.towers[idx];
    const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];
    const hpFactor = Math.max(0.25, tower.hp / tower.maxHp);
    const refund = Math.round(bp.baseCost * 0.55 * tower.level * hpFactor);
    sim.towers.splice(idx, 1);
    sim.selectedTowerId = null;
    propsRef.current.onEarnScrapAndGems(refund, 0, 0);
    soundEngine.playDeploy();
  }, [sellTowerSignal]);

  // Main 60Hz simulation & rendering loop mounted once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

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

    const spawnNextZombieFromQueue = (sector: CitySector, waveNum: number) => {
      const sim = simRef.current;
      const arch = sim.waveQueue.shift();
      if (!arch || sector.roads.length === 0) return;

      const roadIndex = Math.floor(Math.random() * sector.roads.length);
      const road = sector.roads[roadIndex];
      const startPt = road.points[0];
      const scaling = getWaveDifficultyScaling(waveNum);

      let baseHp = 78;
      let baseSpeed = 0.056;
      let radius = 9;
      let baseDamage = 20;
      let scrapReward = 10;

      if (arch === 'runner') {
        baseHp = 52;
        baseSpeed = 0.098;
        radius = 7.5;
        baseDamage = 16;
        scrapReward = 13;
      } else if (arch === 'spitter') {
        baseHp = 68;
        baseSpeed = 0.052;
        radius = 8.5;
        baseDamage = 26;
        scrapReward = 17;
      } else if (arch === 'juggernaut') {
        baseHp = 290;
        baseSpeed = 0.034;
        radius = 14;
        baseDamage = 72;
        scrapReward = 38;
      }

      const hp = Math.round(baseHp * scaling.hpMultiplier);
      const speed = baseSpeed * scaling.speedMultiplier;
      const damage = Math.round(baseDamage * scaling.damageMultiplier);

      sim.zombies.push({
        id: sim.nextEntityId++,
        archetype: arch,
        x: startPt.x + (Math.random() - 0.5) * 0.012,
        y: startPt.y + (Math.random() - 0.5) * 0.012,
        vx: 0,
        vy: 0,
        hp,
        maxHp: hp,
        speed,
        radius,
        damage,
        scrapReward,
        roadIndex,
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

      // Advance simulation when in 'playing'
      if (currentState === 'playing' && !sim.ended && width > 0 && height > 0) {
        if (sim.hitstopTimer > 0) {
          sim.hitstopTimer = Math.max(0, sim.hitstopTimer - dt);
        } else {
          // 1. Spawn zombies from wave queue (Endless wave escalation)
          const currentWaveScaling = getWaveDifficultyScaling(sim.wave);
          if (sim.waveQueue.length > 0) {
            sim.spawnTimer -= dt;
            if (sim.spawnTimer <= 0) {
              spawnNextZombieFromQueue(sector, sim.wave);
              sim.spawnTimer = currentWaveScaling.spawnIntervalSeconds;
            }
          } else if (sim.zombies.length === 0) {
            // Wave cleared! Endless survival escalates to the next harder wave
            sim.waveCooldownTimer += dt;
            if (sim.waveCooldownTimer >= 2.6) {
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

              sim.wave += 1;
              sim.waveQueue = createZombieWaveComposition(sim.wave);
              sim.spawnTimer = 0.7;
              sim.waveCooldownTimer = 0;
              soundEngine.playDeploy();
            }
          }

          // 2. Update Mobile Strike Squads (Troops)
          for (let i = sim.troops.length - 1; i >= 0; i--) {
            const troop = sim.troops[i];
            troop.flashTimer = Math.max(0, troop.flashTimer - dt);
            troop.cooldown = Math.max(0, troop.cooldown - dt);

            // Move toward rally point or intercept nearby zombie
            let destX = troop.rallyX;
            let destY = troop.rallyY;
            let closestZ: ZombieEntity | null = null;
            let closestDistPx = troop.range;

            for (const z of sim.zombies) {
              if (z.koTimer > 0) continue;
              const dPx = Math.hypot((z.x - troop.x) * width, (z.y - troop.y) * height);
              if (dPx < closestDistPx) {
                closestDistPx = dPx;
                closestZ = z;
              }
            }

            const dxR = destX - troop.x;
            const dyR = destY - troop.y;
            const distR = Math.hypot(dxR, dyR);
            if (distR > 0.008) {
              const moveSpd = 0.085;
              troop.x += (dxR / distR) * moveSpd * dt;
              troop.y += (dyR / distR) * moveSpd * dt;
              troop.gaitPhase += dt * 12;
              troop.angle = Math.atan2(dyR, dxR);
            }

            if (closestZ) {
              troop.angle = Math.atan2(
                (closestZ.y - troop.y) * height,
                (closestZ.x - troop.x) * width
              );
              if (troop.cooldown <= 0) {
                troop.cooldown = 1 / troop.fireRate;
                spawnProjectile(
                  troop.x * width,
                  troop.y * height,
                  closestZ.x * width,
                  closestZ.y * height,
                  troop.damage,
                  '#10b981'
                );
                soundEngine.playShot('troop');
              }
            }
          }

          // 2.5. Update Central HQ Automated Point-Defense Cannon (CIWS Turret at 0.5, 0.5)
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
            // Slowly sweep HQ cannon along radar angle when no close hostiles are in range
            sim.hqAngle = sim.radarAngle + 0.25;
          }

          // 3. Update Towers (On-Site Construction Progress + Barrel Heat / Overheat Venting)
          for (const tower of sim.towers) {
            tower.cooldown = Math.max(0, tower.cooldown - dt);
            tower.recoil = Math.max(0, tower.recoil - dt * 6);

            // On-site assembly takes 3.2 seconds before weapon systems come online
            if (tower.buildProgress < 1) {
              tower.buildProgress = Math.min(1, tower.buildProgress + dt / 3.2);
              continue;
            }

            // Thermal management: overheated barrels must vent completely before firing again
            if (tower.overheated) {
              tower.heat = Math.max(0, tower.heat - dt * 0.38);
              if (tower.heat <= 0.02) {
                tower.heat = 0;
                tower.overheated = false;
              }
              continue;
            } else {
              tower.heat = Math.max(0, tower.heat - dt * 0.14);
            }

            let target: ZombieEntity | null = null;
            let bestDist = tower.range;

            for (const z of sim.zombies) {
              if (z.koTimer > 0) continue;
              const dPx = Math.hypot((z.x - tower.x) * width, (z.y - tower.y) * height);
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
                const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];
                const isEmp = tower.blueprintId === 'emp_pylon';

                // Add thermal load per shot
                const heatPerShot =
                  tower.blueprintId === 'rotary_turret'
                    ? 0.088
                    : tower.blueprintId === 'sniper_nest'
                    ? 0.24
                    : 0.16;
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

                spawnProjectile(
                  tower.x * width,
                  tower.y * height,
                  target.x * width,
                  target.y * height,
                  tower.damage,
                  bp.color,
                  isEmp,
                  false
                );
                soundEngine.playShot(
                  tower.blueprintId === 'sniper_nest'
                    ? 'sniper'
                    : isEmp
                    ? 'emp'
                    : 'turret'
                );
              }
            }
          }

          // 4. Update Zombies (4 distinct policies + Tower Sabotage + KO transitions)
          for (let i = sim.zombies.length - 1; i >= 0; i--) {
            const z = sim.zombies[i];
            z.flashTimer = Math.max(0, z.flashTimer - dt);
            z.slowTimer = Math.max(0, z.slowTimer - dt);

            // Handle KO knockback dissolve state
            if (z.koTimer > 0) {
              z.koTimer -= dt;
              z.x += z.koVx * dt;
              z.y += z.koVy * dt;
              if (z.koTimer <= 0) {
                sim.zombies.splice(i, 1);
              }
              continue;
            }

            const road = sector.roads[z.roadIndex] || sector.roads[0];
            const targetPt =
              road.points[Math.min(z.waypointIndex, road.points.length - 1)];
            const dx = targetPt.x - z.x;
            const dy = targetPt.y - z.y;
            const dist = Math.hypot(dx, dy);

            const distToHqPx = Math.hypot((0.5 - z.x) * width, (0.5 - z.y) * height);

            // Check if a nearby tower is within sabotage / acid-spit range
            let nearestTower: TowerEntity | null = null;
            let nearestTowerDistPx = Infinity;
            for (const t of sim.towers) {
              const dT = Math.hypot((t.x - z.x) * width, (t.y - z.y) * height);
              if (dT < nearestTowerDistPx) {
                nearestTowerDistPx = dT;
                nearestTower = t;
              }
            }

            // Ranged Acid Spitter targets nearby towers (<= 145px) or HQ (<= 155px)
            if (
              z.archetype === 'spitter' &&
              (nearestTowerDistPx <= 145 || distToHqPx <= 155)
            ) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              if (z.windupTimer >= 0.72) {
                z.windupTimer = 0;
                const aimAtTower =
                  nearestTower && nearestTowerDistPx <= 145 && nearestTowerDistPx < distToHqPx;
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

            // Melee / Juggernaut zombies sabotage towers built close to road curbs (<= 48px)
            if (nearestTower && nearestTowerDistPx <= 48) {
              z.isWindingUp = true;
              z.windupTimer += dt;
              if (z.windupTimer >= 0.42) {
                z.windupTimer = 0;
                nearestTower.hp -= z.damage * 0.9;
                spawnParticles(
                  nearestTower.x * width,
                  nearestTower.y * height,
                  8,
                  '#f59e0b',
                  90
                );
                if (nearestTower.hp <= 0) {
                  soundEngine.playHeavyExplosion();
                  sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.4);
                  spawnParticles(
                    nearestTower.x * width,
                    nearestTower.y * height,
                    24,
                    '#ef4444',
                    140
                  );
                  const tIdx = sim.towers.findIndex((t) => t.id === nearestTower!.id);
                  if (tIdx !== -1) sim.towers.splice(tIdx, 1);
                  if (sim.selectedTowerId === nearestTower.id) {
                    sim.selectedTowerId = null;
                  }
                }
              }
              continue;
            }

            // Juggernaut or Melee reaching HQ Perimeter (44px)
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

                // Non-juggernaut attackers expend themselves on breach impact
                if (z.archetype !== 'juggernaut') {
                  sim.zombies.splice(i, 1);
                }

                if (sim.baseHp <= 0 && !sim.ended) {
                  sim.ended = true;
                  soundEngine.playFanfare(false);
                  propsRef.current.onGameEnd({
                    victory: false,
                    sectorName: sector.name,
                    waveReached: sim.wave,
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

            // Advance along urban corridor
            if (dist < 0.02 && z.waypointIndex < road.points.length - 1) {
              z.waypointIndex += 1;
            } else if (dist > 0.001) {
              const slowMult = z.slowTimer > 0 ? 0.48 : 1;
              const effSpeed = z.speed * slowMult;
              // Runner weaves laterally
              const weave =
                z.archetype === 'runner'
                  ? Math.sin(z.gaitPhase * 2.2) * 0.018
                  : 0;
              const nx = dx / dist;
              const ny = dy / dist;
              z.x += (nx - ny * weave) * effSpeed * dt;
              z.y += (ny + nx * weave) * effSpeed * dt;
              z.gaitPhase += dt * (z.archetype === 'runner' ? 14 : 8);
            }
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
              // Check if acid spit hits a targeted or nearby tower first
              let hitTower = false;
              for (let tIdx = sim.towers.length - 1; tIdx >= 0; tIdx--) {
                const t = sim.towers[tIdx];
                const dT = Math.hypot(proj.x - t.x * width, proj.y - t.y * height);
                if (dT <= 20) {
                  proj.active = false;
                  hitTower = true;
                  t.hp -= proj.damage * 0.85;
                  spawnParticles(proj.x, proj.y, 8, '#84cc16', 80);
                  if (t.hp <= 0) {
                    soundEngine.playHeavyExplosion();
                    spawnParticles(t.x * width, t.y * height, 22, '#ef4444', 135);
                    if (sim.selectedTowerId === t.id) sim.selectedTowerId = null;
                    sim.towers.splice(tIdx, 1);
                  }
                  break;
                }
              }
              if (hitTower) continue;

              const dHq = Math.hypot(proj.x - 0.5 * width, proj.y - 0.5 * height);
              if (dHq <= 32) {
                proj.active = false;
                sim.baseHp = Math.max(0, sim.baseHp - proj.damage);
                soundEngine.playBaseHit();
                spawnParticles(proj.x, proj.y, 8, '#84cc16', 80);
                if (sim.baseHp <= 0 && !sim.ended) {
                  sim.ended = true;
                  soundEngine.playFanfare(false);
                  propsRef.current.onGameEnd({
                    victory: false,
                    sectorName: sector.name,
                    waveReached: sim.wave,
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

                if (proj.isEmp) {
                  z.slowTimer = 2.4;
                  // Area shock around EMP impact
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
                  sim.hitstopTimer = z.archetype === 'juggernaut' ? 0.045 : 0.02;
                  sim.cameraTrauma = Math.min(
                    1,
                    sim.cameraTrauma + (z.archetype === 'juggernaut' ? 0.35 : 0.1)
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

      // 6. Update Pooled Particles (always tick in real dt)
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
        const selTower =
          sim.towers.find((t) => t.id === sim.selectedTowerId) || null;
        propsRef.current.onHudSync({
          baseHp: Math.round(sim.baseHp),
          baseMaxHp: sim.baseMaxHp,
          wave: sim.wave,
          threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
          zombiesRemaining:
            sim.waveQueue.length +
            sim.zombies.filter((z) => z.koTimer <= 0).length,
          activeTowerCount: sim.towers.length,
          maxTowerSlots: getMaxTowerSlots(currUpgrades),
          unitCountsByType: computeUnitCounts(),
          selectedTower: selTower ? { ...selTower } : null,
        });
      }

      // ==================== RENDERING ====================
      ctx.save();
      ctx.scale(dpr, dpr);

      // Camera shake offset
      const shakeMag = sim.cameraTrauma * sim.cameraTrauma * 10;
      const shakeX = (Math.random() - 0.5) * 2 * shakeMag;
      const shakeY = (Math.random() - 0.5) * 2 * shakeMag;
      ctx.translate(shakeX, shakeY);

      // Background base (transparent when live Google Map is underneath in online mode, solid dark slate in offline vector mode or title)
      if (propsRef.current.isOfflineMode || currentState === 'title') {
        ctx.fillStyle = '#090d16';
        ctx.fillRect(0, 0, width, height);
      } else {
        ctx.clearRect(0, 0, width, height);
        ctx.fillStyle = 'rgba(9, 13, 22, 0.52)';
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

      // Cached Urban Building Footprints
      for (const b of sector.blocks) {
        const bx = b.x * width;
        const by = b.y * height;
        const bw = b.w * width;
        const bh = b.h * height;

        ctx.fillStyle =
          b.type === 'park'
            ? 'rgba(16, 185, 129, 0.14)'
            : b.type === 'industrial'
            ? 'rgba(30, 41, 59, 0.78)'
            : 'rgba(15, 23, 42, 0.82)';
        ctx.strokeStyle =
          b.type === 'park'
            ? 'rgba(16, 185, 129, 0.35)'
            : 'rgba(71, 85, 105, 0.55)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, 6);
        ctx.fill();
        ctx.stroke();
      }

      // Cached Vector Roads (Zombie Corridors)
      for (const road of sector.roads) {
        if (road.points.length < 2) continue;
        // Outer road asphalt
        ctx.strokeStyle = 'rgba(30, 41, 59, 0.92)';
        ctx.lineWidth = road.width;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        road.points.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x * width, pt.y * height);
          else ctx.lineTo(pt.x * width, pt.y * height);
        });
        ctx.stroke();

        // Road shoulder border
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.28)';
        ctx.lineWidth = road.width + 2;
        ctx.stroke();

        // Animated lane directional dashes toward HQ
        ctx.save();
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.38)';
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

        // Spawn Breach Indicator at start of road
        const spawnPt = road.points[0];
        const sx = spawnPt.x * width;
        const sy = spawnPt.y * height;
        ctx.fillStyle = 'rgba(239, 68, 68, 0.22)';
        ctx.beginPath();
        ctx.arc(sx, sy, 18, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Render Real Street Name along corridor entrance
        ctx.save();
        ctx.font = '600 11px "JetBrains Mono", monospace';
        ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
        ctx.textAlign = sx > width * 0.5 ? 'right' : 'left';
        const labelOffsetX = sx > width * 0.5 ? -24 : 24;
        ctx.fillText(road.name, sx + labelOffsetX, sy + 4);
        ctx.restore();
      }

      // Central HQ Command Base at (0.5, 0.5) with Active CIWS Point-Defense Auto-Cannon
      const hqX = 0.5 * width;
      const hqY = 0.5 * height;
      const hqStats = getHqDefenseWeaponStats(currUpgrades);

      // HQ Point-Defense Weapon Engagement Perimeter Ring
      ctx.save();
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.20)';
      ctx.lineWidth = 1.25;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(hqX, hqY, hqStats.range, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Radar sweep ring around HQ
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.24)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 58, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = 'rgba(56, 189, 248, 0.09)';
      ctx.beginPath();
      ctx.moveTo(hqX, hqY);
      ctx.arc(hqX, hqY, 58, sim.radarAngle, sim.radarAngle + 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.restore();

      // HQ Octagon Bunker Base
      ctx.fillStyle = '#0f172a';
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 26, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // HQ Twin-Barrel Point-Defense Auto-Cannon (rotates toward target with recoil)
      ctx.save();
      ctx.translate(hqX, hqY);
      ctx.rotate(sim.hqAngle);
      const hqRecoilPx = sim.hqRecoil * 5.5;
      ctx.fillStyle = '#fbbf24';
      // Dual heavy cannon barrels
      ctx.fillRect(6 - hqRecoilPx, -7, 22, 4.5);
      ctx.fillRect(6 - hqRecoilPx, 2.5, 22, 4.5);
      // Muzzle flash glow on shot
      if (sim.hqRecoil > 0.6) {
        ctx.fillStyle = '#fef08a';
        ctx.beginPath();
        ctx.arc(29 - hqRecoilPx, 0, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // HQ Turret Hub Dome
      ctx.fillStyle = '#f59e0b';
      ctx.strokeStyle = '#090d16';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hqX, hqY, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Render Selected Tower Range Ring or Placement Preview with Live Road/Spacing Validation
      if (currentState === 'playing') {
        const selTower = sim.towers.find((t) => t.id === sim.selectedTowerId);
        if (selTower) {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.65)';
          ctx.lineWidth = 1.5;
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
        } else if (sim.hoverX > 0 && sim.hoverY > 0) {
          const bp = DEPLOYABLE_BLUEPRINTS[propsRef.current.selectedDeployable];
          const counts = computeUnitCounts();
          const dynamicCost = getDynamicDeployCost(
            bp.id,
            counts[bp.id] || 0
          );
          const normHoverX = sim.hoverX / width;
          const normHoverY = sim.hoverY / height;
          const maxSlots = getMaxTowerSlots(currUpgrades);
          const placementCheck =
            bp.category === 'tower'
              ? validateTowerPlacement(
                  normHoverX,
                  normHoverY,
                  sector,
                  sim.towers,
                  maxSlots
                )
              : { valid: true, reason: 'TARGET LOCKED' };
          const canAfford = propsRef.current.scrap >= dynamicCost;
          const isValidAndAffordable = placementCheck.valid && canAfford;

          ctx.save();
          ctx.fillStyle = isValidAndAffordable
            ? 'rgba(16, 185, 129, 0.10)'
            : 'rgba(239, 68, 68, 0.13)';
          ctx.strokeStyle = isValidAndAffordable ? bp.color : '#ef4444';
          ctx.lineWidth = 1.8;
          if (!isValidAndAffordable) {
            ctx.setLineDash([6, 6]);
          }
          ctx.beginPath();
          ctx.arc(sim.hoverX, sim.hoverY, bp.range, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();

          // Footprint ring at cursor
          ctx.setLineDash([]);
          ctx.beginPath();
          ctx.arc(sim.hoverX, sim.hoverY, 16, 0, Math.PI * 2);
          ctx.stroke();

          // Tactical placement status badge above cursor
          const statusLabel = !placementCheck.valid
            ? placementCheck.reason || 'BLOCKED'
            : !canAfford
            ? `NEED ${dynamicCost} SCRAP`
            : `${bp.name.toUpperCase()} · ${dynamicCost} SCRAP`;
          ctx.font = 'bold 11px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillStyle = isValidAndAffordable ? '#10b981' : '#f87171';
          ctx.fillText(statusLabel, sim.hoverX, sim.hoverY - 24);
          ctx.restore();
        }
      }

      // Render Towers (with Construction Progress, Structural HP Bar, and Barrel Heat / Overheat status)
      for (const tower of sim.towers) {
        const tx = tower.x * width;
        const ty = tower.y * height;
        const bp = DEPLOYABLE_BLUEPRINTS[tower.blueprintId];
        const isBuilding = tower.buildProgress < 1;

        // Base pedestal
        ctx.fillStyle = isBuilding ? '#1e293b' : '#0f172a';
        ctx.strokeStyle = tower.overheated
          ? '#ef4444'
          : tower.id === sim.selectedTowerId
          ? '#ffffff'
          : bp.color;
        ctx.lineWidth = tower.id === sim.selectedTowerId ? 3 : 2;
        ctx.beginPath();
        ctx.arc(tx, ty, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        if (isBuilding) {
          // Construction progress arc
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(
            tx,
            ty,
            18,
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
            ty - 20
          );
        } else {
          // Turret barrel rotated toward target
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

        // Structural HP bar & Barrel Heat bar below tower
        const barW = 28;
        const hpPct = Math.max(0, Math.min(1, tower.hp / tower.maxHp));
        ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
        ctx.fillRect(tx - barW / 2, ty + 18, barW, 3.5);
        ctx.fillStyle = hpPct > 0.4 ? '#10b981' : '#ef4444';
        ctx.fillRect(tx - barW / 2, ty + 18, barW * hpPct, 3.5);

        if (tower.heat > 0.05) {
          ctx.fillStyle = 'rgba(9, 13, 22, 0.85)';
          ctx.fillRect(tx - barW / 2, ty + 22.5, barW, 2.5);
          ctx.fillStyle = tower.overheated ? '#ef4444' : '#f59e0b';
          ctx.fillRect(
            tx - barW / 2,
            ty + 22.5,
            barW * Math.min(1, tower.heat),
            2.5
          );
        }

        // Level pips
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`L${tower.level}`, tx, ty + 35);
      }

      // Render Mobile Strike Squads (Troops)
      for (const troop of sim.troops) {
        const rx = troop.x * width;
        const ry = troop.y * height;
        const bob = Math.sin(troop.gaitPhase) * 1.5;

        // Rally flag tether
        ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx, ry);
        ctx.lineTo(troop.rallyX * width, troop.rallyY * height);
        ctx.stroke();

        // Squad 3-soldier chevron formation
        const offsets = [
          { dx: 0, dy: -7 },
          { dx: -7, dy: 6 },
          { dx: 7, dy: 6 },
        ];
        for (const off of offsets) {
          ctx.fillStyle = '#064e3b';
          ctx.strokeStyle = '#10b981';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(rx + off.dx, ry + off.dy + bob, 5.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }

      // Render Zombies
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

        // Windup telegraph ring when attacking HQ
        if (z.isWindingUp) {
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(0, 0, z.radius + 6, 0, Math.PI * 2);
          ctx.stroke();
        }

        // Body color by archetype
        let fill = '#dc2626'; // walker
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

        // Health bar above damaged zombies
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

  // Handle pointer click on tactical canvas (Deploy Tower, Squad, or Airstrike, or select existing tower)
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

    const sim = simRef.current;

    // 1. Check if clicking an existing tower to inspect/upgrade/repair
    for (const t of sim.towers) {
      const distPx = Math.hypot(
        t.x * rect.width - clickX,
        t.y * rect.height - clickY
      );
      if (distPx <= 22) {
        sim.selectedTowerId = t.id;
        propsRef.current.onHudSync({
          baseHp: Math.round(sim.baseHp),
          baseMaxHp: sim.baseMaxHp,
          wave: sim.wave,
          threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
          zombiesRemaining:
            sim.waveQueue.length +
            sim.zombies.filter((z) => z.koTimer <= 0).length,
          activeTowerCount: sim.towers.length,
          maxTowerSlots: getMaxTowerSlots(propsRef.current.upgrades),
          unitCountsByType: computeUnitCounts(),
          selectedTower: { ...t },
        });
        return;
      }
    }

    sim.selectedTowerId = null;

    const bp = DEPLOYABLE_BLUEPRINTS[propsRef.current.selectedDeployable];
    if (!bp) return;

    const counts = computeUnitCounts();
    const dynamicCost = getDynamicDeployCost(bp.id, counts[bp.id] || 0);

    // 2. Validate terrain & road clearance rules for static towers
    if (bp.category === 'tower') {
      const maxSlots = getMaxTowerSlots(propsRef.current.upgrades);
      const check = validateTowerPlacement(
        normX,
        normY,
        propsRef.current.activeSector,
        sim.towers,
        maxSlots
      );
      if (!check.valid) {
        // Visual rejection burst on invalid road/spacing click
        spawnParticles(clickX, clickY, 8, '#ef4444', 70);
        return;
      }
    } else if (bp.category === 'troop') {
      const distToHq = Math.hypot(0.5 * rect.width - clickX, 0.5 * rect.height - clickY);
      if (distToHq < 38) {
        spawnParticles(clickX, clickY, 6, '#ef4444', 60);
        return;
      }
    }

    if (propsRef.current.scrap < dynamicCost) {
      spawnParticles(clickX, clickY, 6, '#ef4444', 55);
      return;
    }

    propsRef.current.onSpendScrap(dynamicCost);

    if (bp.category === 'ability') {
      // Orbital Napalm Airstrike
      soundEngine.playHeavyExplosion();
      sim.cameraTrauma = Math.min(1, sim.cameraTrauma + 0.7);
      spawnParticles(clickX, clickY, 36, '#ef4444', 180);
      spawnParticles(clickX, clickY, 20, '#f59e0b', 130);

      for (const z of sim.zombies) {
        if (z.koTimer > 0) continue;
        const d = Math.hypot(
          z.x * rect.width - clickX,
          z.y * rect.height - clickY
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
    } else if (bp.category === 'troop') {
      soundEngine.playDeploy();
      spawnParticles(clickX, clickY, 12, '#10b981', 90);
      sim.troops.push({
        id: sim.nextEntityId++,
        x: 0.5,
        y: 0.5,
        rallyX: normX,
        rallyY: normY,
        hp: 150,
        maxHp: 150,
        range: bp.range,
        damage: bp.damage,
        fireRate: bp.fireRate,
        cooldown: 0,
        angle: 0,
        gaitPhase: 0,
        flashTimer: 0,
      });
    } else {
      // Deploy Tower (starts at buildProgress = 0 and constructs over 3.2s)
      soundEngine.playDeploy();
      spawnParticles(clickX, clickY, 14, bp.color, 95);
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
        angle: 0,
        recoil: 0,
        kills: 0,
      };
      sim.towers.push(newTower);
      sim.selectedTowerId = newTower.id;
    }

    const selTower =
      sim.towers.find((t) => t.id === sim.selectedTowerId) || null;
    propsRef.current.onHudSync({
      baseHp: Math.round(sim.baseHp),
      baseMaxHp: sim.baseMaxHp,
      wave: sim.wave,
      threatMultiplier: getWaveDifficultyScaling(sim.wave).hpMultiplier,
      zombiesRemaining:
        sim.waveQueue.length +
        sim.zombies.filter((z) => z.koTimer <= 0).length,
      activeTowerCount: sim.towers.length,
      maxTowerSlots: getMaxTowerSlots(propsRef.current.upgrades),
      unitCountsByType: computeUnitCounts(),
      selectedTower: selTower ? { ...selTower } : null,
    });
  };

  const handleCanvasPointerMove = (
    e: React.PointerEvent<HTMLCanvasElement>
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    simRef.current.hoverX = e.clientX - rect.left;
    simRef.current.hoverY = e.clientY - rect.top;
  };

  const handleCanvasPointerLeave = () => {
    simRef.current.hoverX = -1000;
    simRef.current.hoverY = -1000;
  };

  return (
    <canvas
      ref={canvasRef}
      data-testid="tactical-battle-canvas"
      aria-label="Tactical City Sector Defense Canvas"
      onPointerDown={handleCanvasPointerDown}
      onPointerMove={handleCanvasPointerMove}
      onPointerLeave={handleCanvasPointerLeave}
      className="absolute inset-0 w-full h-full cursor-crosshair z-10"
    />
  );
};
