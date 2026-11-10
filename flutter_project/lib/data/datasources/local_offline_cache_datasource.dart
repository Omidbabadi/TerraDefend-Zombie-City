import 'dart:convert';
import 'dart:math';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:http/http.dart' as http;
import '../../domain/entities/city_sector_entity.dart';
import '../../domain/entities/store_entities.dart';
import '../models/city_sector_model.dart';

abstract class LocalOfflineCacheDataSource {
  Future<List<CitySectorModel>> getCachedSectors();
  Future<CitySectorModel> saveCachedSector(CitySectorModel sector);
  Future<CommanderWalletEntity> getWallet();
  Future<CommanderWalletEntity> saveWallet(CommanderWalletEntity wallet);
  Future<CitySectorModel> fetchAndBuildRealRoadsSector({
    required String name,
    required String city,
    required double latitude,
    required double longitude,
  });
}

class HiveOfflineCacheDataSourceImpl implements LocalOfflineCacheDataSource {
  static const String sectorBoxName = 'offline_map_sectors';
  static const String economyBoxName = 'commander_economy';

  final Box sectorBox;
  final Box economyBox;

  const HiveOfflineCacheDataSourceImpl({
    required this.sectorBox,
    required this.economyBox,
  });

  /// Projects a real-world GPS coordinate onto the [0..1] whole-city satellite viewport
  static GeoPointEntity projectLatLngToSector(
    double lat,
    double lng,
    double centerLat,
    double centerLng,
  ) {
    const halfSpanLat = 0.0052;
    final cosLat = max(0.2, cos(centerLat * pi / 180.0));
    final halfSpanLng = (halfSpanLat / cosLat) * 1.45;
    final rawX = 0.5 + (lng - centerLng) / (2 * halfSpanLng);
    final rawY = 0.5 - (lat - centerLat) / (2 * halfSpanLat);
    return GeoPointEntity(
      x: rawX.clamp(0.03, 0.97),
      y: rawY.clamp(0.03, 0.97),
      latitude: lat,
      longitude: lng,
    );
  }

  /// Decodes an OSRM / Google encoded polyline string into real-world (lat, lng) vertices
  static List<List<double>> decodeGoogleEncodedPolyline(String encoded) {
    final points = <List<double>>[];
    int index = 0;
    final len = encoded.length;
    int lat = 0;
    int lng = 0;

    while (index < len) {
      int b;
      int shift = 0;
      int result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < len);
      final dlat = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.codeUnitAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20 && index < len);
      final dlng = ((result & 1) != 0 ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      points.add([lat / 1E5, lng / 1E5]);
    }
    return points;
  }

  /// Whole-City Satellite Map Presets (Player starts in central Square HQ Zone and captures 100% of the city)
  static final List<CitySectorModel> _defaultPresetSectors = [
    CitySectorModel(
      id: 'manhattan_midtown',
      name: 'New York City (Full Satellite Map)',
      city: 'New York City, USA',
      latitude: 40.7580,
      longitude: -73.9855,
      zoom: 14.0,
      cachedTimestampMs: 1730980000000,
      tilePackageSizeKb: 6420,
      threatRating: 'WHOLE CITY SATELLITE · REAL NYC ARTERIAL ROAD NETWORK',
      corridors: [
        CachedRoadCorridor(
          id: 'nyc_nw',
          name: 'Broadway & Upper West Highway',
          waypoints: [
            projectLatLngToSector(40.7624, -73.9912, 40.7580, -73.9855),
            projectLatLngToSector(40.7610, -73.9885, 40.7580, -73.9855),
            projectLatLngToSector(40.7595, -73.9870, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
        CachedRoadCorridor(
          id: 'nyc_ne',
          name: '5th Ave & Madison Ave Arterial',
          waypoints: [
            projectLatLngToSector(40.7622, -73.9788, 40.7580, -73.9855),
            projectLatLngToSector(40.7604, -73.9812, 40.7580, -73.9855),
            projectLatLngToSector(40.7592, -73.9834, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
        CachedRoadCorridor(
          id: 'nyc_se',
          name: 'Park Ave & E 42nd St Corridor',
          waypoints: [
            projectLatLngToSector(40.7536, -73.9792, 40.7580, -73.9855),
            projectLatLngToSector(40.7554, -73.9815, 40.7580, -73.9855),
            projectLatLngToSector(40.7568, -73.9838, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
        CachedRoadCorridor(
          id: 'nyc_sw',
          name: '8th Ave & W 34th St Highway',
          waypoints: [
            projectLatLngToSector(40.7538, -73.9918, 40.7580, -73.9855),
            projectLatLngToSector(40.7555, -73.9895, 40.7580, -73.9855),
            projectLatLngToSector(40.7568, -73.9875, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
      ],
    ),
    CitySectorModel(
      id: 'shibuya_crossing',
      name: 'Tokyo Metropolis (Full Satellite Map)',
      city: 'Tokyo, Japan',
      latitude: 35.6595,
      longitude: 139.7004,
      zoom: 14.0,
      cachedTimestampMs: 1730980000000,
      tilePackageSizeKb: 6840,
      threatRating: 'WHOLE CITY SATELLITE · REAL TOKYO METROPOLITAN HIGHWAYS',
      corridors: [
        CachedRoadCorridor(
          id: 'tokyo_nw',
          name: 'Yoyogi & Inokashira-Dori Highway',
          waypoints: [
            projectLatLngToSector(35.6634, 139.6952, 35.6595, 139.7004),
            projectLatLngToSector(35.6615, 139.6975, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
          ],
        ),
        CachedRoadCorridor(
          id: 'tokyo_ne',
          name: 'Meiji-Dori & Harajuku Corridor',
          waypoints: [
            projectLatLngToSector(35.6632, 139.7058, 35.6595, 139.7004),
            projectLatLngToSector(35.6612, 139.7032, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
          ],
        ),
        CachedRoadCorridor(
          id: 'tokyo_se',
          name: 'Roppongi-Dori & Shibuya River Road',
          waypoints: [
            projectLatLngToSector(35.6556, 139.7058, 35.6595, 139.7004),
            projectLatLngToSector(35.6576, 139.7030, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
          ],
        ),
        CachedRoadCorridor(
          id: 'tokyo_sw',
          name: 'Tamagawa-Dori Route 246 Highway',
          waypoints: [
            projectLatLngToSector(35.6558, 139.6948, 35.6595, 139.7004),
            projectLatLngToSector(35.6578, 139.6976, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
          ],
        ),
      ],
    ),
    CitySectorModel(
      id: 'london_piccadilly',
      name: 'London City (Full Satellite Map)',
      city: 'London, United Kingdom',
      latitude: 51.5101,
      longitude: -0.1342,
      zoom: 14.0,
      cachedTimestampMs: 1730980000000,
      tilePackageSizeKb: 6150,
      threatRating: 'WHOLE CITY SATELLITE · REAL LONDON ARTERIAL ROADS',
      corridors: [
        CachedRoadCorridor(
          id: 'lon_nw',
          name: 'Regent St & Oxford Circus Artery',
          waypoints: [
            projectLatLngToSector(51.5142, -0.1408, 51.5101, -0.1342),
            projectLatLngToSector(51.5122, -0.1376, 51.5101, -0.1342),
            projectLatLngToSector(51.5101, -0.1342, 51.5101, -0.1342),
          ],
        ),
        CachedRoadCorridor(
          id: 'lon_ne',
          name: 'Shaftesbury Ave & Soho Road',
          waypoints: [
            projectLatLngToSector(51.5140, -0.1278, 51.5101, -0.1342),
            projectLatLngToSector(51.5120, -0.1310, 51.5101, -0.1342),
            projectLatLngToSector(51.5101, -0.1342, 51.5101, -0.1342),
          ],
        ),
        CachedRoadCorridor(
          id: 'lon_se',
          name: 'Haymarket & Trafalgar Highway',
          waypoints: [
            projectLatLngToSector(51.5062, -0.1282, 51.5101, -0.1342),
            projectLatLngToSector(51.5082, -0.1312, 51.5101, -0.1342),
            projectLatLngToSector(51.5101, -0.1342, 51.5101, -0.1342),
          ],
        ),
        CachedRoadCorridor(
          id: 'lon_sw',
          name: 'Piccadilly & Green Park Road',
          waypoints: [
            projectLatLngToSector(51.5064, -0.1412, 51.5101, -0.1342),
            projectLatLngToSector(51.5084, -0.1378, 51.5101, -0.1342),
            projectLatLngToSector(51.5101, -0.1342, 51.5101, -0.1342),
          ],
        ),
      ],
    ),
  ];

  static const List<DefenseUpgradeEntity> _defaultUpgrades = [
    DefenseUpgradeEntity(
      id: 'turret_damage',
      name: 'Tungsten Core Rounds',
      description: 'Increases all deployed tower ballistic & rail damage.',
      baseCostGems: 50,
      baseCostScrap: 150,
      bonusPerLevel: 0.15,
      unitLabel: '+15% Tower DMG',
    ),
    DefenseUpgradeEntity(
      id: 'troop_training',
      name: 'Exoskeleton Squad Rig',
      description: 'Boosts mobile strike squad vitality, range, and fire rate.',
      baseCostGems: 60,
      baseCostScrap: 180,
      bonusPerLevel: 0.18,
      unitLabel: '+18% Squad Power',
    ),
    DefenseUpgradeEntity(
      id: 'base_fortification',
      name: 'Titanium Command Bulkhead',
      description: 'Reinforces HQ command bunker structural integrity.',
      baseCostGems: 40,
      baseCostScrap: 120,
      bonusPerLevel: 250.0,
      unitLabel: '+250 Command HP',
    ),
    DefenseUpgradeEntity(
      id: 'salvage_scanner',
      name: 'Automated Drone Salvage',
      description: 'Increases Scrap harvested from every eliminated zombie.',
      baseCostGems: 75,
      baseCostScrap: 200,
      bonusPerLevel: 0.20,
      unitLabel: '+20% Scrap Yield',
    ),
  ];

  @override
  Future<List<CitySectorModel>> getCachedSectors() async {
    final storedList = sectorBox.get('sectors_list') as List<dynamic>?;
    if (storedList == null || storedList.isEmpty) {
      return _defaultPresetSectors;
    }
    return storedList
        .map((item) => CitySectorModel.fromMap(item as Map<dynamic, dynamic>))
        .toList();
  }

  @override
  Future<CitySectorModel> saveCachedSector(CitySectorModel sector) async {
    final current = await getCachedSectors();
    final updated = CitySectorModel.fromEntity(
      sector.copyWith(cachedTimestampMs: DateTime.now().millisecondsSinceEpoch),
    );
    final exists = current.any((s) => s.id == updated.id);
    final nextList = exists
        ? current.map((s) => s.id == updated.id ? updated : s).toList()
        : [updated, ...current];

    await sectorBox.put(
      'sectors_list',
      nextList.map((s) => s.toMap()).toList(),
    );
    return updated;
  }

  @override
  Future<CitySectorModel> fetchAndBuildRealRoadsSector({
    required String name,
    required String city,
    required double latitude,
    required double longitude,
  }) async {
    final corridors = <CachedRoadCorridor>[];

    // Query free OpenStreetMap OSRM router (`https://router.project-osrm.org`)
    // to trace real city roads from 4 outer quadrants into the starting Square HQ Zone
    final offsets = [
      {'id': 'nw', 'name': 'NW Real City Highway (OSM)', 'dLat': 0.0042, 'dLng': -0.0048},
      {'id': 'ne', 'name': 'NE Real City Highway (OSM)', 'dLat': 0.0038, 'dLng': 0.0052},
      {'id': 'se', 'name': 'SE Real City Highway (OSM)', 'dLat': -0.0042, 'dLng': 0.0045},
      {'id': 'sw', 'name': 'SW Real City Highway (OSM)', 'dLat': -0.0038, 'dLng': -0.0050},
    ];

    for (final off in offsets) {
      try {
        final origLat = latitude + (off['dLat'] as double);
        final origLng = longitude + (off['dLng'] as double);
        final uri = Uri.parse(
          'https://router.project-osrm.org/route/v1/foot/$origLng,$origLat;$longitude,$latitude?overview=full&geometries=polyline',
        );
        final response = await http.get(uri);

        if (response.statusCode == 200) {
          final data = jsonDecode(response.body) as Map<String, dynamic>;
          final routes = data['routes'] as List<dynamic>?;
          final encoded = routes?.firstOrNull?['geometry'] as String?;
          if (encoded != null && encoded.isNotEmpty) {
            final decodedPairs = decodeGoogleEncodedPolyline(encoded);
            final waypoints = decodedPairs
                .map(
                  (pair) => projectLatLngToSector(
                    pair[0],
                    pair[1],
                    latitude,
                    longitude,
                  ),
                )
                .toList();
            if (waypoints.length >= 2) {
              corridors.add(
                CachedRoadCorridor(
                  id: off['id'] as String,
                  name: off['name'] as String,
                  waypoints: waypoints,
                ),
              );
            }
          }
        }
      } catch (_) {
        // Fallback to deterministic street grid below if offline
      }
    }

    if (corridors.isEmpty) {
      corridors.addAll([
        CachedRoadCorridor(
          id: 'north_artery',
          name: 'Northern City Highway',
          waypoints: [
            projectLatLngToSector(
              latitude + 0.0044,
              longitude - 0.0038,
              latitude,
              longitude,
            ),
            projectLatLngToSector(
              latitude + 0.0022,
              longitude - 0.0038,
              latitude,
              longitude,
            ),
            projectLatLngToSector(
              latitude + 0.0022,
              longitude - 0.0012,
              latitude,
              longitude,
            ),
            projectLatLngToSector(latitude, longitude, latitude, longitude),
          ],
        ),
        CachedRoadCorridor(
          id: 'east_boulevard',
          name: 'Eastern City Highway',
          waypoints: [
            projectLatLngToSector(
              latitude + 0.0028,
              longitude + 0.0052,
              latitude,
              longitude,
            ),
            projectLatLngToSector(
              latitude + 0.0028,
              longitude + 0.0024,
              latitude,
              longitude,
            ),
            projectLatLngToSector(
              latitude + 0.0008,
              longitude + 0.0024,
              latitude,
              longitude,
            ),
            projectLatLngToSector(latitude, longitude, latitude, longitude),
          ],
        ),
      ]);
    }

    return CitySectorModel(
      id: 'sector_${(latitude * 1000).round()}_${(longitude * 1000).round()}',
      name: '$name (Full Satellite Map)',
      city: city,
      latitude: latitude,
      longitude: longitude,
      zoom: 14.0,
      cachedTimestampMs: DateTime.now().millisecondsSinceEpoch,
      tilePackageSizeKb: 6400,
      threatRating: 'WHOLE CITY SATELLITE · REAL OSRM ROAD NETWORK',
      corridors: corridors,
    );
  }

  @override
  Future<CommanderWalletEntity> getWallet() async {
    final scrap = economyBox.get('tacticalScrap', defaultValue: 420) as int;
    final gems = economyBox.get('bioCoreGems', defaultValue: 350) as int;
    final best = economyBox.get('bestScore', defaultValue: 0) as int;
    final rawLevels = economyBox.get('upgradeLevels') as Map<dynamic, dynamic>?;

    final upgrades = _defaultUpgrades.map((u) {
      final savedLevel = rawLevels?[u.id] as int? ?? u.level;
      return u.copyWith(level: savedLevel);
    }).toList();

    return CommanderWalletEntity(
      tacticalScrap: scrap,
      bioCoreGems: gems,
      bestScore: best,
      upgrades: upgrades,
    );
  }

  @override
  Future<CommanderWalletEntity> saveWallet(CommanderWalletEntity wallet) async {
    await economyBox.put('tacticalScrap', wallet.tacticalScrap);
    await economyBox.put('bioCoreGems', wallet.bioCoreGems);
    await economyBox.put('bestScore', wallet.bestScore);
    final levelMap = <String, int>{
      for (final u in wallet.upgrades) u.id: u.level,
    };
    await economyBox.put('upgradeLevels', levelMap);
    return wallet;
  }
}
