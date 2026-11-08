import 'package:get_it/get_it.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'data/datasources/local_offline_cache_datasource.dart';
import 'data/repositories/economy_repository_impl.dart';
import 'data/repositories/map_sector_repository_impl.dart';
import 'domain/repositories/economy_repository.dart';
import 'domain/repositories/map_sector_repository.dart';
import 'domain/usecases/map_sector_usecases.dart';
import 'domain/usecases/tactical_defense_usecases.dart';
import 'presentation/bloc/tactical_defense_cubit.dart';

final sl = GetIt.instance;

Future<void> initDependencies() async {
  // External Local Persistence (Hive Offline Map & Economy Boxes)
  await Hive.initFlutter();
  final sectorBox = await Hive.openBox(
    HiveOfflineCacheDataSourceImpl.sectorBoxName,
  );
  final economyBox = await Hive.openBox(
    HiveOfflineCacheDataSourceImpl.economyBoxName,
  );

  // Data Sources
  sl.registerLazySingleton<LocalOfflineCacheDataSource>(
    () => HiveOfflineCacheDataSourceImpl(
      sectorBox: sectorBox,
      economyBox: economyBox,
    ),
  );

  // Repositories
  sl.registerLazySingleton<MapSectorRepository>(
    () => MapSectorRepositoryImpl(localDataSource: sl()),
  );
  sl.registerLazySingleton<EconomyRepository>(
    () => EconomyRepositoryImpl(localDataSource: sl()),
  );

  // Domain Use Cases
  sl.registerLazySingleton(() => GetCachedSectorsUseCase(sl()));
  sl.registerLazySingleton(() => CacheCitySectorOfflineUseCase(sl()));
  sl.registerLazySingleton(() => BuildCustomCoordinatesSectorUseCase(sl()));
  sl.registerLazySingleton(() => const DeployTacticalUnitUseCase());
  sl.registerLazySingleton(() => PurchaseArmoryUpgradeUseCase(sl()));
  sl.registerLazySingleton(() => ClaimStoreCurrencyPackUseCase(sl()));

  // Presentation BLoC / Cubit
  sl.registerFactory(
    () => TacticalDefenseCubit(
      getCachedSectorsUseCase: sl(),
      cacheCitySectorOfflineUseCase: sl(),
      buildCustomCoordinatesSectorUseCase: sl(),
      deployTacticalUnitUseCase: sl(),
      purchaseArmoryUpgradeUseCase: sl(),
      claimStoreCurrencyPackUseCase: sl(),
      economyRepository: sl(),
    ),
  );
}
