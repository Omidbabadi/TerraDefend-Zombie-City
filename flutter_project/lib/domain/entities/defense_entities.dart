import 'package:equatable/equatable.dart';
import 'city_sector_entity.dart';

enum DockTabCategory {
  defensive,
  economy,
  military,
  units,
}

enum TrainableUnitType {
  soldier,
  heavyVehicle,
}

enum DeployableCategory {
  tower,
  fortress,
  economy,
  barracks,
  vehicleFactory,
  forwardHq,
  orbitalAbility,
  unitCommand,
}

enum DeployableType {
  rotaryTurret,
  railSniperNest,
  cryoEmpPylon,
  heavyFortress,
  scrapRefinery,
  infantryBarracks,
  heavyVehicleFactory,
  forwardHqBase,
  mobileStrikeSquad,
  orbitalNapalmStrike,
}

enum ZombieArchetype { walker, runner, spitter, juggernaut }

class FortressZoneEntity extends Equatable {
  final String id;
  final String name;
  final double normX;
  final double normY;
  final double radius;
  final bool isHq;
  final bool isCaptured;
  final double captureProgress;

  const FortressZoneEntity({
    required this.id,
    required this.name,
    required this.normX,
    required this.normY,
    this.radius = 0.28,
    this.isHq = false,
    this.isCaptured = false,
    this.captureProgress = 0.0,
  });

  /// Square HQ / Fortress Zone check using Chebyshev L-infinity distance
  bool containsPointSquare(double px, double py) {
    final dx = (px - normX).abs();
    final dy = (py - normY).abs();
    return (dx > dy ? dx : dy) <= radius;
  }

  FortressZoneEntity copyWith({
    bool? isCaptured,
    double? captureProgress,
  }) {
    return FortressZoneEntity(
      id: id,
      name: name,
      normX: normX,
      normY: normY,
      radius: radius,
      isHq: isHq,
      isCaptured: isCaptured ?? this.isCaptured,
      captureProgress: captureProgress ?? this.captureProgress,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        normX,
        normY,
        radius,
        isHq,
        isCaptured,
        captureProgress,
      ];
}

class DefenseTowerEntity extends Equatable {
  final String id;
  final DeployableType type;
  final double normX;
  final double normY;
  final double latitude;
  final double longitude;
  final int level;
  final double rangeMeters;
  final double damage;
  final double fireRatePerSec;
  final double cooldownRemaining;
  final double headingRadians;

  const DefenseTowerEntity({
    required this.id,
    required this.type,
    required this.normX,
    required this.normY,
    required this.latitude,
    required this.longitude,
    this.level = 1,
    required this.rangeMeters,
    required this.damage,
    required this.fireRatePerSec,
    this.cooldownRemaining = 0.0,
    this.headingRadians = 0.0,
  });

  int get upgradeCostScrap => (baseCostForType(type) * 0.75 * level).round();

  static DockTabCategory tabForType(DeployableType type) {
    switch (type) {
      case DeployableType.rotaryTurret:
      case DeployableType.railSniperNest:
      case DeployableType.cryoEmpPylon:
      case DeployableType.heavyFortress:
        return DockTabCategory.defensive;
      case DeployableType.scrapRefinery:
      case DeployableType.forwardHqBase:
        return DockTabCategory.economy;
      case DeployableType.infantryBarracks:
      case DeployableType.heavyVehicleFactory:
      case DeployableType.orbitalNapalmStrike:
        return DockTabCategory.military;
      case DeployableType.mobileStrikeSquad:
        return DockTabCategory.units;
    }
  }

  static int baseCostForType(DeployableType type) {
    switch (type) {
      case DeployableType.rotaryTurret:
        return 100;
      case DeployableType.railSniperNest:
        return 160;
      case DeployableType.cryoEmpPylon:
        return 145;
      case DeployableType.heavyFortress:
        return 190;
      case DeployableType.scrapRefinery:
        return 120;
      case DeployableType.infantryBarracks:
        return 150;
      case DeployableType.heavyVehicleFactory:
        return 210;
      case DeployableType.forwardHqBase:
        return 260;
      case DeployableType.mobileStrikeSquad:
        return 85;
      case DeployableType.orbitalNapalmStrike:
        return 225;
    }
  }

  DefenseTowerEntity copyWith({
    int? level,
    double? rangeMeters,
    double? damage,
    double? fireRatePerSec,
    double? cooldownRemaining,
    double? headingRadians,
  }) {
    return DefenseTowerEntity(
      id: id,
      type: type,
      normX: normX,
      normY: normY,
      latitude: latitude,
      longitude: longitude,
      level: level ?? this.level,
      rangeMeters: rangeMeters ?? this.rangeMeters,
      damage: damage ?? this.damage,
      fireRatePerSec: fireRatePerSec ?? this.fireRatePerSec,
      cooldownRemaining: cooldownRemaining ?? this.cooldownRemaining,
      headingRadians: headingRadians ?? this.headingRadians,
    );
  }

  @override
  List<Object?> get props => [
        id,
        type,
        normX,
        normY,
        latitude,
        longitude,
        level,
        rangeMeters,
        damage,
        fireRatePerSec,
        cooldownRemaining,
        headingRadians,
      ];
}

class TroopSquadEntity extends Equatable {
  final String id;
  final TrainableUnitType unitType;
  final double normX;
  final double normY;
  final double rallyNormX;
  final double rallyNormY;
  final List<GeoPointEntity> roadPath;
  final int roadPathIndex;
  final double hp;
  final double maxHp;
  final double rangeMeters;
  final double damage;
  final double fireRatePerSec;
  final double speedNormPerSec;
  final double cooldownRemaining;

  const TroopSquadEntity({
    required this.id,
    this.unitType = TrainableUnitType.soldier,
    required this.normX,
    required this.normY,
    required this.rallyNormX,
    required this.rallyNormY,
    this.roadPath = const [],
    this.roadPathIndex = 0,
    this.hp = 185.0,
    this.maxHp = 185.0,
    this.rangeMeters = 125.0,
    this.damage = 17.0,
    this.fireRatePerSec = 2.6,
    this.speedNormPerSec = 0.082,
    this.cooldownRemaining = 0.0,
  });

  TroopSquadEntity copyWith({
    TrainableUnitType? unitType,
    double? normX,
    double? normY,
    double? rallyNormX,
    double? rallyNormY,
    List<GeoPointEntity>? roadPath,
    int? roadPathIndex,
    double? hp,
    double? cooldownRemaining,
  }) {
    return TroopSquadEntity(
      id: id,
      unitType: unitType ?? this.unitType,
      normX: normX ?? this.normX,
      normY: normY ?? this.normY,
      rallyNormX: rallyNormX ?? this.rallyNormX,
      rallyNormY: rallyNormY ?? this.rallyNormY,
      roadPath: roadPath ?? this.roadPath,
      roadPathIndex: roadPathIndex ?? this.roadPathIndex,
      hp: hp ?? this.hp,
      maxHp: maxHp,
      rangeMeters: rangeMeters,
      damage: damage,
      fireRatePerSec: fireRatePerSec,
      speedNormPerSec: speedNormPerSec,
      cooldownRemaining: cooldownRemaining ?? this.cooldownRemaining,
    );
  }

  @override
  List<Object?> get props => [
        id,
        unitType,
        normX,
        normY,
        rallyNormX,
        rallyNormY,
        roadPath,
        roadPathIndex,
        hp,
        maxHp,
        rangeMeters,
        damage,
        fireRatePerSec,
        speedNormPerSec,
        cooldownRemaining,
      ];
}

class ZombieHostileEntity extends Equatable {
  final String id;
  final ZombieArchetype archetype;
  final double normX;
  final double normY;
  final double hp;
  final double maxHp;
  final double speedNormPerSec;
  final double damage;
  final int scrapReward;
  final int corridorIndex;
  final int waypointIndex;
  final double slowTimerSec;

  const ZombieHostileEntity({
    required this.id,
    required this.archetype,
    required this.normX,
    required this.normY,
    required this.hp,
    required this.maxHp,
    required this.speedNormPerSec,
    required this.damage,
    required this.scrapReward,
    required this.corridorIndex,
    required this.waypointIndex,
    this.slowTimerSec = 0.0,
  });

  ZombieHostileEntity copyWith({
    double? normX,
    double? normY,
    double? hp,
    int? waypointIndex,
    double? slowTimerSec,
  }) {
    return ZombieHostileEntity(
      id: id,
      archetype: archetype,
      normX: normX ?? this.normX,
      normY: normY ?? this.normY,
      hp: hp ?? this.hp,
      maxHp: maxHp,
      speedNormPerSec: speedNormPerSec,
      damage: damage,
      scrapReward: scrapReward,
      corridorIndex: corridorIndex,
      waypointIndex: waypointIndex ?? this.waypointIndex,
      slowTimerSec: slowTimerSec ?? this.slowTimerSec,
    );
  }

  @override
  List<Object?> get props => [
        id,
        archetype,
        normX,
        normY,
        hp,
        maxHp,
        speedNormPerSec,
        damage,
        scrapReward,
        corridorIndex,
        waypointIndex,
        slowTimerSec,
      ];
}
