import '../../core/error/failures.dart';
import '../../core/usecases/usecase.dart';
import '../../domain/entities/store_entities.dart';
import '../../domain/repositories/economy_repository.dart';
import '../datasources/local_offline_cache_datasource.dart';

class EconomyRepositoryImpl implements EconomyRepository {
  final LocalOfflineCacheDataSource localDataSource;

  const EconomyRepositoryImpl({required this.localDataSource});

  @override
  Future<Result<CommanderWalletEntity>> getCommanderWallet() async {
    try {
      final wallet = await localDataSource.getWallet();
      return Result.success(wallet);
    } catch (e) {
      return Result.failure(CacheFailure('Failed to load wallet: $e'));
    }
  }

  @override
  Future<Result<CommanderWalletEntity>> saveCommanderWallet(
    CommanderWalletEntity wallet,
  ) async {
    try {
      final saved = await localDataSource.saveWallet(wallet);
      return Result.success(saved);
    } catch (e) {
      return Result.failure(CacheFailure('Failed to persist wallet: $e'));
    }
  }

  @override
  Future<Result<CommanderWalletEntity>> claimCurrencyPack(
    CurrencyPackEntity pack,
  ) async {
    try {
      final wallet = await localDataSource.getWallet();
      final updated = wallet.copyWith(
        tacticalScrap: wallet.tacticalScrap + pack.scrapReward,
        bioCoreGems: wallet.bioCoreGems + pack.gemsReward,
      );
      final saved = await localDataSource.saveWallet(updated);
      return Result.success(saved);
    } catch (e) {
      return Result.failure(
        CacheFailure('Failed to claim store currency pack: $e'),
      );
    }
  }

  @override
  Future<Result<CommanderWalletEntity>> purchaseDefenseUpgrade(
    String upgradeId,
  ) async {
    try {
      final wallet = await localDataSource.getWallet();
      final index = wallet.upgrades.indexWhere((u) => u.id == upgradeId);
      if (index == -1) {
        return Result.failure(
          const CacheFailure('Upgrade blueprint not found.'),
        );
      }

      final target = wallet.upgrades[index];
      if (target.isMaxed) {
        return Result.failure(
          const InvalidDeploymentFailure('Upgrade already at maximum level.'),
        );
      }

      final reqGems = target.nextCostGems;
      final reqScrap = target.nextCostScrap;
      if (wallet.bioCoreGems < reqGems || wallet.tacticalScrap < reqScrap) {
        return Result.failure(
          InsufficientFundsFailure(
            'Requires $reqScrap Scrap & $reqGems Bio-Gems.',
          ),
        );
      }

      final nextUpgrades = List<DefenseUpgradeEntity>.from(wallet.upgrades);
      nextUpgrades[index] = target.copyWith(level: target.level + 1);

      final updatedWallet = wallet.copyWith(
        tacticalScrap: wallet.tacticalScrap - reqScrap,
        bioCoreGems: wallet.bioCoreGems - reqGems,
        upgrades: nextUpgrades,
      );

      final saved = await localDataSource.saveWallet(updatedWallet);
      return Result.success(saved);
    } catch (e) {
      return Result.failure(
        CacheFailure('Failed to purchase defense upgrade: $e'),
      );
    }
  }
}
