import '../../domain/entities/city_sector_entity.dart';

class CitySectorModel extends CitySectorEntity {
  const CitySectorModel({
    required super.id,
    required super.name,
    required super.city,
    required super.latitude,
    required super.longitude,
    super.zoom = 16.0,
    super.cachedTimestampMs,
    required super.tilePackageSizeKb,
    required super.threatRating,
    required super.corridors,
  });

  factory CitySectorModel.fromEntity(CitySectorEntity entity) {
    return CitySectorModel(
      id: entity.id,
      name: entity.name,
      city: entity.city,
      latitude: entity.latitude,
      longitude: entity.longitude,
      zoom: entity.zoom,
      cachedTimestampMs: entity.cachedTimestampMs,
      tilePackageSizeKb: entity.tilePackageSizeKb,
      threatRating: entity.threatRating,
      corridors: entity.corridors,
    );
  }

  factory CitySectorModel.fromMap(Map<dynamic, dynamic> map) {
    final rawCorridors = (map['corridors'] as List<dynamic>? ?? []);
    return CitySectorModel(
      id: map['id'] as String,
      name: map['name'] as String,
      city: map['city'] as String,
      latitude: (map['latitude'] as num).toDouble(),
      longitude: (map['longitude'] as num).toDouble(),
      zoom: (map['zoom'] as num?)?.toDouble() ?? 16.0,
      cachedTimestampMs: map['cachedTimestampMs'] as int?,
      tilePackageSizeKb: (map['tilePackageSizeKb'] as num).toInt(),
      threatRating: map['threatRating'] as String,
      corridors: rawCorridors.map((c) {
        final cMap = c as Map<dynamic, dynamic>;
        final pts = (cMap['waypoints'] as List<dynamic>? ?? []).map((p) {
          final pMap = p as Map<dynamic, dynamic>;
          return GeoPointEntity(
            x: (pMap['x'] as num).toDouble(),
            y: (pMap['y'] as num).toDouble(),
            latitude: (pMap['lat'] as num?)?.toDouble(),
            longitude: (pMap['lng'] as num?)?.toDouble(),
          );
        }).toList();
        return CachedRoadCorridor(
          id: cMap['id'] as String,
          name: cMap['name'] as String,
          waypoints: pts,
          widthMeters: (cMap['widthMeters'] as num?)?.toDouble() ?? 26.0,
        );
      }).toList(),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'id': id,
      'name': name,
      'city': city,
      'latitude': latitude,
      'longitude': longitude,
      'zoom': zoom,
      'cachedTimestampMs': cachedTimestampMs,
      'tilePackageSizeKb': tilePackageSizeKb,
      'threatRating': threatRating,
      'corridors': corridors
          .map(
            (c) => {
              'id': c.id,
              'name': c.name,
              'widthMeters': c.widthMeters,
              'waypoints': c.waypoints
                  .map(
                    (p) => {
                      'x': p.x,
                      'y': p.y,
                      if (p.latitude != null) 'lat': p.latitude,
                      if (p.longitude != null) 'lng': p.longitude,
                    },
                  )
                  .toList(),
            },
          )
          .toList(),
    };
  }
}
