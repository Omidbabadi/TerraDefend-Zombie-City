import 'dart:math';
import '../../core/error/failures.dart';
import '../../core/usecases/usecase.dart';
import '../entities/city_sector_entity.dart';
import '../entities/defense_entities.dart';
import '../entities/store_entities.dart';
import '../repositories/economy_repository.dart';

class DeployTacticalUnitParams {
  final DeployableType type;
  final double normX;
  final double normY;
  final double latitude;
  final double longitude;
  final int currentScrap;
  final double damageMultiplier;
  final List<DefenseTowerEntity> existingTowers;
  final List<RoadCorridorEntity> roadCorridors;
  final int maxTowerSlots;

  const DeployTacticalUnitParams({
    required this.type,
    required this.normX,
    required this.normY,
    required this.latitude,
    required this.longitude,
    required this.currentScrap,
    this.damageMultiplier = 1.0,
    this.existingTowers = const [],
    this.roadCorridors = const [],
    this.maxTowerSlots = 6,
  });
}

class DeployTacticalUnitResult {
  final int remainingScrap;
  final DefenseTowerEntity? deployedTower;
  final TroopSquadEntity? deployedSquad;
  final bool triggeredOrbitalStrike;

  const DeployTacticalUnitResult({
    required this.remainingScrap,
    this.deployedTower,
    this.deployedSquad,
    this.triggeredOrbitalStrike = false,
  });
}

class DeployTacticalUnitUseCase
    implements UseCase<DeployTacticalUnitResult, DeployTacticalUnitParams> {
  const DeployTacticalUnitUseCase();

  double _pointToSegmentDistance(
    double px,
    double py,
    double x1,
    double y1,
    double x2,
    double y2,
  ) {
    final dx = x2 - x1;
    final dy = y2 - y1;
    final lenSq = dx * dx + dy * dy;
    if (lenSq == 0) return sqrt(pow(px - x1, 2) + pow(py - y1, 2));
    final t = max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / lenSq));
    final projX = x1 + t * dx;
    final projY = y1 + t * dy;
    return sqrt(pow(px - projX, 2) + pow(py - projY, 2));
  }

  @override
  Future<Result<DeployTacticalUnitResult>> call(
    DeployTacticalUnitParams params,
  ) async {
    final baseCost = DefenseTowerEntity.baseCostForType(params.type);
    final sameTypeCount = params.existingTowers
        .where((t) => t.type == params.type)
        .length;
    final growth =
        params.type == DeployableType.orbitalNapalmStrike ? 1.15 : 1.38;
    final dynamicCost = (baseCost * pow(growth, sameTypeCount)).round();

    final isStaticTower =
        params.type != DeployableType.orbitalNapalmStrike &&
        params.type != DeployableType.mobileStrikeSquad;

    if (isStaticTower) {
      if (params.existingTowers.length >= params.maxTowerSlots) {
        return Result.failure(
          InsufficientFundsFailure(
            'Power Grid Full (${params.existingTowers.length}/${params.maxTowerSlots} Towers). Upgrade HQ Bulkhead or salvage a tower.',
          ),
        );
      }

      final distHq = sqrt(
        pow(params.normX - 0.5, 2) + pow(params.normY - 0.5, 2),
      );
      if (distHq < 0.068) {
        return const Result.failure(
          InsufficientFundsFailure(
            'Placement Blocked: Too close to HQ Command Bunker perimeter.',
          ),
        );
      }

      for (final corridor in params.roadCorridors) {
        for (var i = 0; i < corridor.waypoints.length - 1; i++) {
          final p1 = corridor.waypoints[i];
          final p2 = corridor.waypoints[i + 1];
          final dRoad = _pointToSegmentDistance(
            params.normX,
            params.normY,
            p1.x,
            p1.y,
            p2.x,
            p2.y,
          );
          if (dRoad < 0.031) {
            return const Result.failure(
              InsufficientFundsFailure(
                'Placement Blocked: Cannot construct static tower on street asphalt corridor.',
              ),
            );
          }
        }
      }

      for (final tower in params.existingTowers) {
        final dTower = sqrt(
          pow(params.normX - tower.normX, 2) +
              pow(params.normY - tower.normY, 2),
        );
        if (dTower < 0.062) {
          return const Result.failure(
            InsufficientFundsFailure(
              'Placement Blocked: Too close to an existing defense tower.',
            ),
          );
        }
      }
    }

    if (params.currentScrap < dynamicCost) {
      return Result.failure(
        InsufficientFundsFailure(
          'Need $dynamicCost Scrap to deploy ${params.type.name} (Available: ${params.currentScrap}).',
        ),
      );
    }

    final id = 'unit_${DateTime.now().microsecondsSinceEpoch}';
    final remaining = params.currentScrap - dynamicCost;

    if (params.type == DeployableType.orbitalNapalmStrike) {
      return Result.success(
        DeployTacticalUnitResult(
          remainingScrap: remaining,
          triggeredOrbitalStrike: true,
        ),
      );
    }

    if (params.type == DeployableType.mobileStrikeSquad) {
      return Result.success(
        DeployTacticalUnitResult(
          remainingScrap: remaining,
          deployedSquad: TroopSquadEntity(
            id: id,
            normX: 0.5,
            normY: 0.5,
            rallyNormX: params.normX,
            rallyNormY: params.normY,
          ),
        ),
      );
    }

    // Tower deployment
    double baseDamage = 15.0;
    double baseRange = 135.0;
    double fireRate = 3.1;

    if (params.type == DeployableType.railSniperNest) {
      baseDamage = 78.0;
      baseRange = 245.0;
      fireRate = 0.68;
    } else if (params.type == DeployableType.cryoEmpPylon) {
      baseDamage = 12.0;
      baseRange = 118.0;
      fireRate = 1.15;
    }

    return Result.success(
      DeployTacticalUnitResult(
        remainingScrap: remaining,
        deployedTower: DefenseTowerEntity(
          id: id,
          type: params.type,
          normX: params.normX,
          normY: params.normY,
          latitude: params.latitude,
          longitude: params.longitude,
          rangeMeters: baseRange,
          damage: (baseDamage * params.damageMultiplier).roundToDouble(),
          fireRatePerSec: fireRate,
        ),
      ),
    );
  }
}

class PurchaseArmoryUpgradeUseCase
    implements UseCase<CommanderWalletEntity, String> {
  final EconomyRepository repository;

  const PurchaseArmoryUpgradeUseCase(this.repository);

  @override
  Future<Result<CommanderWalletEntity>> call(String upgradeId) {
    return repository.purchaseDefenseUpgrade(upgradeId);
  }
}

class ClaimStoreCurrencyPackUseCase
    implements UseCase<CommanderWalletEntity, CurrencyPackEntity> {
  final EconomyRepository repository;

  const ClaimStoreCurrencyPackUseCase(this.repository);

  @override
  Future<Result<CommanderWalletEntity>> call(CurrencyPackEntity pack) {
    return repository.claimCurrencyPack(pack);
  }
}
