// Native Android Studio (Kotlin + Jetpack Compose + OsmDroid Satellite + OSRM Real-Road) Source Bundle

import settingsGradle from '../../android_game/settings.gradle.kts?raw';
import rootBuildGradle from '../../android_game/build.gradle.kts?raw';
import appBuildGradle from '../../android_game/app/build.gradle.kts?raw';
import androidManifest from '../../android_game/app/src/main/AndroidManifest.xml?raw';
import sectorZeroAppKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/SectorZeroApp.kt?raw';
import mainActivityKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/MainActivity.kt?raw';
import appContainerKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/di/AppContainer.kt?raw';
import citySectorModelsKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/CitySectorModels.kt?raw';
import defenseEntitiesKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/DefenseEntities.kt?raw';
import economyModelsKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/EconomyModels.kt?raw';
import gameRepositoriesKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/repository/GameRepositories.kt?raw';
import roadNetworkPathfinderKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/RoadNetworkPathfinder.kt?raw';
import waveScalingEngineKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/WaveScalingEngine.kt?raw';
import offlineSectorDataSourceKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/data/local/OfflineSectorDataSource.kt?raw';
import gameRepositoriesImplKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/data/repository/GameRepositoriesImpl.kt?raw';
import androidGameViewModelKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/presentation/viewmodel/AndroidGameViewModel.kt?raw';
import satelliteMapComposableKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/SatelliteMapComposable.kt?raw';
import tacticalBattleCanvasKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/TacticalBattleCanvas.kt?raw';
import androidGameScreenKt from '../../android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/AndroidGameScreen.kt?raw';

export type AndroidArchitectureLayer =
  | 'Gradle & Manifest'
  | 'App & DI'
  | 'Domain'
  | 'Data'
  | 'Jetpack Compose UI';

export interface AndroidProjectFile {
  path: string;
  layer: AndroidArchitectureLayer;
  summary: string;
  content: string;
}

export const ANDROID_STUDIO_PROJECT_FILES: AndroidProjectFile[] = [
  {
    path: 'android_game/settings.gradle.kts',
    layer: 'Gradle & Manifest',
    summary: 'Gradle Kotlin DSL project configuration for Sector Zero Android Game',
    content: settingsGradle,
  },
  {
    path: 'android_game/build.gradle.kts',
    layer: 'Gradle & Manifest',
    summary: 'Root Android Gradle Plugin & Kotlin Compose compiler setup',
    content: rootBuildGradle,
  },
  {
    path: 'android_game/app/build.gradle.kts',
    layer: 'Gradle & Manifest',
    summary: 'App module config (Jetpack Compose, OsmDroid Satellite, Coroutines, DataStore)',
    content: appBuildGradle,
  },
  {
    path: 'android_game/app/src/main/AndroidManifest.xml',
    layer: 'Gradle & Manifest',
    summary: 'Hardware-accelerated Android Game manifest with GAME category, VIBRATE & INTERNET',
    content: androidManifest,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/SectorZeroApp.kt',
    layer: 'App & DI',
    summary: 'Android Application entry point initializing OsmDroid cache & DI container',
    content: sectorZeroAppKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/MainActivity.kt',
    layer: 'App & DI',
    summary: 'Immersive Sticky Fullscreen Android Game Activity hosting Jetpack Compose UI',
    content: mainActivityKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/di/AppContainer.kt',
    layer: 'App & DI',
    summary: 'Clean Architecture dependency injection container',
    content: appContainerKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/CitySectorModels.kt',
    layer: 'Domain',
    summary: 'Whole-city satellite coordinates, RealRoadCorridor, and SquareTerritoryZone models',
    content: citySectorModelsKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/DefenseEntities.kt',
    layer: 'Domain',
    summary: 'Android touch modes, 4 dock tabs, off-road buildings, and real-road unit entities',
    content: defenseEntitiesKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/model/EconomyModels.kt',
    layer: 'Domain',
    summary: 'Permanent upgrades, virtual supply crates, and CommanderWallet domain models',
    content: economyModelsKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/repository/GameRepositories.kt',
    layer: 'Domain',
    summary: 'MapSectorRepository & EconomyRepository Clean Architecture contracts',
    content: gameRepositoriesKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/RoadNetworkPathfinder.kt',
    layer: 'Domain',
    summary: 'Real-road unit projection, road network pathfinding, Square HQ zones & off-road checks',
    content: roadNetworkPathfinderKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/domain/usecase/WaveScalingEngine.kt',
    layer: 'Domain',
    summary: 'Progressive endless waves, 12s/16s breathing timers, and 360° outer road zombie spawns',
    content: waveScalingEngineKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/data/local/OfflineSectorDataSource.kt',
    layer: 'Data',
    summary: 'DataStore persistence, whole-city satellite presets, and OSRM real-road router',
    content: offlineSectorDataSourceKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/data/repository/GameRepositoriesImpl.kt',
    layer: 'Data',
    summary: 'Repository implementations bridging local DataStore cache & OSRM road network',
    content: gameRepositoriesImplKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/viewmodel/AndroidGameViewModel.kt',
    layer: 'Jetpack Compose UI',
    summary: '60 FPS simulation loop, Android touch modes, unit exit-to-road training & HQ cannon',
    content: androidGameViewModelKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/SatelliteMapComposable.kt',
    layer: 'Jetpack Compose UI',
    summary: 'OsmDroid MapView composable rendering Esri World Imagery Satellite tiles + road polylines',
    content: satelliteMapComposableKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/TacticalBattleCanvas.kt',
    layer: 'Jetpack Compose UI',
    summary: 'Hardware-accelerated Compose Canvas + tap/long-press gestures for buildings & road units',
    content: tacticalBattleCanvasKt,
  },
  {
    path: 'android_game/app/src/main/java/com/sectorzero/citydefense/presentation/ui/AndroidGameScreen.kt',
    layer: 'Jetpack Compose UI',
    summary: 'Material 3 Dark Tactical Android Game Screen, haptics, touch switcher & 4-tab dock',
    content: androidGameScreenKt,
  },
];
