import '../../core/error/failures.dart';
import '../../core/usecases/usecase.dart';
import '../../domain/entities/city_sector_entity.dart';
import '../../domain/repositories/map_sector_repository.dart';
import '../datasources/local_offline_cache_datasource.dart';
import '../models/city_sector_model.dart';

class MapSectorRepositoryImpl implements MapSectorRepository {
  final LocalOfflineCacheDataSource localDataSource;

  const MapSectorRepositoryImpl({required this.localDataSource});

  @override
  Future<Result<List<CitySectorEntity>>> getAvailableSectors() async {
    try {
      final sectors = await localDataSource.getCachedSectors();
      return Result.success(sectors);
    } catch (e) {
      return Result.failure(
        CacheFailure('Failed to read cached map sectors: $e'),
      );
    }
  }

  @override
  Future<Result<CitySectorEntity>> cacheSectorOffline(
    CitySectorEntity sector,
  ) async {
    try {
      final model = CitySectorModel.fromEntity(sector);
      final saved = await localDataSource.saveCachedSector(model);
      return Result.success(saved);
    } catch (e) {
      return Result.failure(
        CacheFailure('Failed to write offline map cache: $e'),
      );
    }
  }

  @override
  Future<Result<CitySectorEntity>> buildCustomSectorFromCoordinates({
    required String name,
    required String city,
    required double latitude,
    required double longitude,
  }) async {
    try {
      final customModel = await localDataSource.fetchAndBuildRealRoadsSector(
        name: name,
        city: city,
        latitude: latitude,
        longitude: longitude,
      );
      final saved = await localDataSource.saveCachedSector(customModel);
      return Result.success(saved);
    } catch (e) {
      return Result.failure(
        CacheFailure('Failed to trace real road sector: $e'),
      );
    }
  }
}
