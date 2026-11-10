import 'dart:math';
import '../../core/error/failures.dart';
import '../../core/usecases/usecase.dart';
import '../entities/city_sector_entity.dart';
import '../entities/defense_entities.dart';
import '../entities/store_entities.dart';
import '../repositories/economy_repository.dart';

class RoadProjectionResult {
  final double x;
  final double y;
  final int corridorIndex;
  final int segmentIndex;
  final double distance;

  const RoadProjectionResult({
    required this.x,
    required this.y,
    required this.corridorIndex,
    required this.segmentIndex,
    required this.distance,
  });
}

class DeployTacticalUnitParams {
  final DeployableType type;
  final double normX;
  final double normY;
  final double latitude;
  final double longitude;
  final int currentScrap;
  final double damageMultiplier;
  final List<DefenseTowerEntity> existingTowers;
  final List<CachedRoadCorridor> roadCorridors;
  final List<FortressZoneEntity> zones;
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
    this.zones = const [],
    this.maxTowerSlots = 12,
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

  /// Projects any map coordinate (e.g. off-road Infantry Barracks or Vehicle Factory)
  /// onto the nearest real road segment so newly trained units exit onto real roads.
  static RoadProjectionResult projectPointToNearestRoad(
    double px,
    double py,
    List<CachedRoadCorridor> corridors,
  ) {
    var bestX = px;
    var bestY = py;
    var bestCorridorIndex = 0;
    var bestSegmentIndex = 0;
    var bestDist = double.infinity;

    for (var rIdx = 0; rIdx < corridors.length; rIdx++) {
      final pts = corridors[rIdx].waypoints;
      for (var sIdx = 0; sIdx < pts.length - 1; sIdx++) {
        final x1 = pts[sIdx].x;
        final y1 = pts[sIdx].y;
        final x2 = pts[sIdx + 1].x;
        final y2 = pts[sIdx + 1].y;
        final dx = x2 - x1;
        final dy = y2 - y1;
        final lenSq = dx * dx + dy * dy;
        final t = lenSq == 0
            ? 0.0
            : max(0.0, min(1.0, ((px - x1) * dx + (py - y1) * dy) / lenSq));
        final projX = x1 + t * dx;
        final projY = y1 + t * dy;
        final d = sqrt(pow(px - projX, 2) + pow(py - projY, 2));
        if (d < bestDist) {
          bestDist = d;
          bestX = projX;
          bestY = projY;
          bestCorridorIndex = rIdx;
          bestSegmentIndex = sIdx;
        }
      }
    }

    return RoadProjectionResult(
      x: bestX,
      y: bestY,
      corridorIndex: bestCorridorIndex,
      segmentIndex: bestSegmentIndex,
      distance: bestDist.isFinite ? bestDist : 0.0,
    );
  }

  /// Computes a real-road-only waypoint path from `(startX, startY)` (e.g. an off-road building)
  /// onto the nearest real road and along real city road segments to the target road coordinate.
  static List<GeoPointEntity> computeRoadNetworkPath(
    double startX,
    double startY,
    double targetX,
    double targetY,
    List<CachedRoadCorridor> corridors,
  ) {
    if (corridors.isEmpty) {
      return [GeoPointEntity(x: targetX, y: targetY)];
    }

    final startProj = projectPointToNearestRoad(startX, startY, corridors);
    final endProj = projectPointToNearestRoad(targetX, targetY, corridors);
    final waypoints = <GeoPointEntity>[
      GeoPointEntity(x: startProj.x, y: startProj.y),
    ];

    if (startProj.corridorIndex == endProj.corridorIndex) {
      final pts = corridors[startProj.corridorIndex].waypoints;
      if (startProj.segmentIndex <= endProj.segmentIndex) {
        for (var i = startProj.segmentIndex + 1; i <= endProj.segmentIndex; i++) {
          waypoints.add(GeoPointEntity(x: pts[i].x, y: pts[i].y));
        }
      } else {
        for (var i = startProj.segmentIndex; i > endProj.segmentIndex; i--) {
          waypoints.add(GeoPointEntity(x: pts[i].x, y: pts[i].y));
        }
      }
      waypoints.add(GeoPointEntity(x: endProj.x, y: endProj.y));
      return waypoints;
    }

    // Traverse from start road into city hub (0.5, 0.5) and out along target road
    final startPts = corridors[startProj.corridorIndex].waypoints;
    for (var i = startProj.segmentIndex + 1; i < startPts.length; i++) {
      waypoints.add(GeoPointEntity(x: startPts[i].x, y: startPts[i].y));
    }
    waypoints.add(const GeoPointEntity(x: 0.5, y: 0.5));

    final endPts = corridors[endProj.corridorIndex].waypoints;
    for (var i = endPts.length - 2; i > endProj.segmentIndex; i--) {
      if (i >= 0 && i < endPts.length) {
        waypoints.add(GeoPointEntity(x: endPts[i].x, y: endPts[i].y));
      }
    }
    waypoints.add(GeoPointEntity(x: endProj.x, y: endProj.y));
    return waypoints;
  }

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

  /// Checks whether `(normX, normY)` is inside any Player-Controlled SQUARE HQ Zone
  /// (ONLY Primary HQ and Forward HQs grant Square Player Zones).
  bool _isInsideSquareHqPlayerZone(
    double normX,
    double normY,
    List<DefenseTowerEntity> towers,
  ) {
    // Primary HQ Square Zone at (0.5, 0.5) with half-width 0.28
    if (max((normX - 0.5).abs(), (normY - 0.5).abs()) <= 0.28) {
      return true;
    }
    for (final t in towers) {
      if (t.type == DeployableType.forwardHqBase) {
        if (max((normX - t.normX).abs(), (normY - t.normY).abs()) <= 0.24) {
          return true;
        }
      }
    }
    return false;
  }

  @override
  Future<Result<DeployTacticalUnitResult>> call(
    DeployTacticalUnitParams params,
  ) async {
    // Flat cost: placing new towers/buildings does NOT increase the price of the next one
    final dynamicCost = DefenseTowerEntity.baseCostForType(params.type);

    final isStaticBuilding =
        params.type != DeployableType.orbitalNapalmStrike &&
        params.type != DeployableType.mobileStrikeSquad;

    if (isStaticBuilding) {
      if (params.type != DeployableType.forwardHqBase &&
          params.existingTowers.length >= params.maxTowerSlots) {
        return Result.failure(
          InsufficientFundsFailure(
            'Power Grid Full (${params.existingTowers.length}/${params.maxTowerSlots} Buildings). Build a Forward HQ Base to expand Square City Zones & slots.',
          ),
        );
      }

      // 1. Must be inside a Player-Controlled SQUARE HQ Zone (or on frontier for Forward HQ)
      final inSquareHqZone = _isInsideSquareHqPlayerZone(
        params.normX,
        params.normY,
        params.existingTowers,
      );
      if (!inSquareHqZone && params.type != DeployableType.forwardHqBase) {
        return const Result.failure(
          InsufficientFundsFailure(
            'Zombie-Controlled City Area: Build a Forward HQ Base [Economy Tab] to capture this Square City Zone first.',
          ),
        );
      }

      // 2. Keep clear of Primary HQ bunker center
      final distHq = sqrt(
        pow(params.normX - 0.5, 2) + pow(params.normY - 0.5, 2),
      );
      if (distHq < 0.068) {
        return const Result.failure(
          InsufficientFundsFailure(
            'Placement Blocked: Too close to Primary HQ Command Bunker.',
          ),
        );
      }

      // 3. OFF-ROAD-ONLY BUILDING PLACEMENT: Buildings must be placed OUTSIDE of real roads!
      // Roads are strictly reserved for Units (which exit buildings onto roads) and Zombies.
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
                'Blocked: Real Road Asphalt (Place buildings outside of roads only; Units & Zombies use roads).',
              ),
            );
          }
        }
      }

      // 4. Minimum spacing between buildings
      for (final tower in params.existingTowers) {
        final dTower = sqrt(
          pow(params.normX - tower.normX, 2) +
              pow(params.normY - tower.normY, 2),
        );
        if (dTower < 0.056) {
          return const Result.failure(
            InsufficientFundsFailure(
              'Placement Blocked: Too close to an existing building.',
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

    // Building stats by type
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
    } else if (params.type == DeployableType.heavyFortress) {
      baseDamage = 44.0;
      baseRange = 185.0;
      fireRate = 1.95;
    } else if (params.type == DeployableType.forwardHqBase) {
      baseDamage = 26.0;
      baseRange = 160.0;
      fireRate = 2.2;
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
