// Sector Zero Clean Architecture Presentation — OpenStreetMap (flutter_map) + CustomPaint
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
          width: 120,
          height: 36,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 3),
            decoration: BoxDecoration(
              color: const Color(0xFFF59E0B),
              borderRadius: BorderRadius.circular(4),
            ),
            child: const Center(
              child: Text(
                'HQ BUNKER',
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
          child: const Icon(
            Icons.shield,
            color: Color(0xFF38BDF8),
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
            color: const Color(0xCCEF4444),
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

        return Scaffold(
          body: LayoutBuilder(
            builder: (context, constraints) {
              return Stack(
                children: [
                  // 1. Free OpenStreetMap Layer (`flutter_map`) with Real OSRM Road Polylines
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
                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
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

                  // 2. Real-Time Tactical CustomPaint Overlay
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

                  // 3. Top Tactical HUD Bar
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
                              'HQ HP: ${state.hqCommandHp}/${state.hqMaxHp}  ·  WAVE ${state.currentWave}  ·  SCRAP: ${state.wallet.tacticalScrap}  ·  GEMS: ${state.wallet.bioCoreGems}',
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
                                icon: const Icon(Icons.download_for_offline),
                                label: Text(
                                  activeSector.isOfflineCached
                                      ? 'CACHED (${activeSector.tilePackageSizeKb} KB)'
                                      : 'CACHE OFFLINE',
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                onPressed: cubit.toggleOfflineVectorMode,
                                child: Text(
                                  state.isOfflineVectorMode
                                      ? 'Offline Vector: ON'
                                      : 'Live OpenStreetMap',
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

                  // 4. Bottom Unified Tactical Deployment Dock
                  Align(
                    alignment: Alignment.bottomCenter,
                    child: SafeArea(
                      child: Container(
                        margin: const EdgeInsets.all(12),
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xF0090D16),
                          borderRadius: BorderRadius.circular(14),
                        ),
                        child: SingleChildScrollView(
                          scrollDirection: Axis.horizontal,
                          child: Row(
                            children: DeployableType.values.map((type) {
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
                                  onSelected: (_) =>
                                      cubit.selectDeployableBlueprint(type),
                                ),
                              );
                            }).toList(),
                          ),
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
