import '../../core/usecases/usecase.dart';
import '../entities/store_entities.dart';

abstract class EconomyRepository {
  Future<Result<CommanderWalletEntity>> getCommanderWallet();
  Future<Result<CommanderWalletEntity>> saveCommanderWallet(
    CommanderWalletEntity wallet,
  );
  Future<Result<CommanderWalletEntity>> claimCurrencyPack(
    CurrencyPackEntity pack,
  );
  Future<Result<CommanderWalletEntity>> purchaseDefenseUpgrade(
    String upgradeId,
  );
}
