import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_UPGRADES,
  PRESET_CITY_SECTORS,
  buildProceduralSectorFromCoords,
  calculateMapControlPercentage,
  calculateUpgradeCost,
  canAffordDeployable,
  convertLatLngPathToSectorRoad,
  create360ZombieSpawnPoint,
  createInitialFortressZones,
  createZombieWaveComposition,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getHqDefenseWeaponStats,
  getMaxBaseHp,
  getMaxTowerSlots,
  getScrapCollectorYieldPerSecond,
  getScrapRewardWithBonus,
  isPointInsideCapturedZone,
  projectLatLngToSectorPoint,
  stepFortressZoneCaptureAndFall,
  unprojectSectorPointToLatLng,
  validateTowerPlacement,
} from './rules';

test('getDynamicDeployCost and canAffordDeployable return flat costs without price escalation', () => {
  const cost0 = getDynamicDeployCost('rotary_turret', 0);
  const cost1 = getDynamicDeployCost('rotary_turret', 1);
  const cost5 = getDynamicDeployCost('rotary_turret', 5);
  assert.equal(cost0, 100);
  assert.equal(cost1, 100);
  assert.equal(cost5, 100);

  // Verify Heavy Fortress, Scrap Refinery, Barracks, Vehicle Factory, and Forward HQ flat costs
  assert.equal(getDynamicDeployCost('fortress', 0), 190);
  assert.equal(getDynamicDeployCost('fortress', 3), 190);
  assert.equal(getDynamicDeployCost('scrap_collector', 0), 120);
  assert.equal(getDynamicDeployCost('scrap_collector', 3), 120);
  assert.equal(getDynamicDeployCost('infantry_barracks', 0), 150);
  assert.equal(getDynamicDeployCost('infantry_barracks', 2), 150);
  assert.equal(getDynamicDeployCost('vehicle_factory', 0), 210);
  assert.equal(getDynamicDeployCost('vehicle_factory', 2), 210);
  assert.equal(getDynamicDeployCost('forward_hq', 0), 260);
  assert.equal(getDynamicDeployCost('forward_hq', 2), 260);

  assert.equal(canAffordDeployable(100, 'rotary_turret', 0), true);
  assert.equal(canAffordDeployable(100, 'rotary_turret', 4), true);
  assert.equal(canAffordDeployable(99, 'rotary_turret', 1), false);
  assert.equal(canAffordDeployable(225, 'airstrike', 0), true);
});

test('validateTowerPlacement enforces Player-Controlled Area, street asphalt, HQ perimeter, stacking, and grid cap', () => {
  const sector = PRESET_CITY_SECTORS[0];
  const zones = createInitialFortressZones(sector);
  const maxSlots = getMaxTowerSlots(INITIAL_UPGRADES, 1);
  assert.equal(maxSlots, 8);
  assert.equal(getMaxTowerSlots(INITIAL_UPGRADES, 3), 14);

  // 1. Cannot build on HQ perimeter (0.5, 0.5)
  const onHq = validateTowerPlacement(0.5, 0.5, sector, [], maxSlots, zones);
  assert.equal(onHq.valid, false);

  // 2. Cannot build in Zombie-Controlled Area without Forward HQ or nearby Soldiers/Vehicles
  const outsideZone = validateTowerPlacement(0.18, 0.28, sector, [], maxSlots, zones);
  assert.equal(outsideZone.valid, false);
  assert.equal(outsideZone.reason?.includes('OUTSIDE PLAYER AREA'), true);

  // 2b. When a Soldier or Heavy Vehicle moves along the road to (0.20, 0.22), the player CAN build a Forward HQ Base off-road at (0.18, 0.28)!
  const withUnitVanguard = validateTowerPlacement(
    0.18,
    0.28,
    sector,
    [],
    maxSlots,
    undefined,
    [{ x: 0.20, y: 0.22 }],
    'forward_hq'
  );
  assert.equal(withUnitVanguard.valid, true);

  // 3. Cannot build directly on a road waypoint/segment inside the HQ zone
  const roadPt = sector.roads[0].points[3]; // near (0.5, 0.45) inside HQ zone
  const onRoad = validateTowerPlacement(roadPt.x, roadPt.y, sector, [], maxSlots, zones);
  assert.equal(onRoad.valid, false);
  assert.equal(onRoad.reason?.includes('ASPHALT'), true);

  // 4. Valid rooftop/curb position inside the captured Central HQ zone away from roads
  const clearSite = validateTowerPlacement(0.59, 0.59, sector, [], maxSlots, zones);
  assert.equal(clearSite.valid, true);

  // 5. Cannot stack another tower on the same spot
  const stacked = validateTowerPlacement(0.60, 0.59, sector, [{ x: 0.59, y: 0.59 }], maxSlots, zones);
  assert.equal(stacked.valid, false);
  assert.equal(stacked.reason?.includes('BUILDING'), true);

  // 6. Cannot exceed Power Grid cap
  const fullGrid = Array.from({ length: maxSlots }, (_, i) => ({
    x: 0.35 + i * 0.03,
    y: 0.38,
  }));
  const overflow = validateTowerPlacement(0.59, 0.59, sector, fullGrid, maxSlots, zones);
  assert.equal(overflow.valid, false);
  assert.equal(overflow.reason?.includes('GRID FULL'), true);
});

test('Whole-map Player vs. Zombie SQUARE territory calculation (HQ-only) and 360-degree zombie spawning', async () => {
  const { canTrainUnit, isPointInPlayerControlledArea } = await import('./rules');
  const sector = PRESET_CITY_SECTORS[0];
  const initialCtrl = calculateMapControlPercentage([], true);
  assert.equal(initialCtrl.hqCount, 1);
  assert.equal(initialCtrl.playerPercent > 20 && initialCtrl.playerPercent < 50, true);
  assert.equal(initialCtrl.playerPercent + initialCtrl.zombiePercent, 100);

  // 1. Only HQs gain zones: placing a Heavy Fortress does NOT increase Player-Controlled Area or HQ count
  const withFortressOnly = calculateMapControlPercentage(
    [{ blueprintId: 'fortress', x: 0.25, y: 0.25, level: 2, controlRadius: 0.16 }],
    true
  );
  assert.equal(withFortressOnly.hqCount, 1);
  assert.equal(withFortressOnly.playerPercent, initialCtrl.playerPercent);

  // 2. Square Zone Geometry: corner of Primary HQ square (0.74, 0.74) is inside the 0.25 half-width square!
  assert.equal(isPointInPlayerControlledArea(0.74, 0.74, [], []), true);
  assert.equal(isPointInPlayerControlledArea(0.77, 0.77, [], []), false);

  // 3. Building Forward HQs across the 4 quadrants expands Square Player-Controlled Area to 100%
  const expandedCtrl = calculateMapControlPercentage(
    [
      { blueprintId: 'forward_hq', x: 0.25, y: 0.25, level: 2, controlRadius: 0.28 },
      { blueprintId: 'forward_hq', x: 0.75, y: 0.25, level: 2, controlRadius: 0.28 },
      { blueprintId: 'forward_hq', x: 0.75, y: 0.75, level: 2, controlRadius: 0.28 },
      { blueprintId: 'forward_hq', x: 0.25, y: 0.75, level: 2, controlRadius: 0.28 },
    ],
    true
  );
  assert.equal(expandedCtrl.hqCount, 5);
  assert.equal(expandedCtrl.playerPercent, 100);
  assert.equal(expandedCtrl.zombiePercent, 0);

  // 4. Unit training unlock rules: units are locked until their producer building is built
  assert.equal(canTrainUnit('soldier', 300, { infantry_barracks: 0 }).unlocked, false);
  assert.equal(canTrainUnit('soldier', 300, { infantry_barracks: 1 }).allowed, true);
  assert.equal(canTrainUnit('heavy_vehicle', 300, { vehicle_factory: 0 }).unlocked, false);
  assert.equal(canTrainUnit('heavy_vehicle', 300, { vehicle_factory: 1 }).allowed, true);

  // Verify 360° zombie spawns come from all 4 compass quadrants around the map perimeter
  const spawns = Array.from({ length: 16 }, (_, i) =>
    create360ZombieSpawnPoint(i, 16, sector)
  );
  assert.equal(spawns.some((s) => s.x < 0.3 && s.y < 0.3), true);
  assert.equal(spawns.some((s) => s.x > 0.7 && s.y < 0.3), true);
  assert.equal(spawns.some((s) => s.x > 0.7 && s.y > 0.7), true);
  assert.equal(spawns.some((s) => s.x < 0.3 && s.y > 0.7), true);
});

test('FortressZone capture by soldiers/vehicles and Zone Fall when zombies eliminate defenders', () => {
  const sector = PRESET_CITY_SECTORS[0];
  const zones = createInitialFortressZones(sector);
  assert.equal(zones.length, 5);
  assert.equal(zones[0].isHq, true);
  assert.equal(zones[0].status, 'captured');

  const nwFortress = zones[1];
  assert.equal(nwFortress.status, 'hostile');
  assert.equal(isPointInsideCapturedZone(nwFortress.x, nwFortress.y, zones), false);

  // Step 1: Soldiers & Heavy Vehicles enter NW Fortress uncontested and capture it
  let current = nwFortress;
  let capturedEvent = false;
  for (let i = 0; i < 10; i++) {
    const res = stepFortressZoneCaptureAndFall(current, 3, 0, 1.0);
    current = res.updatedZone;
    if (res.justCaptured) capturedEvent = true;
  }
  assert.equal(capturedEvent, true);
  assert.equal(current.status, 'captured');
  assert.equal(current.captureProgress, 1);

  const updatedZones = zones.map((z) => (z.id === current.id ? current : z));
  assert.equal(isPointInsideCapturedZone(nwFortress.x, nwFortress.y, updatedZones), true);

  // Step 2: Zombies eliminate defending soldiers (friendlyUnitsInZone = 0, zombiesInZone = 4) -> Zone Falls!
  let fellEvent = false;
  for (let i = 0; i < 10; i++) {
    const res = stepFortressZoneCaptureAndFall(current, 0, 4, 0.5);
    current = res.updatedZone;
    if (res.justFell) fellEvent = true;
  }
  assert.equal(fellEvent, true);
  assert.equal(current.status, 'hostile');
  assert.equal(current.captureProgress, 0);

  // Step 3: Verify Scrap Refinery economy yield scales with building level and salvage scanner
  assert.equal(getScrapCollectorYieldPerSecond(1, INITIAL_UPGRADES), 5);
  assert.equal(getScrapCollectorYieldPerSecond(3, INITIAL_UPGRADES) > 5, true);
  assert.equal(getHqDefenseWeaponStats(INITIAL_UPGRADES).damage, 24);
});

test('calculateUpgradeCost scales exponentially with level', () => {
  const baseStat = { ...INITIAL_UPGRADES[0], level: 1 };
  const lvl1Cost = calculateUpgradeCost(baseStat);
  assert.equal(lvl1Cost.gems, 50);
  assert.equal(lvl1Cost.scrap, 150);

  const lvl3Cost = calculateUpgradeCost({ ...baseStat, level: 3 });
  assert.equal(lvl3Cost.gems > lvl1Cost.gems, true);
  assert.equal(lvl3Cost.scrap > lvl1Cost.scrap, true);
});

test('getEffectiveTowerStats applies both tower level and global upgrades', () => {
  const baseStats = getEffectiveTowerStats('rotary_turret', 1, INITIAL_UPGRADES);
  const upgradedGlobal = INITIAL_UPGRADES.map((u) =>
    u.id === 'turret_damage' ? { ...u, level: 3 } : u
  );
  const boostedStats = getEffectiveTowerStats('rotary_turret', 2, upgradedGlobal);
  assert.equal(boostedStats.damage > baseStats.damage, true);
  assert.equal(boostedStats.range > baseStats.range, true);
  assert.equal(boostedStats.maxHp > baseStats.maxHp, true);
});

test('getMaxBaseHp, getHqDefenseWeaponStats, and getScrapRewardWithBonus reflect upgrade levels', async () => {
  const { getHqDefenseWeaponStats } = await import('./rules');
  assert.equal(getMaxBaseHp(INITIAL_UPGRADES), 1000);
  const baseHqWeapon = getHqDefenseWeaponStats(INITIAL_UPGRADES);
  assert.equal(baseHqWeapon.damage, 24);
  assert.equal(baseHqWeapon.range, 168);

  const upgraded = INITIAL_UPGRADES.map((u) =>
    u.id === 'base_fortification' || u.id === 'salvage_scanner' || u.id === 'turret_damage'
      ? { ...u, level: 3 }
      : u
  );
  assert.equal(getMaxBaseHp(upgraded), 1500);
  assert.equal(getScrapRewardWithBonus(20, upgraded), 28);
  const upgradedHqWeapon = getHqDefenseWeaponStats(upgraded);
  assert.equal(upgradedHqWeapon.damage > baseHqWeapon.damage, true);
  assert.equal(upgradedHqWeapon.range > baseHqWeapon.range, true);
  assert.equal(upgradedHqWeapon.fireRate > baseHqWeapon.fireRate, true);
});

test('createZombieWaveComposition and getWaveDifficultyScaling start light in Wave 1 and scale harder over time', async () => {
  const { getWaveDifficultyScaling } = await import('./rules');
  const wave1 = createZombieWaveComposition(1);
  const wave5 = createZombieWaveComposition(5);
  const wave12 = createZombieWaveComposition(12);

  assert.equal(wave1.length, 6);
  assert.equal(wave5.length > wave1.length, true);
  assert.equal(wave12.length > wave5.length, true);
  assert.equal(wave5.includes('spitter'), true);
  assert.equal(wave5.includes('juggernaut'), true);

  const s1 = getWaveDifficultyScaling(1);
  const s5 = getWaveDifficultyScaling(5);
  const s15 = getWaveDifficultyScaling(15);

  assert.equal(s1.hpMultiplier, 1);
  assert.equal(s5.hpMultiplier > s1.hpMultiplier, true);
  assert.equal(s15.hpMultiplier > s5.hpMultiplier, true);
  assert.equal(s15.speedMultiplier > s5.speedMultiplier, true);
  assert.equal(s15.damageMultiplier > s5.damageMultiplier, true);
  assert.equal(s15.spawnIntervalSeconds < s1.spawnIntervalSeconds, true);
});

test('convertLatLngPathToSectorRoad maps real GPS street polylines into tactical [0..1] coordinates ending at HQ (0.5, 0.5)', () => {
  const centerLat = 40.758;
  const centerLng = -73.9855;
  const road = convertLatLngPathToSectorRoad(
    'test-real-road',
    'Broadway & W 42nd St',
    [
      { lat: 40.7615, lng: -73.9838 },
      { lat: 40.7595, lng: -73.9849 },
      { lat: centerLat, lng: centerLng },
    ],
    centerLat,
    centerLng,
    520
  );

  assert.equal(road.points.length >= 3, true);
  const lastPt = road.points[road.points.length - 1];
  assert.equal(lastPt.x, 0.5);
  assert.equal(lastPt.y, 0.5);
  assert.equal(Array.isArray(road.latLngPoints), true);
  assert.equal(road.latLngPoints?.length, road.points.length);

  // Verify round-trip projection accuracy
  const pt = projectLatLngToSectorPoint(40.76, -73.984, centerLat, centerLng);
  const unproj = unprojectSectorPointToLatLng(pt.x, pt.y, centerLat, centerLng);
  assert.equal(Math.abs(unproj.lat - 40.76) < 0.0005, true);
  assert.equal(Math.abs(unproj.lng - -73.984) < 0.0005, true);
});

test('PRESET_CITY_SECTORS and buildProceduralSectorFromCoords contain real GPS street coordinates', () => {
  for (const preset of PRESET_CITY_SECTORS) {
    assert.equal(preset.roads.length, 4);
    for (const r of preset.roads) {
      assert.equal(Array.isArray(r.latLngPoints) && r.latLngPoints.length >= 2, true);
      const end = r.points[r.points.length - 1];
      assert.equal(end.x, 0.5);
      assert.equal(end.y, 0.5);
    }
  }
  const sector = buildProceduralSectorFromCoords('Downtown Core', 'Chicago, USA', 41.8781, -87.6298);
  assert.equal(sector.roads.length, 4);
  assert.equal(sector.blocks.length, 4);
  assert.equal(typeof sector.cachedAt, 'number');
});

test('Native Android Studio (Kotlin + Jetpack Compose) project contains all 19 Clean Architecture files and PWA assets on disk', async () => {
  const fs = await import('node:fs');
  const expectedAndroidFiles = [
    'android_game/settings.gradle.kts',
    'android_game/build.gradle.kts',
    'android_game/app/build.gradle.kts',
    'android_game/app/src/main/AndroidManifest.xml',
    'android_game/app/src/main/java/com/sectorzero/citydefense/SectorZeroApp.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/MainActivity.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/di/AppContainer.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/CitySectorModels.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/DefenseEntities.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/EconomyModels.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/repository/GameRepositories.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/RoadNetworkPathfinder.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/WaveScalingEngine.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/data/local/OfflineSectorDataSource.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/data/repository/GameRepositoriesImpl.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/viewmodel/AndroidGameViewModel.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/SatelliteMapComposable.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/TacticalBattleCanvas.kt',
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/AndroidGameScreen.kt',
  ];

  for (const file of expectedAndroidFiles) {
    assert.equal(fs.existsSync(file), true, `Missing Android file ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.length > 100, true, `Empty or truncated ${file}`);
  }

  // Verify obsolete Flutter project was removed during Android rebuild
  assert.equal(fs.existsSync('flutter_project'), false);

  // Verify Android Satellite Map, 4 Dock Tabs, Immersive Game Manifest, and Real-Road Pathfinding
  const manifestXml = fs.readFileSync(
    'android_game/app/src/main/AndroidManifest.xml',
    'utf8'
  );
  assert.equal(manifestXml.includes('android.intent.category.GAME'), true);
  assert.equal(manifestXml.includes('android.permission.VIBRATE'), true);

  const satelliteKt = fs.readFileSync(
    'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/SatelliteMapComposable.kt',
    'utf8'
  );
  assert.equal(satelliteKt.includes('World_Imagery/MapServer/tile'), true);

  const entitiesKt = fs.readFileSync(
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/DefenseEntities.kt',
    'utf8'
  );
  assert.equal(entitiesKt.includes('1. Defense'), true);
  assert.equal(entitiesKt.includes('4. Units & Army'), true);

  const pathfinderKt = fs.readFileSync(
    'android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/RoadNetworkPathfinder.kt',
    'utf8'
  );
  assert.equal(pathfinderKt.includes('computeRoadNetworkPath'), true);
  assert.equal(pathfinderKt.includes('projectPointToNearestRoad'), true);
  assert.equal(pathfinderKt.includes('validateOffRoadBuildingPlacement'), true);

  // Verify Android PWA / WebAPK icons exist
  const pwaAssets = [
    'public/icon.svg',
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/pwa-maskable-512x512.png',
    'public/apple-touch-icon.png',
  ];
  for (const asset of pwaAssets) {
    assert.equal(fs.existsSync(asset), true, `Missing PWA asset ${asset}`);
    assert.equal(fs.statSync(asset).size > 100, true, `Empty PWA asset ${asset}`);
  }
});

test('projectPointToNearestRoad and computeRoadNetworkPath route newly built units from off-road buildings onto real roads', async () => {
  const { projectPointToNearestRoad, computeRoadNetworkPath } = await import(
    './rules'
  );
  const sector = PRESET_CITY_SECTORS[0];
  assert.equal(sector.name.includes('Full Satellite Map'), true);

  // Off-road building coordinate at (0.59, 0.59)
  const exitPt = projectPointToNearestRoad(0.59, 0.59, sector.roads);
  assert.equal(exitPt.distance > 0.03, true);

  // Verify exitPt lies directly on a real road segment (distance to road is ~0)
  const checkOnRoad = projectPointToNearestRoad(exitPt.x, exitPt.y, sector.roads);
  assert.equal(checkOnRoad.distance < 1e-6, true);

  // Compute road network path from off-road Barracks (0.59, 0.59) to NW road approach (0.18, 0.18)
  const roadPath = computeRoadNetworkPath(0.59, 0.59, 0.18, 0.18, sector.roads);
  assert.equal(roadPath.length >= 3, true);
  // First waypoint is the road exit point where the unit enters the real road
  assert.equal(Math.abs(roadPath[0].x - exitPt.x) < 1e-6, true);
  assert.equal(Math.abs(roadPath[0].y - exitPt.y) < 1e-6, true);

  // Every waypoint in roadPath lies on the real road network
  for (const wp of roadPath) {
    const proj = projectPointToNearestRoad(wp.x, wp.y, sector.roads);
    assert.equal(proj.distance < 1e-5, true);
  }
});

