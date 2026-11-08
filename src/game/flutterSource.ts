import pubspecYaml from '../../flutter_project/pubspec.yaml?raw';
import mainDart from '../../flutter_project/lib/main.dart?raw';
import injectionContainerDart from '../../flutter_project/lib/injection_container.dart?raw';
import failuresDart from '../../flutter_project/lib/core/error/failures.dart?raw';
import usecaseDart from '../../flutter_project/lib/core/usecases/usecase.dart?raw';
import citySectorEntityDart from '../../flutter_project/lib/domain/entities/city_sector_entity.dart?raw';
import defenseEntitiesDart from '../../flutter_project/lib/domain/entities/defense_entities.dart?raw';
import storeEntitiesDart from '../../flutter_project/lib/domain/entities/store_entities.dart?raw';
import mapSectorRepoDart from '../../flutter_project/lib/domain/repositories/map_sector_repository.dart?raw';
import economyRepoDart from '../../flutter_project/lib/domain/repositories/economy_repository.dart?raw';
import mapSectorUsecasesDart from '../../flutter_project/lib/domain/usecases/map_sector_usecases.dart?raw';
import tacticalDefenseUsecasesDart from '../../flutter_project/lib/domain/usecases/tactical_defense_usecases.dart?raw';
import citySectorModelDart from '../../flutter_project/lib/data/models/city_sector_model.dart?raw';
import localCacheDatasourceDart from '../../flutter_project/lib/data/datasources/local_offline_cache_datasource.dart?raw';
import mapSectorRepoImplDart from '../../flutter_project/lib/data/repositories/map_sector_repository_impl.dart?raw';
import economyRepoImplDart from '../../flutter_project/lib/data/repositories/economy_repository_impl.dart?raw';
import tacticalDefenseCubitDart from '../../flutter_project/lib/presentation/bloc/tactical_defense_cubit.dart?raw';
import tacticalOverlayPainterDart from '../../flutter_project/lib/presentation/widgets/tactical_overlay_painter.dart?raw';
import storeBottomSheetDart from '../../flutter_project/lib/presentation/widgets/store_bottom_sheet.dart?raw';
import tacticalDefensePageDart from '../../flutter_project/lib/presentation/pages/tactical_defense_page.dart?raw';

export interface FlutterArchFile {
  path: string;
  layer: 'Root & DI' | 'Core' | 'Domain' | 'Data' | 'Presentation';
  description: string;
  content: string;
}

export const FLUTTER_CLEAN_ARCH_FILES: FlutterArchFile[] = [
  {
    path: 'flutter_project/pubspec.yaml',
    layer: 'Root & DI',
    description: 'Flutter project manifest with flutter_map (OpenStreetMap), latlong2, flutter_bloc, get_it, equatable, and hive_flutter.',
    content: pubspecYaml,
  },
  {
    path: 'flutter_project/lib/main.dart',
    layer: 'Root & DI',
    description: 'Application entrypoint initializing GetIt DI container, Hive boxes, and root BlocProvider.',
    content: mainDart,
  },
  {
    path: 'flutter_project/lib/injection_container.dart',
    layer: 'Root & DI',
    description: 'Clean Architecture Dependency Injection wiring DataSources, Repositories, UseCases, and Cubit.',
    content: injectionContainerDart,
  },
  {
    path: 'flutter_project/lib/core/error/failures.dart',
    layer: 'Core',
    description: 'Typed Domain Failure hierarchy (CacheFailure, NetworkFailure, InsufficientFundsFailure).',
    content: failuresDart,
  },
  {
    path: 'flutter_project/lib/core/usecases/usecase.dart',
    layer: 'Core',
    description: 'Functional Result<T> monad and base UseCase<Type, Params> contract.',
    content: usecaseDart,
  },
  {
    path: 'flutter_project/lib/domain/entities/city_sector_entity.dart',
    layer: 'Domain',
    description: 'Immutable CitySectorEntity, CachedRoadCorridor, and GeoPointEntity value objects.',
    content: citySectorEntityDart,
  },
  {
    path: 'flutter_project/lib/domain/entities/defense_entities.dart',
    layer: 'Domain',
    description: 'Immutable DefenseTowerEntity, TroopSquadEntity, and ZombieHostileEntity models.',
    content: defenseEntitiesDart,
  },
  {
    path: 'flutter_project/lib/domain/entities/store_entities.dart',
    layer: 'Domain',
    description: 'DefenseUpgradeEntity, CurrencyPackEntity, and CommanderWalletEntity domain models.',
    content: storeEntitiesDart,
  },
  {
    path: 'flutter_project/lib/domain/repositories/map_sector_repository.dart',
    layer: 'Domain',
    description: 'Abstract repository contract for real-world map sectors and offline caching.',
    content: mapSectorRepoDart,
  },
  {
    path: 'flutter_project/lib/domain/repositories/economy_repository.dart',
    layer: 'Domain',
    description: 'Abstract repository contract for commander wallet, virtual currency packs, and upgrades.',
    content: economyRepoDart,
  },
  {
    path: 'flutter_project/lib/domain/usecases/map_sector_usecases.dart',
    layer: 'Domain',
    description: 'GetCachedSectorsUseCase, CacheCitySectorOfflineUseCase, and BuildCustomCoordinatesSectorUseCase.',
    content: mapSectorUsecasesDart,
  },
  {
    path: 'flutter_project/lib/domain/usecases/tactical_defense_usecases.dart',
    layer: 'Domain',
    description: 'DeployTacticalUnitUseCase, PurchaseArmoryUpgradeUseCase, and ClaimStoreCurrencyPackUseCase.',
    content: tacticalDefenseUsecasesDart,
  },
  {
    path: 'flutter_project/lib/data/models/city_sector_model.dart',
    layer: 'Data',
    description: 'Data Transfer Object extending CitySectorEntity with Hive Map serialization.',
    content: citySectorModelDart,
  },
  {
    path: 'flutter_project/lib/data/datasources/local_offline_cache_datasource.dart',
    layer: 'Data',
    description: 'Hive-backed offline cache data source storing sector road corridors and commander economy.',
    content: localCacheDatasourceDart,
  },
  {
    path: 'flutter_project/lib/data/repositories/map_sector_repository_impl.dart',
    layer: 'Data',
    description: 'Concrete implementation of MapSectorRepository backed by Hive local storage.',
    content: mapSectorRepoImplDart,
  },
  {
    path: 'flutter_project/lib/data/repositories/economy_repository_impl.dart',
    layer: 'Data',
    description: 'Concrete implementation of EconomyRepository handling currency packs and upgrade purchases.',
    content: economyRepoImplDart,
  },
  {
    path: 'flutter_project/lib/presentation/bloc/tactical_defense_cubit.dart',
    layer: 'Presentation',
    description: 'TacticalDefenseCubit & State orchestrating 60 FPS zombie wave ticks, tower fire, and offline mode.',
    content: tacticalDefenseCubitDart,
  },
  {
    path: 'flutter_project/lib/presentation/pages/tactical_defense_page.dart',
    layer: 'Presentation',
    description: 'Main Flutter screen combining FlutterMap (OpenStreetMap), CustomPaint tactical overlay, and deployment dock.',
    content: tacticalDefensePageDart,
  },
  {
    path: 'flutter_project/lib/presentation/widgets/tactical_overlay_painter.dart',
    layer: 'Presentation',
    description: 'CustomPainter rendering cached urban corridors, HQ bunker, tower range rings, squads, and zombies.',
    content: tacticalOverlayPainterDart,
  },
  {
    path: 'flutter_project/lib/presentation/widgets/store_bottom_sheet.dart',
    layer: 'Presentation',
    description: 'Modal bottom sheet for permanent defense upgrades and virtual currency supply packs.',
    content: storeBottomSheetDart,
  },
];
