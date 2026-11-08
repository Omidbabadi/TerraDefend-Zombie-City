import 'dart:math';
import 'package:equatable/equatable.dart';

class DefenseUpgradeEntity extends Equatable {
  final String id;
  final String name;
  final String description;
  final int level;
  final int maxLevel;
  final int baseCostGems;
  final int baseCostScrap;
  final double bonusPerLevel;
  final String unitLabel;

  const DefenseUpgradeEntity({
    required this.id,
    required this.name,
    required this.description,
    this.level = 1,
    this.maxLevel = 10,
    required this.baseCostGems,
    required this.baseCostScrap,
    required this.bonusPerLevel,
    required this.unitLabel,
  });

  bool get isMaxed => level >= maxLevel;

  int get nextCostGems => (baseCostGems * pow(1.35, level - 1)).round();
  int get nextCostScrap => (baseCostScrap * pow(1.35, level - 1)).round();

  DefenseUpgradeEntity copyWith({int? level}) {
    return DefenseUpgradeEntity(
      id: id,
      name: name,
      description: description,
      level: level ?? this.level,
      maxLevel: maxLevel,
      baseCostGems: baseCostGems,
      baseCostScrap: baseCostScrap,
      bonusPerLevel: bonusPerLevel,
      unitLabel: unitLabel,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        description,
        level,
        maxLevel,
        baseCostGems,
        baseCostScrap,
        bonusPerLevel,
        unitLabel,
      ];
}

class CurrencyPackEntity extends Equatable {
  final String id;
  final String name;
  final String subtitle;
  final int gemsReward;
  final int scrapReward;
  final String badgeText;

  const CurrencyPackEntity({
    required this.id,
    required this.name,
    required this.subtitle,
    required this.gemsReward,
    required this.scrapReward,
    required this.badgeText,
  });

  @override
  List<Object?> get props => [
        id,
        name,
        subtitle,
        gemsReward,
        scrapReward,
        badgeText,
      ];
}

class CommanderWalletEntity extends Equatable {
  final int tacticalScrap;
  final int bioCoreGems;
  final int bestScore;
  final List<DefenseUpgradeEntity> upgrades;

  const CommanderWalletEntity({
    required this.tacticalScrap,
    required this.bioCoreGems,
    required this.bestScore,
    required this.upgrades,
  });

  double get towerDamageMultiplier {
    final upg = upgrades.where((u) => u.id == 'turret_damage').firstOrNull;
    if (upg == null) return 1.0;
    return 1.0 + (upg.level - 1) * upg.bonusPerLevel;
  }

  int get maxHqCommandHp {
    final upg = upgrades.where((u) => u.id == 'base_fortification').firstOrNull;
    if (upg == null) return 1000;
    return 1000 + ((upg.level - 1) * upg.bonusPerLevel).round();
  }

  CommanderWalletEntity copyWith({
    int? tacticalScrap,
    int? bioCoreGems,
    int? bestScore,
    List<DefenseUpgradeEntity>? upgrades,
  }) {
    return CommanderWalletEntity(
      tacticalScrap: tacticalScrap ?? this.tacticalScrap,
      bioCoreGems: bioCoreGems ?? this.bioCoreGems,
      bestScore: bestScore ?? this.bestScore,
      upgrades: upgrades ?? this.upgrades,
    );
  }

  @override
  List<Object?> get props => [tacticalScrap, bioCoreGems, bestScore, upgrades];
}
