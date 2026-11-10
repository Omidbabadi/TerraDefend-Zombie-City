import 'dart:math';
import 'package:equatable/equatable.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../core/usecases/usecase.dart';
import '../../domain/entities/city_sector_entity.dart';
import '../../domain/entities/defense_entities.dart';
import '../../domain/entities/store_entities.dart';
import '../../domain/repositories/economy_repository.dart';
import '../../domain/usecases/map_sector_usecases.dart';
import '../../domain/usecases/tactical_defense_usecases.dart';

class TacticalDefenseState extends Equatable {
  final bool isLoading;
  final bool isOfflineVectorMode;
  final List<CitySectorEntity> availableSectors;
  final CitySectorEntity? activeSector;
  final CommanderWalletEntity wallet;
  final DockTabCategory activeDockTab;
  final DeployableType selectedDeployable;
  final int hqCommandHp;
  final int hqMaxHp;
  final int currentWave;
  final double breathingTimeRemaining;
  final List<DefenseTowerEntity> towers;
  final List<TroopSquadEntity> squads;
  final List<ZombieHostileEntity> hostiles;
  final String? statusBannerMessage;

  const TacticalDefenseState({
    this.isLoading = true,
    this.isOfflineVectorMode = false,
    this.availableSectors = const [],
    this.activeSector,
    this.wallet = const CommanderWalletEntity(
      tacticalScrap: 420,
      bioCoreGems: 350,
      bestScore: 0,
      upgrades: [],
    ),
    this.activeDockTab = DockTabCategory.defensive,
    this.selectedDeployable = DeployableType.rotaryTurret,
    this.hqCommandHp = 1000,
    this.hqMaxHp = 1000,
    this.currentWave = 1,
    this.breathingTimeRemaining = 12.0,
    this.towers = const [],
    this.squads = const [],
    this.hostiles = const [],
    this.statusBannerMessage,
  });

  bool get hasInfantryBarracks =>
      towers.any((t) => t.type == DeployableType.infantryBarracks);

  bool get hasHeavyVehicleFactory =>
      towers.any((t) => t.type == DeployableType.heavyVehicleFactory);

  int get hqCount =>
      1 + towers.where((t) => t.type == DeployableType.forwardHqBase).length;

  TacticalDefenseState copyWith({
    bool? isLoading,
    bool? isOfflineVectorMode,
    List<CitySectorEntity>? availableSectors,
    CitySectorEntity? activeSector,
    CommanderWalletEntity? wallet,
    DockTabCategory? activeDockTab,
    DeployableType? selectedDeployable,
    int? hqCommandHp,
    int? hqMaxHp,
    int? currentWave,
    double? breathingTimeRemaining,
    List<DefenseTowerEntity>? towers,
    List<TroopSquadEntity>? squads,
    List<ZombieHostileEntity>? hostiles,
    String? statusBannerMessage,
  }) {
    return TacticalDefenseState(
      isLoading: isLoading ?? this.isLoading,
      isOfflineVectorMode: isOfflineVectorMode ?? this.isOfflineVectorMode,
      availableSectors: availableSectors ?? this.availableSectors,
      activeSector: activeSector ?? this.activeSector,
      wallet: wallet ?? this.wallet,
      activeDockTab: activeDockTab ?? this.activeDockTab,
      selectedDeployable: selectedDeployable ?? this.selectedDeployable,
      hqCommandHp: hqCommandHp ?? this.hqCommandHp,
      hqMaxHp: hqMaxHp ?? this.hqMaxHp,
      currentWave: currentWave ?? this.currentWave,
      breathingTimeRemaining:
          breathingTimeRemaining ?? this.breathingTimeRemaining,
      towers: towers ?? this.towers,
      squads: squads ?? this.squads,
      hostiles: hostiles ?? this.hostiles,
      statusBannerMessage: statusBannerMessage,
    );
  }

  @override
  List<Object?> get props => [
        isLoading,
        isOfflineVectorMode,
        availableSectors,
        activeSector,
        wallet,
        activeDockTab,
        selectedDeployable,
        hqCommandHp,
        hqMaxHp,
        currentWave,
        breathingTimeRemaining,
        towers,
        squads,
        hostiles,
        statusBannerMessage,
      ];
}

class TacticalDefenseCubit extends Cubit<TacticalDefenseState> {
  static const double initialPrepSeconds = 12.0;
  static const double interWaveBreathingSeconds = 16.0;

  final GetCachedSectorsUseCase getCachedSectorsUseCase;
  final CacheCitySectorOfflineUseCase cacheCitySectorOfflineUseCase;
  final BuildCustomCoordinatesSectorUseCase buildCustomCoordinatesSectorUseCase;
  final DeployTacticalUnitUseCase deployTacticalUnitUseCase;
  final PurchaseArmoryUpgradeUseCase purchaseArmoryUpgradeUseCase;
  final ClaimStoreCurrencyPackUseCase claimStoreCurrencyPackUseCase;
  final EconomyRepository economyRepository;

  TacticalDefenseCubit({
    required this.getCachedSectorsUseCase,
    required this.cacheCitySectorOfflineUseCase,
    required this.buildCustomCoordinatesSectorUseCase,
    required this.deployTacticalUnitUseCase,
    required this.purchaseArmoryUpgradeUseCase,
    required this.claimStoreCurrencyPackUseCase,
    required this.economyRepository,
  }) : super(const TacticalDefenseState());

  Future<void> initializeGameSession() async {
    emit(state.copyWith(isLoading: true));
    final sectorsResult = await getCachedSectorsUseCase(const NoParams());
    final walletResult = await economyRepository.getCommanderWallet();

    final sectors = sectorsResult.data ?? [];
    final wallet = walletResult.data ?? state.wallet;
    final initialSector = sectors.isNotEmpty ? sectors.first : null;
    final maxHp = wallet.maxHqCommandHp;

    emit(
      state.copyWith(
        isLoading: false,
        availableSectors: sectors,
        activeSector: initialSector,
        wallet: wallet,
        hqCommandHp: maxHp,
        hqMaxHp: maxHp,
        breathingTimeRemaining: initialPrepSeconds,
        hostiles: const [],
        statusBannerMessage:
            '12s Prep Time: Build off-road Economy/Defenses, unlock Barracks/Factory for Units, and expand Square HQ Zones.',
      ),
    );
  }

  /// Progressive wave scaling: Wave 1 starts light (6 zombies) and gets harder over time
  List<ZombieHostileEntity> _spawnWaveHostiles(
    int wave,
    CitySectorEntity? sector,
  ) {
    if (sector == null || sector.corridors.isEmpty) return [];
    final safeWave = max(1, wave);
    final count =
        (6 + (safeWave - 1) * 3 + pow(safeWave - 1, 1.35) * 1.4).round();
    final hpMult = pow(1.22, safeWave - 1) + (safeWave - 1) * 0.18;
    final speedMult = min(2.35, 1.0 + (safeWave - 1) * 0.045);
    final damageMult = 1.0 + (safeWave - 1) * 0.16;
    final list = <ZombieHostileEntity>[];

    for (var i = 0; i < count; i++) {
      // Zombies spawn on the outer entry of real roads and strictly follow real road waypoints
      final corridorIdx = i % sector.corridors.length;
      final start = sector.corridors[corridorIdx].waypoints.first;
      final juggernautStride = max(3, 9 - (safeWave ~/ 3));
      final arch = (safeWave >= 3 && i > 0 && i % juggernautStride == 0)
          ? ZombieArchetype.juggernaut
          : (safeWave >= 2 && i % 4 == 0)
              ? ZombieArchetype.spitter
              : (i % 3 == 0 ? ZombieArchetype.runner : ZombieArchetype.walker);

      final baseHp = arch == ZombieArchetype.juggernaut
          ? 260.0
          : arch == ZombieArchetype.runner
              ? 48.0
              : arch == ZombieArchetype.spitter
                  ? 62.0
                  : 75.0;
      final hp = baseHp * hpMult;
      final baseSpeed = arch == ZombieArchetype.runner ? 0.088 : 0.048;
      final baseDamage = arch == ZombieArchetype.juggernaut ? 60.0 : 18.0;

      list.add(
        ZombieHostileEntity(
          id: 'z_${safeWave}_$i',
          archetype: arch,
          normX: start.x,
          normY: start.y,
          hp: hp,
          maxHp: hp,
          speedNormPerSec: baseSpeed * speedMult,
          damage: baseDamage * damageMult,
          scrapReward: arch == ZombieArchetype.juggernaut ? 42 : 15,
          corridorIndex: corridorIdx,
          waypointIndex: 1,
        ),
      );
    }
    return list;
  }

  void selectDockTab(DockTabCategory tab) {
    DeployableType defaultType = state.selectedDeployable;
    if (tab == DockTabCategory.defensive) {
      defaultType = DeployableType.rotaryTurret;
    } else if (tab == DockTabCategory.economy) {
      defaultType = DeployableType.scrapRefinery;
    } else if (tab == DockTabCategory.military) {
      defaultType = DeployableType.infantryBarracks;
    } else if (tab == DockTabCategory.units) {
      defaultType = DeployableType.mobileStrikeSquad;
    }
    emit(
      state.copyWith(
        activeDockTab: tab,
        selectedDeployable: defaultType,
      ),
    );
  }

  void selectDeployableBlueprint(DeployableType type) {
    emit(
      state.copyWith(
        activeDockTab: DefenseTowerEntity.tabForType(type),
        selectedDeployable: type,
      ),
    );
  }

  void toggleOfflineVectorMode() {
    emit(state.copyWith(isOfflineVectorMode: !state.isOfflineVectorMode));
  }

  /// Manual Unit Training in the [4. UNITS] Tab (Unlocked when Barracks / Vehicle Factory is built first).
  /// Newly trained unit spawns at the off-road producer building, exits onto the nearest real road,
  /// and moves strictly along real roads (`computeRoadNetworkPath`)!
  Future<void> trainUnit(TrainableUnitType unitType) async {
    final isTank = unitType == TrainableUnitType.heavyVehicle;
    final requiredType = isTank
        ? DeployableType.heavyVehicleFactory
        : DeployableType.infantryBarracks;
    final producer =
        state.towers.where((t) => t.type == requiredType).firstOrNull;

    if (producer == null) {
      emit(
        state.copyWith(
          statusBannerMessage: isTank
              ? 'Locked: Build Heavy Vehicle Factory [Military Tab] first!'
              : 'Locked: Build Infantry Barracks [Military Tab] first!',
        ),
      );
      return;
    }

    final cost = isTank ? 140 : 75;
    if (state.wallet.tacticalScrap < cost) {
      emit(
        state.copyWith(
          statusBannerMessage: 'Need $cost Scrap to train ${unitType.name}.',
        ),
      );
      return;
    }

    final corridors = state.activeSector?.corridors ?? const [];
    final roadExit = DeployTacticalUnitUseCase.projectPointToNearestRoad(
      producer.normX,
      producer.normY,
      corridors,
    );
    final roadPath = DeployTacticalUnitUseCase.computeRoadNetworkPath(
      producer.normX,
      producer.normY,
      roadExit.x,
      roadExit.y,
      corridors,
    );
    final finalRoadPt = roadPath.isNotEmpty
        ? roadPath.last
        : GeoPointEntity(x: roadExit.x, y: roadExit.y);

    final nextWallet = state.wallet.copyWith(
      tacticalScrap: state.wallet.tacticalScrap - cost,
    );
    await economyRepository.saveCommanderWallet(nextWallet);

    final newUnit = TroopSquadEntity(
      id: 'unit_${DateTime.now().microsecondsSinceEpoch}',
      unitType: unitType,
      normX: producer.normX,
      normY: producer.normY,
      rallyNormX: finalRoadPt.x,
      rallyNormY: finalRoadPt.y,
      roadPath: roadPath,
      roadPathIndex: 0,
      hp: isTank ? 460.0 : 185.0,
      maxHp: isTank ? 460.0 : 185.0,
      rangeMeters: isTank ? 160.0 : 125.0,
      damage: isTank ? 56.0 : 17.0,
      fireRatePerSec: isTank ? 1.2 : 2.6,
      speedNormPerSec: isTank ? 0.062 : 0.082,
    );

    emit(
      state.copyWith(
        wallet: nextWallet,
        squads: [...state.squads, newUnit],
        statusBannerMessage:
            '${isTank ? "Heavy Siege Tank" : "Rifle Soldier Squad"} exited building onto real road!',
      ),
    );
  }

  /// Commands all active Soldiers & Heavy Vehicles to move strictly along the real road network
  void commandArmyAlongRealRoads(double targetNormX, double targetNormY) {
    if (state.squads.isEmpty) {
      emit(
        state.copyWith(
          statusBannerMessage:
              'No Units Active — Build Barracks or Vehicle Factory and train units in [4. Units] Tab.',
        ),
      );
      return;
    }

    final corridors = state.activeSector?.corridors ?? const [];
    final snappedDest = DeployTacticalUnitUseCase.projectPointToNearestRoad(
      targetNormX,
      targetNormY,
      corridors,
    );

    final updatedSquads = state.squads.map((unit) {
      final path = DeployTacticalUnitUseCase.computeRoadNetworkPath(
        unit.normX,
        unit.normY,
        snappedDest.x,
        snappedDest.y,
        corridors,
      );
      final finalPt = path.isNotEmpty
          ? path.last
          : GeoPointEntity(x: snappedDest.x, y: snappedDest.y);
      return unit.copyWith(
        rallyNormX: finalPt.x,
        rallyNormY: finalPt.y,
        roadPath: path,
        roadPathIndex: 0,
      );
    }).toList();

    emit(
      state.copyWith(
        squads: updatedSquads,
        statusBannerMessage:
            'Ordered ${updatedSquads.length} units along real city roads to (${(snappedDest.x * 100).round()}%, ${(snappedDest.y * 100).round()}%).',
      ),
    );
  }

  Future<void> selectCitySector(CitySectorEntity sector) async {
    final maxHp = state.wallet.maxHqCommandHp;
    emit(
      state.copyWith(
        activeSector: sector,
        hqCommandHp: maxHp,
        hqMaxHp: maxHp,
        currentWave: 1,
        breathingTimeRemaining: initialPrepSeconds,
        towers: const [],
        squads: const [],
        hostiles: const [],
        statusBannerMessage:
            'Deployed Starting Square HQ Zone to ${sector.name} (Satellite Map).',
      ),
    );
  }

  Future<void> cacheActiveSectorForOfflinePlay() async {
    final active = state.activeSector;
    if (active == null) return;

    final res = await cacheCitySectorOfflineUseCase(active);
    res.fold(
      (failure) => emit(state.copyWith(statusBannerMessage: failure.message)),
      (cachedSector) {
        final updatedList = state.availableSectors
            .map((s) => s.id == cachedSector.id ? cachedSector : s)
            .toList();
        emit(
          state.copyWith(
            activeSector: cachedSector,
            availableSectors: updatedList,
            statusBannerMessage:
                'Cached ${cachedSector.name} (${cachedSector.tilePackageSizeKb} KB) for offline play.',
          ),
        );
      },
    );
  }

  Future<void> deployOnMapCoordinate({
    required double normX,
    required double normY,
    required double latitude,
    required double longitude,
  }) async {
    if (state.selectedDeployable == DeployableType.mobileStrikeSquad) {
      commandArmyAlongRealRoads(normX, normY);
      return;
    }

    final res = await deployTacticalUnitUseCase(
      DeployTacticalUnitParams(
        type: state.selectedDeployable,
        normX: normX,
        normY: normY,
        latitude: latitude,
        longitude: longitude,
        currentScrap: state.wallet.tacticalScrap,
        damageMultiplier: state.wallet.towerDamageMultiplier,
        existingTowers: state.towers,
        roadCorridors: state.activeSector?.corridors ?? const [],
        maxTowerSlots: 12 + (state.hqCount - 1) * 4,
      ),
    );

    res.fold(
      (failure) => emit(state.copyWith(statusBannerMessage: failure.message)),
      (deployment) async {
        final nextWallet = state.wallet.copyWith(
          tacticalScrap: deployment.remainingScrap,
        );
        await economyRepository.saveCommanderWallet(nextWallet);

        if (deployment.triggeredOrbitalStrike) {
          final remainingHostiles = state.hostiles
              .map((h) {
                final dist = sqrt(
                  pow(h.normX - normX, 2) + pow(h.normY - normY, 2),
                );
                return dist <= 0.18 ? h.copyWith(hp: h.hp - 220.0) : h;
              })
              .where((h) => h.hp > 0)
              .toList();

          emit(
            state.copyWith(
              wallet: nextWallet,
              hostiles: remainingHostiles,
              statusBannerMessage: 'Orbital Napalm Strike executed on target!',
            ),
          );
          return;
        }

        emit(
          state.copyWith(
            wallet: nextWallet,
            towers: deployment.deployedTower != null
                ? [...state.towers, deployment.deployedTower!]
                : state.towers,
          ),
        );
      },
    );
  }

  Future<void> purchaseUpgrade(String upgradeId) async {
    final res = await purchaseArmoryUpgradeUseCase(upgradeId);
    res.fold(
      (failure) => emit(state.copyWith(statusBannerMessage: failure.message)),
      (updatedWallet) => emit(
        state.copyWith(
          wallet: updatedWallet,
          hqMaxHp: updatedWallet.maxHqCommandHp,
          statusBannerMessage: 'Armory upgrade installed.',
        ),
      ),
    );
  }

  Future<void> claimCurrencyPack(CurrencyPackEntity pack) async {
    final res = await claimStoreCurrencyPackUseCase(pack);
    res.fold(
      (failure) => emit(state.copyWith(statusBannerMessage: failure.message)),
      (updatedWallet) => emit(
        state.copyWith(
          wallet: updatedWallet,
          statusBannerMessage:
              'Claimed ${pack.name}: +${pack.gemsReward} Bio-Gems & +${pack.scrapReward} Scrap.',
        ),
      ),
    );
  }

  void stepSimulationTick(double dtSeconds) {
    final sector = state.activeSector;
    if (sector == null || state.hqCommandHp <= 0) return;

    // 1. Advance Soldiers & Heavy Vehicles strictly along their real-road waypoints (`u.roadPath`)
    final updatedSquads = state.squads.map((u) {
      final path = u.roadPath;
      final idx = u.roadPathIndex;
      final wp = (path.isNotEmpty && idx < path.length)
          ? path[idx]
          : GeoPointEntity(x: u.rallyNormX, y: u.rallyNormY);
      final dx = wp.x - u.normX;
      final dy = wp.y - u.normY;
      final dist = sqrt(dx * dx + dy * dy);
      if (dist > 0.005) {
        final step = min(dist, u.speedNormPerSec * dtSeconds);
        return u.copyWith(
          normX: u.normX + (dx / dist) * step,
          normY: u.normY + (dy / dist) * step,
        );
      } else if (path.isNotEmpty && idx < path.length - 1) {
        return u.copyWith(roadPathIndex: idx + 1);
      }
      return u;
    }).toList();

    // 2. Handle Breathing Time before Wave 1 or between cleared waves
    if (state.hostiles.isEmpty) {
      final nextBreathing = max(0.0, state.breathingTimeRemaining - dtSeconds);
      if (nextBreathing > 0) {
        emit(
          state.copyWith(
            squads: updatedSquads,
            breathingTimeRemaining: nextBreathing,
          ),
        );
        return;
      }
      // Breathing time finished -> spawn wave on outer road entries
      final spawned = _spawnWaveHostiles(state.currentWave, sector);
      emit(
        state.copyWith(
          squads: updatedSquads,
          breathingTimeRemaining: 0.0,
          hostiles: spawned,
        ),
      );
      return;
    }

    var hp = state.hqCommandHp;
    var scrapEarned = 0;
    final nextHostiles = <ZombieHostileEntity>[];

    // 3. Advance Zombies strictly along real road corridors (`corridor.waypoints`)
    for (final z in state.hostiles) {
      final corridor =
          sector.corridors[z.corridorIndex % sector.corridors.length];
      final wp = corridor.waypoints[
          min(z.waypointIndex, corridor.waypoints.length - 1)];
      final dx = wp.x - z.normX;
      final dy = wp.y - z.normY;
      final dist = sqrt(dx * dx + dy * dy);

      final distToHq = sqrt(pow(0.5 - z.normX, 2) + pow(0.5 - z.normY, 2));
      if (distToHq <= 0.045) {
        hp = max(0, hp - z.damage.round());
        continue;
      }

      var nx = z.normX;
      var ny = z.normY;
      var nextWp = z.waypointIndex;

      if (dist < 0.015 && nextWp < corridor.waypoints.length - 1) {
        nextWp++;
      } else if (dist > 0.001) {
        nx += (dx / dist) * z.speedNormPerSec * dtSeconds;
        ny += (dy / dist) * z.speedNormPerSec * dtSeconds;
      }

      // Check HQ Point-Defense Auto-Cannon fire coverage at (0.5, 0.5)
      var nextHp = z.hp;
      if (distToHq <= (168.0 / 650.0)) {
        final hqDps = 24.0 * state.wallet.towerDamageMultiplier * 2.35;
        nextHp -= hqDps * dtSeconds;
      }

      // Check tower & fortress fire coverage
      for (final t in state.towers) {
        final dTower = sqrt(pow(t.normX - nx, 2) + pow(t.normY - ny, 2));
        if (dTower <= (t.rangeMeters / 650.0)) {
          nextHp -= t.damage * t.fireRatePerSec * dtSeconds;
        }
      }

      // Check Soldier & Heavy Vehicle fire coverage on road
      for (final u in updatedSquads) {
        final dUnit = sqrt(pow(u.normX - nx, 2) + pow(u.normY - ny, 2));
        if (dUnit <= (u.rangeMeters / 650.0)) {
          nextHp -= u.damage * u.fireRatePerSec * dtSeconds;
        }
      }

      if (nextHp <= 0) {
        scrapEarned += z.scrapReward;
      } else {
        nextHostiles.add(
          z.copyWith(normX: nx, normY: ny, hp: nextHp, waypointIndex: nextWp),
        );
      }
    }

    var nextWave = state.currentWave;
    var nextBreathing = 0.0;
    if (nextHostiles.isEmpty) {
      nextWave += 1;
      nextBreathing = interWaveBreathingSeconds;
      scrapEarned += 65 + state.currentWave * 15;
    }

    final updatedWallet = scrapEarned > 0
        ? state.wallet.copyWith(
            tacticalScrap: state.wallet.tacticalScrap + scrapEarned,
          )
        : state.wallet;

    emit(
      state.copyWith(
        hqCommandHp: hp,
        currentWave: nextWave,
        breathingTimeRemaining: nextBreathing,
        squads: updatedSquads,
        hostiles: nextHostiles,
        wallet: updatedWallet,
      ),
    );
  }
}
