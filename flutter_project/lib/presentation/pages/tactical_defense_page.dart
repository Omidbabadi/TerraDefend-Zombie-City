// Sector Zero Clean Architecture Presentation — Whole-City Satellite Map (flutter_map + Esri World Imagery) + CustomPaint
import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import '../../domain/entities/defense_entities.dart';
import '../bloc/tactical_defense_cubit.dart';
import '../widgets/store_bottom_sheet.dart';
import '../widgets/tactical_overlay_painter.dart';

class TacticalDefensePage extends StatefulWidget {
  const TacticalDefensePage({super.key});

  @override
  State<TacticalDefensePage> createState() => _TacticalDefensePageState();
}

class _TacticalDefensePageState extends State<TacticalDefensePage>
    with SingleTickerProviderStateMixin {
  final MapController _mapController = MapController();
  late final Ticker _simulationTicker;
  Duration _lastElapsed = Duration.zero;

  @override
  void initState() {
    super.initState();
    _simulationTicker = createTicker((elapsed) {
      final dt = (elapsed - _lastElapsed).inMilliseconds / 1000.0;
      _lastElapsed = elapsed;
      if (dt > 0 && dt <= 0.1) {
        context.read<TacticalDefenseCubit>().stepSimulationTick(dt);
      }
    })..start();
  }

  @override
  void dispose() {
    _simulationTicker.dispose();
    _mapController.dispose();
    super.dispose();
  }

  List<Marker> _buildMarkers(TacticalDefenseState state) {
    final markers = <Marker>[];
    final sector = state.activeSector;
    if (sector != null) {
      markers.add(
        Marker(
          point: LatLng(sector.latitude, sector.longitude),
          width: 140,
          height: 36,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Center(
              child: Text(
                'STARTING HQ ZONE',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF090D16),
                ),
              ),
            ),
          ),
        ),
      );
    }
    for (final tower in state.towers) {
      markers.add(
        Marker(
          point: LatLng(tower.latitude, tower.longitude),
          width: 28,
          height: 28,
          child: Icon(
            tower.type == DeployableType.forwardHqBase
                ? Icons.flag
                : tower.type == DeployableType.heavyFortress
                    ? Icons.fort
                    : Icons.shield,
            color: const Color(0xFF38BDF8),
            size: 20,
          ),
        ),
      );
    }
    return markers;
  }

  List<Polyline> _buildRealRoadPolylines(TacticalDefenseState state) {
    final polylines = <Polyline>[];
    final sector = state.activeSector;
    if (sector == null) return polylines;

    for (final corridor in sector.corridors) {
      final gpsPoints = corridor.waypoints
          .where((wp) => wp.latitude != null && wp.longitude != null)
          .map((wp) => LatLng(wp.latitude!, wp.longitude!))
          .toList();
      if (gpsPoints.length >= 2) {
        polylines.add(
          Polyline(
            points: gpsPoints,
            color: const Color(0xCCF59E0B),
            strokeWidth: 5.0,
          ),
        );
      }
    }
    return polylines;
  }

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TacticalDefenseCubit, TacticalDefenseState>(
      builder: (context, state) {
        if (state.isLoading || state.activeSector == null) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }

        final activeSector = state.activeSector!;
        final cubit = context.read<TacticalDefenseCubit>();
        final tabDeployables = DeployableType.values
            .where((t) =>
                t != DeployableType.mobileStrikeSquad &&
                DefenseTowerEntity.tabForType(t) == state.activeDockTab)
            .toList();

        return Scaffold(
          body: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  // 1. Whole-City Satellite Map Layer (`flutter_map` + Esri World Imagery + Hybrid Labels + Real OSRM Roads)
                  if (!state.isOfflineVectorMode)
                    FlutterMap(
                      mapController: _mapController,
                      options: MapOptions(
                        initialCenter: LatLng(
                          activeSector.latitude,
                          activeSector.longitude,
                        ),
                        initialZoom: activeSector.zoom,
                        onTap: (tapPosition, latLng) {
                          cubit.deployOnMapCoordinate(
                            normX: 0.55,
                            normY: 0.45,
                            latitude: latLng.latitude,
                            longitude: latLng.longitude,
                          );
                        },
                      ),
                      children: [
                        TileLayer(
                          urlTemplate:
                              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                          userAgentPackageName: 'com.sectorzero.citydefense',
                        ),
                        PolylineLayer(
                          polylines: _buildRealRoadPolylines(state),
                        ),
                        MarkerLayer(
                          markers: _buildMarkers(state),
                        ),
                      ],
                    ),

                  // 2. Real-Time Tactical CustomPaint Overlay (Square HQ Zones, Square Fortresses, Off-Road Buildings, Real-Road Units & Zombies)
                  Positioned.fill(
                    child: GestureDetector(
                      behavior: HitTestBehavior.translucent,
                      onTapUp: (details) {
                        final normX =
                            details.localPosition.dx / constraints.maxWidth;
                        final normY =
                            details.localPosition.dy / constraints.maxHeight;
                        cubit.deployOnMapCoordinate(
                          normX: normX,
                          normY: normY,
                          latitude:
                              activeSector.latitude + (0.5 - normY) * 0.004,
                          longitude:
                              activeSector.longitude + (normX - 0.5) * 0.004,
                        );
                      },
                      child: CustomPaint(
                        painter: TacticalOverlayPainter(
                          sector: activeSector,
                          towers: state.towers,
                          squads: state.squads,
                          hostiles: state.hostiles,
                          isOfflineVectorMode: state.isOfflineVectorMode,
                        ),
                      ),
                    ),
                  ),

                  // 3. Top Tactical HUD Bar (HQ HP, Wave / Breathing Time, Scrap, Bio-Gems, Whole-City Satellite Switcher)
                  SafeArea(
                    child: Padding(
                      padding: const EdgeInsets.all(12.0),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 14,
                              vertical: 10,
                            ),
                            decoration: BoxDecoration(
                              color: const Color(0xE6090D16),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              'HQ HP: ${state.hqCommandHp}/${state.hqMaxHp}  ·  W${state.currentWave} (${state.breathingTimeRemaining > 0 ? "PEACE ${state.breathingTimeRemaining.ceil()}s" : "${state.hostiles.length} ZOM"})  ·  HQs: ${state.hqCount}/5  ·  SCRAP: ${state.wallet.tacticalScrap}',
                              style: const TextStyle(
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ),
                          Row(
                            children: [
                              ElevatedButton.icon(
                                onPressed: cubit.cacheActiveSectorForOfflinePlay,
                                icon: const Icon(Icons.satellite_alt),
                                label: Text(
                                  activeSector.isOfflineCached
                                      ? 'SATELLITE CACHED (${activeSector.tilePackageSizeKb} KB)'
                                      : 'CACHE SATELLITE CITY',
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                onPressed: cubit.toggleOfflineVectorMode,
                                child: Text(
                                  state.isOfflineVectorMode
                                      ? 'Offline Vector: ON'
                                      : 'Live Satellite Map',
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                onPressed: () {
                                  showModalBottomSheet(
                                    context: context,
                                    backgroundColor: Colors.transparent,
                                    builder: (_) => BlocProvider.value(
                                      value: cubit,
                                      child: const StoreBottomSheet(),
                                    ),
                                  );
                                },
                                child: const Text('Armory & Store'),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),

                  // 4. Bottom Categorized Command Dock (1. DEFENSIVE · 2. ECONOMY & HQ ZONES · 3. MILITARY · 4. UNITS & ARMY)
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: SafeArea(
                      child: Container(
                        margin: const EdgeInsets.all(12),
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: const Color(0xF0090D16),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // Category Tab Row
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: Row(
                                children: [
                                  ChoiceChip(
                                    label: const Text('1. DEFENSIVE (4)'),
                                    selected: state.activeDockTab ==
                                        DockTabCategory.defensive,
                                    onSelected: (_) => cubit.selectDockTab(
                                        DockTabCategory.defensive),
                                  ),
                                  const SizedBox(width: 6),
                                  ChoiceChip(
                                    label:
                                        const Text('2. ECONOMY & HQ ZONES (2)'),
                                    selected: state.activeDockTab ==
                                        DockTabCategory.economy,
                                    onSelected: (_) => cubit.selectDockTab(
                                        DockTabCategory.economy),
                                  ),
                                  const SizedBox(width: 6),
                                  ChoiceChip(
                                    label:
                                        const Text('3. MILITARY BUILDINGS (3)'),
                                    selected: state.activeDockTab ==
                                        DockTabCategory.military,
                                    onSelected: (_) => cubit.selectDockTab(
                                        DockTabCategory.military),
                                  ),
                                  const SizedBox(width: 6),
                                  ChoiceChip(
                                    label: Text(
                                        '4. UNITS & ARMY (${state.squads.length})'),
                                    selected: state.activeDockTab ==
                                        DockTabCategory.units,
                                    onSelected: (_) =>
                                        cubit.selectDockTab(DockTabCategory.units),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                            // Active Tab Content Row
                            if (state.activeDockTab != DockTabCategory.units)
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: tabDeployables.map((type) {
                                    final isSelected =
                                        state.selectedDeployable == type;
                                    final cost =
                                        DefenseTowerEntity.baseCostForType(type);
                                    return Padding(
                                      padding: const EdgeInsets.symmetric(
                                        horizontal: 4.0,
                                      ),
                                      child: ChoiceChip(
                                        label: Text('${type.name} ($cost Scrap)'),
                                        selected: isSelected,
                                        onSelected: (_) => cubit
                                            .selectDeployableBlueprint(type),
                                      ),
                                    );
                                  }).toList(),
                                ),
                              )
                            else
                              SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: Row(
                                  children: [
                                    ElevatedButton(
                                      onPressed: state.hasInfantryBarracks
                                          ? () => cubit.trainUnit(
                                              TrainableUnitType.soldier)
                                          : null,
                                      child: Text(
                                        state.hasInfantryBarracks
                                            ? 'Train Rifle Soldier (75 Scrap · Exits onto Road)'
                                            : 'Train Rifle Soldier (LOCKED: Build Barracks)',
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton(
                                      onPressed: state.hasHeavyVehicleFactory
                                          ? () => cubit.trainUnit(
                                              TrainableUnitType.heavyVehicle)
                                          : null,
                                      child: Text(
                                        state.hasHeavyVehicleFactory
                                            ? 'Train Heavy Siege Tank (140 Scrap · Exits onto Road)'
                                            : 'Train Heavy Siege Tank (LOCKED: Build Factory)',
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    ChoiceChip(
                                      label: Text(
                                          '[M] Command Army on Roads (${state.squads.length})'),
                                      selected: state.selectedDeployable ==
                                          DeployableType.mobileStrikeSquad,
                                      onSelected: (_) =>
                                          cubit.selectDeployableBlueprint(
                                              DeployableType.mobileStrikeSquad),
                                    ),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ),
                ],
              );
            },
          ),
        );
      },
    );
  }
}
