import test from 'node:test';
import assert from 'node:assert/strict';
import {
  INITIAL_UPGRADES,
  PRESET_CITY_SECTORS,
  buildProceduralSectorFromCoords,
  calculateUpgradeCost,
  canAffordDeployable,
  convertLatLngPathToSectorRoad,
  createZombieWaveComposition,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getMaxBaseHp,
  getMaxTowerSlots,
  getScrapRewardWithBonus,
  projectLatLngToSectorPoint,
  unprojectSectorPointToLatLng,
  validateTowerPlacement,
} from './rules';

test('getDynamicDeployCost and canAffordDeployable scale progressively with active unit count', () => {
  const cost0 = getDynamicDeployCost('rotary_turret', 0);
  const cost1 = getDynamicDeployCost('rotary_turret', 1);
  const cost2 = getDynamicDeployCost('rotary_turret', 2);
  assert.equal(cost0, 115);
  assert.equal(cost1 > cost0, true);
  assert.equal(cost2 > cost1, true);

  assert.equal(canAffordDeployable(115, 'rotary_turret', 0), true);
  assert.equal(canAffordDeployable(115, 'rotary_turret', 1), false);
  assert.equal(canAffordDeployable(225, 'airstrike', 0), true);
});

test('validateTowerPlacement blocks street asphalt, HQ perimeter, tower stacking, and grid overflow', () => {
  const sector = PRESET_CITY_SECTORS[0];
  const maxSlots = getMaxTowerSlots(INITIAL_UPGRADES);
  assert.equal(maxSlots, 6);

  // 1. Cannot build on HQ perimeter (0.5, 0.5)
  const onHq = validateTowerPlacement(0.5, 0.5, sector, [], maxSlots);
  assert.equal(onHq.valid, false);

  // 2. Cannot build directly on a road waypoint/segment
  const roadPt = sector.roads[0].points[1];
  const onRoad = validateTowerPlacement(roadPt.x, roadPt.y, sector, [], maxSlots);
  assert.equal(onRoad.valid, false);
  assert.equal(onRoad.reason?.includes('ASPHALT'), true);

  // 3. Valid rooftop/curb position on an urban block away from roads and HQ
  const clearSite = validateTowerPlacement(0.74, 0.72, sector, [], maxSlots);
  assert.equal(clearSite.valid, true);

  // 4. Cannot stack another tower on the same spot
  const stacked = validateTowerPlacement(0.75, 0.72, sector, [{ x: 0.74, y: 0.72 }], maxSlots);
  assert.equal(stacked.valid, false);
  assert.equal(stacked.reason?.includes('TOWER'), true);

  // 5. Cannot exceed Power Grid cap
  const fullGrid = Array.from({ length: maxSlots }, (_, i) => ({
    x: 0.1 + i * 0.1,
    y: 0.15,
  }));
  const overflow = validateTowerPlacement(0.8, 0.8, sector, fullGrid, maxSlots);
  assert.equal(overflow.valid, false);
  assert.equal(overflow.reason?.includes('GRID FULL'), true);
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
