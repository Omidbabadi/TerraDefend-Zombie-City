import 'package:equatable/equatable.dart';

class GeoPointEntity extends Equatable {
  final double x; // Normalized 0.0 .. 1.0 tactical coordinate
  final double y;
  final double? latitude; // Exact real-world road GPS latitude
  final double? longitude; // Exact real-world road GPS longitude

  const GeoPointEntity({
    required this.x,
    required this.y,
    this.latitude,
    this.longitude,
  });

  @override
  List<Object?> get props => [x, y, latitude, longitude];
}

class CachedRoadCorridor extends Equatable {
  final String id;
  final String name;
  final List<GeoPointEntity> waypoints;
  final double widthMeters;

  const CachedRoadCorridor({
    required this.id,
    required this.name,
    required this.waypoints,
    this.widthMeters = 26.0,
  });

  @override
  List<Object?> get props => [id, name, waypoints, widthMeters];
}

class CitySectorEntity extends Equatable {
  final String id;
  final String name;
  final String city;
  final double latitude;
  final double longitude;
  final double zoom;
  final int? cachedTimestampMs;
  final int tilePackageSizeKb;
  final String threatRating;
  final List<CachedRoadCorridor> corridors;

  const CitySectorEntity({
    required this.id,
    required this.name,
    required this.city,
    required this.latitude,
    required this.longitude,
    this.zoom = 16.0,
    this.cachedTimestampMs,
    required this.tilePackageSizeKb,
    required this.threatRating,
    required this.corridors,
  });

  bool get isOfflineCached => cachedTimestampMs != null;

  CitySectorEntity copyWith({
    int? cachedTimestampMs,
    List<CachedRoadCorridor>? corridors,
  }) {
    return CitySectorEntity(
      id: id,
      name: name,
      city: city,
      latitude: latitude,
      longitude: longitude,
      zoom: zoom,
      cachedTimestampMs: cachedTimestampMs ?? this.cachedTimestampMs,
      tilePackageSizeKb: tilePackageSizeKb,
      threatRating: threatRating,
      corridors: corridors ?? this.corridors,
    );
  }

  @override
  List<Object?> get props => [
        id,
        name,
        city,
        latitude,
        longitude,
        zoom,
        cachedTimestampMs,
        tilePackageSizeKb,
        threatRating,
        corridors,
      ];
}
