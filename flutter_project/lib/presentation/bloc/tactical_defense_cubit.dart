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
  final DeployableType selectedDeployable;
  final int hqCommandHp;
  final int hqMaxHp;
  final int currentWave;
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
      tacticalScrap: 320,
      bioCoreGems: 350,
      bestScore: 0,
      upgrades: [],
    ),
    this.selectedDeployable = DeployableType.rotaryTurret,
    this.hqCommandHp = 1000,
    this.hqMaxHp = 1000,
    this.currentWave = 1,
    this.towers = const [],
    this.squads = const [],
    this.hostiles = const [],
    this.statusBannerMessage,
  });

  TacticalDefenseState copyWith({
    bool? isLoading,
    bool? isOfflineVectorMode,
    List<CitySectorEntity>? availableSectors,
    CitySectorEntity? activeSector,
    CommanderWalletEntity? wallet,
    DeployableType? selectedDeployable,
    int? hqCommandHp,
    int? hqMaxHp,
    int? currentWave,
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
      selectedDeployable: selectedDeployable ?? this.selectedDeployable,
      hqCommandHp: hqCommandHp ?? this.hqCommandHp,
      hqMaxHp: hqMaxHp ?? this.hqMaxHp,
      currentWave: currentWave ?? this.currentWave,
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
        selectedDeployable,
        hqCommandHp,
        hqMaxHp,
        currentWave,
        towers,
        squads,
        hostiles,
        statusBannerMessage,
      ];
}

class TacticalDefenseCubit extends Cubit<TacticalDefenseState> {
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
        hostiles: _spawnWaveHostiles(1, initialSector),
      ),
    );
  }

  List<ZombieHostileEntity> _spawnWaveHostiles(
    int wave,
    CitySectorEntity? sector,
  ) {
    if (sector == null || sector.corridors.isEmpty) return [];
    final safeWave = max(1, wave);
    final count = (10 + (safeWave - 1) * 4 + pow(safeWave - 1, 1.35)).round();
    final hpMult = pow(1.22, safeWave - 1) + (safeWave - 1) * 0.18;
    final speedMult = min(2.35, 1.0 + (safeWave - 1) * 0.045);
    final damageMult = 1.0 + (safeWave - 1) * 0.16;
    final list = <ZombieHostileEntity>[];

    for (var i = 0; i < count; i++) {
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
          scrapReward: arch == ZombieArchetype.juggernaut ? 70 : 24,
          corridorIndex: corridorIdx,
          waypointIndex: 1,
        ),
      );
    }
    return list;
  }

  void selectDeployableBlueprint(DeployableType type) {
    emit(state.copyWith(selectedDeployable: type));
  }

  void toggleOfflineVectorMode() {
    emit(state.copyWith(isOfflineVectorMode: !state.isOfflineVectorMode));
  }

  Future<void> selectCitySector(CitySectorEntity sector) async {
    final maxHp = state.wallet.maxHqCommandHp;
    emit(
      state.copyWith(
        activeSector: sector,
        hqCommandHp: maxHp,
        hqMaxHp: maxHp,
        currentWave: 1,
        towers: const [],
        squads: const [],
        hostiles: _spawnWaveHostiles(1, sector),
        statusBannerMessage: 'Deployed HQ Command Base to ${sector.name}.',
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
        maxTowerSlots: 6,
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
          // Damage all hostiles in radius around strike target
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
            squads: deployment.deployedSquad != null
                ? [...state.squads, deployment.deployedSquad!]
                : state.squads,
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

    var hp = state.hqCommandHp;
    var scrapEarned = 0;
    final nextHostiles = <ZombieHostileEntity>[];

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

      if (dist < 0.02 && nextWp < corridor.waypoints.length - 1) {
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

      // Check tower fire coverage
      for (final t in state.towers) {
        final dTower = sqrt(pow(t.normX - nx, 2) + pow(t.normY - ny, 2));
        if (dTower <= (t.rangeMeters / 650.0)) {
          nextHp -= t.damage * t.fireRatePerSec * dtSeconds;
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
    var finalHostiles = nextHostiles;
    if (finalHostiles.isEmpty) {
      nextWave += 1;
      finalHostiles = _spawnWaveHostiles(nextWave, sector);
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
        hostiles: finalHostiles,
        wallet: updatedWallet,
      ),
    );
  }
}
