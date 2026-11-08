import 'package:equatable/equatable.dart';

enum DeployableCategory { tower, troop, orbitalAbility }

enum DeployableType {
  rotaryTurret,
  railSniperNest,
  cryoEmpPylon,
  mobileStrikeSquad,
  orbitalNapalmStrike,
}

enum ZombieArchetype { walker, runner, spitter, juggernaut }

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

  static int baseCostForType(DeployableType type) {
    switch (type) {
      case DeployableType.rotaryTurret:
        return 100;
      case DeployableType.railSniperNest:
        return 165;
      case DeployableType.cryoEmpPylon:
        return 140;
      case DeployableType.mobileStrikeSquad:
        return 125;
      case DeployableType.orbitalNapalmStrike:
        return 200;
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
  final double normX;
  final double normY;
  final double rallyNormX;
  final double rallyNormY;
  final double hp;
  final double maxHp;
  final double rangeMeters;
  final double damage;
  final double fireRatePerSec;
  final double cooldownRemaining;

  const TroopSquadEntity({
    required this.id,
    required this.normX,
    required this.normY,
    required this.rallyNormX,
    required this.rallyNormY,
    this.hp = 160.0,
    this.maxHp = 160.0,
    this.rangeMeters = 130.0,
    this.damage = 15.0,
    this.fireRatePerSec = 2.8,
    this.cooldownRemaining = 0.0,
  });

  TroopSquadEntity copyWith({
    double? normX,
    double? normY,
    double? rallyNormX,
    double? rallyNormY,
    double? hp,
    double? cooldownRemaining,
  }) {
    return TroopSquadEntity(
      id: id,
      normX: normX ?? this.normX,
      normY: normY ?? this.normY,
      rallyNormX: rallyNormX ?? this.rallyNormX,
      rallyNormY: rallyNormY ?? this.rallyNormY,
      hp: hp ?? this.hp,
      maxHp: maxHp,
      rangeMeters: rangeMeters,
      damage: damage,
      fireRatePerSec: fireRatePerSec,
      cooldownRemaining: cooldownRemaining ?? this.cooldownRemaining,
    );
  }

  @override
  List<Object?> get props => [
        id,
        normX,
        normY,
        rallyNormX,
        rallyNormY,
        hp,
        maxHp,
        rangeMeters,
        damage,
        fireRatePerSec,
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
