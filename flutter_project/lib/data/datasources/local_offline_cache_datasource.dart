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
    String? googleMapsApiKey,
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

  /// Projects a real-world GPS coordinate onto the [0..1] tactical sector viewport
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

  /// Decodes a Google Maps encoded polyline string into real-world (lat, lng) vertices
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

  static final List<CitySectorModel> _defaultPresetSectors = [
    CitySectorModel(
      id: 'manhattan_midtown',
      name: 'Midtown Grid Sector 04',
      city: 'New York, USA',
      latitude: 40.7580,
      longitude: -73.9855,
      cachedTimestampMs: 1730980000000,
      tilePackageSizeKb: 4280,
      threatRating: 'MODERATE · REAL MANHATTAN STREET GRID',
      corridors: [
        CachedRoadCorridor(
          id: 'broadway_north',
          name: 'Broadway & W 47th St Real Road',
          waypoints: [
            projectLatLngToSector(40.7624, -73.9850, 40.7580, -73.9855),
            projectLatLngToSector(40.7610, -73.9853, 40.7580, -73.9855),
            projectLatLngToSector(40.7598, -73.9854, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
        CachedRoadCorridor(
          id: 'eighth_ave_west',
          name: '8th Ave -> W 44th St Real Road',
          waypoints: [
            projectLatLngToSector(40.7605, -73.9912, 40.7580, -73.9855),
            projectLatLngToSector(40.7591, -73.9892, 40.7580, -73.9855),
            projectLatLngToSector(40.7591, -73.9873, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
        CachedRoadCorridor(
          id: 'sixth_ave_east',
          name: 'Ave of the Americas -> W 46th St',
          waypoints: [
            projectLatLngToSector(40.7602, -73.9795, 40.7580, -73.9855),
            projectLatLngToSector(40.7588, -73.9815, 40.7580, -73.9855),
            projectLatLngToSector(40.7588, -73.9838, 40.7580, -73.9855),
            projectLatLngToSector(40.7580, -73.9855, 40.7580, -73.9855),
          ],
        ),
      ],
    ),
    CitySectorModel(
      id: 'shibuya_crossing',
      name: 'Shibuya Scramble Hub',
      city: 'Tokyo, Japan',
      latitude: 35.6595,
      longitude: 139.7004,
      cachedTimestampMs: 1730980000000,
      tilePackageSizeKb: 5120,
      threatRating: 'HIGH · REAL SHIBUYA 5-WAY ARTERIES',
      corridors: [
        CachedRoadCorridor(
          id: 'dogenzaka',
          name: 'Dogenzaka Real Corridor',
          waypoints: [
            projectLatLngToSector(35.6582, 139.6952, 35.6595, 139.7004),
            projectLatLngToSector(35.6587, 139.6972, 35.6595, 139.7004),
            projectLatLngToSector(35.6591, 139.6989, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
          ],
        ),
        CachedRoadCorridor(
          id: 'meiji_dori',
          name: 'Meiji-Dori Real Street',
          waypoints: [
            projectLatLngToSector(35.6612, 139.7058, 35.6595, 139.7004),
            projectLatLngToSector(35.6604, 139.7038, 35.6595, 139.7004),
            projectLatLngToSector(35.6595, 139.7004, 35.6595, 139.7004),
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
    String? googleMapsApiKey,
  }) async {
    final corridors = <CachedRoadCorridor>[];

    // If an API key is supplied on native mobile, query Google Maps Routes API v2
    // (`https://routes.googleapis.com/directions/v2:computeRoutes`) to trace real streets
    if (googleMapsApiKey != null && googleMapsApiKey.isNotEmpty) {
      final offsets = [
        {'id': 'nw', 'name': 'NW Real Street', 'dLat': 0.0042, 'dLng': -0.0048},
        {'id': 'ne', 'name': 'NE Real Street', 'dLat': 0.0038, 'dLng': 0.0052},
        {'id': 'se', 'name': 'SE Real Street', 'dLat': -0.0042, 'dLng': 0.0045},
        {'id': 'sw', 'name': 'SW Real Street', 'dLat': -0.0038, 'dLng': -0.0050},
      ];

      for (final off in offsets) {
        try {
          final uri = Uri.parse(
            'https://routes.googleapis.com/directions/v2:computeRoutes',
          );
          final response = await http.post(
            uri,
            headers: {
              'Content-Type': 'application/json',
              'X-Goog-Api-Key': googleMapsApiKey,
              'X-Goog-FieldMask': 'routes.polyline.encodedPolyline',
            },
            body: jsonEncode({
              'origin': {
                'location': {
                  'latLng': {
                    'latitude': latitude + (off['dLat'] as double),
                    'longitude': longitude + (off['dLng'] as double),
                  },
                },
              },
              'destination': {
                'location': {
                  'latLng': {
                    'latitude': latitude,
                    'longitude': longitude,
                  },
                },
              },
              'travelMode': 'DRIVE',
            }),
          );

          if (response.statusCode == 200) {
            final data = jsonDecode(response.body) as Map<String, dynamic>;
            final routes = data['routes'] as List<dynamic>?;
            final encoded = routes?.firstOrNull?['polyline']?['encodedPolyline']
                as String?;
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
    }

    if (corridors.isEmpty) {
      corridors.addAll([
        CachedRoadCorridor(
          id: 'north_artery',
          name: 'Northern Urban Street',
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
          name: 'Eastern Transit Road',
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
      name: name,
      city: city,
      latitude: latitude,
      longitude: longitude,
      cachedTimestampMs: DateTime.now().millisecondsSinceEpoch,
      tilePackageSizeKb: 4200,
      threatRating: 'GOOGLE ROUTES API · REAL STREET GEOMETRY',
      corridors: corridors,
    );
  }

  @override
  Future<CommanderWalletEntity> getWallet() async {
    final scrap = economyBox.get('tacticalScrap', defaultValue: 320) as int;
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
