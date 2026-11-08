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
  const outsideZone = validateTowerPlacement(0.18, 0.18, sector, [], maxSlots, zones);
  assert.equal(outsideZone.valid, false);
  assert.equal(outsideZone.reason?.includes('OUTSIDE PLAYER AREA'), true);

  // 2b. When a Soldier or Heavy Vehicle moves to (0.18, 0.18), the player CAN build a Forward HQ Base there!
  const withUnitVanguard = validateTowerPlacement(
    0.18,
    0.18,
    sector,
    [],
    maxSlots,
    undefined,
    [{ x: 0.19, y: 0.19 }],
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

test('Whole-map Player vs. Zombie territory calculation and 360-degree zombie spawning', () => {
  const sector = PRESET_CITY_SECTORS[0];
  const initialCtrl = calculateMapControlPercentage([], true);
  assert.equal(initialCtrl.hqCount, 1);
  assert.equal(initialCtrl.playerPercent > 20 && initialCtrl.playerPercent < 50, true);
  assert.equal(initialCtrl.playerPercent + initialCtrl.zombiePercent, 100);

  // Building Forward HQs and Heavy Fortresses across the 4 quadrants expands Player-Controlled Area to 100%
  const expandedCtrl = calculateMapControlPercentage(
    [
      { blueprintId: 'forward_hq', x: 0.25, y: 0.25, level: 2, controlRadius: 0.30 },
      { blueprintId: 'forward_hq', x: 0.75, y: 0.25, level: 2, controlRadius: 0.30 },
      { blueprintId: 'forward_hq', x: 0.75, y: 0.75, level: 2, controlRadius: 0.30 },
      { blueprintId: 'forward_hq', x: 0.25, y: 0.75, level: 2, controlRadius: 0.30 },
      { blueprintId: 'fortress', x: 0.50, y: 0.20, level: 1, controlRadius: 0.16 },
    ],
    true
  );
  assert.equal(expandedCtrl.hqCount, 5);
  assert.equal(expandedCtrl.playerPercent, 100);
  assert.equal(expandedCtrl.zombiePercent, 0);

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

test('createZombieWaveComposition and getWaveDifficultyScaling scale endlessly with each wave', async () => {
  const { getWaveDifficultyScaling } = await import('./rules');
  const wave1 = createZombieWaveComposition(1);
  const wave5 = createZombieWaveComposition(5);
  const wave12 = createZombieWaveComposition(12);

  assert.equal(wave1.length, 16);
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

test('Flutter Clean Architecture project contains all 20 layered source files on disk', async () => {
  const fs = await import('node:fs');
  const expectedFiles = [
    'flutter_project/pubspec.yaml',
    'flutter_project/lib/main.dart',
    'flutter_project/lib/injection_container.dart',
    'flutter_project/lib/core/error/failures.dart',
    'flutter_project/lib/core/usecases/usecase.dart',
    'flutter_project/lib/domain/entities/city_sector_entity.dart',
    'flutter_project/lib/domain/entities/defense_entities.dart',
    'flutter_project/lib/domain/entities/store_entities.dart',
    'flutter_project/lib/domain/repositories/map_sector_repository.dart',
    'flutter_project/lib/domain/repositories/economy_repository.dart',
    'flutter_project/lib/domain/usecases/map_sector_usecases.dart',
    'flutter_project/lib/domain/usecases/tactical_defense_usecases.dart',
    'flutter_project/lib/data/models/city_sector_model.dart',
    'flutter_project/lib/data/datasources/local_offline_cache_datasource.dart',
    'flutter_project/lib/data/repositories/map_sector_repository_impl.dart',
    'flutter_project/lib/data/repositories/economy_repository_impl.dart',
    'flutter_project/lib/presentation/bloc/tactical_defense_cubit.dart',
    'flutter_project/lib/presentation/pages/tactical_defense_page.dart',
    'flutter_project/lib/presentation/widgets/tactical_overlay_painter.dart',
    'flutter_project/lib/presentation/widgets/store_bottom_sheet.dart',
  ];
  for (const file of expectedFiles) {
    assert.equal(fs.existsSync(file), true, `Missing ${file}`);
    const content = fs.readFileSync(file, 'utf8');
    assert.equal(content.length > 100, true, `Empty or truncated ${file}`);
  }
});
