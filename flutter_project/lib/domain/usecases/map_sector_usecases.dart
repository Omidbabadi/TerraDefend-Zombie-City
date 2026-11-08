import '../../core/usecases/usecase.dart';
import '../entities/city_sector_entity.dart';
import '../repositories/map_sector_repository.dart';

class GetCachedSectorsUseCase implements UseCase<List<CitySectorEntity>, NoParams> {
  final MapSectorRepository repository;

  const GetCachedSectorsUseCase(this.repository);

  @override
  Future<Result<List<CitySectorEntity>>> call(NoParams params) {
    return repository.getAvailableSectors();
  }
}

class CacheCitySectorOfflineUseCase
    implements UseCase<CitySectorEntity, CitySectorEntity> {
  final MapSectorRepository repository;

  const CacheCitySectorOfflineUseCase(this.repository);

  @override
  Future<Result<CitySectorEntity>> call(CitySectorEntity sector) {
    return repository.cacheSectorOffline(sector);
  }
}

class BuildCustomCoordinatesSectorParams {
  final String name;
  final String city;
  final double latitude;
  final double longitude;

  const BuildCustomCoordinatesSectorParams({
    required this.name,
    required this.city,
    required this.latitude,
    required this.longitude,
  });
}

class BuildCustomCoordinatesSectorUseCase
    implements UseCase<CitySectorEntity, BuildCustomCoordinatesSectorParams> {
  final MapSectorRepository repository;

  const BuildCustomCoordinatesSectorUseCase(this.repository);

  @override
  Future<Result<CitySectorEntity>> call(BuildCustomCoordinatesSectorParams params) {
    return repository.buildCustomSectorFromCoordinates(
      name: params.name,
      city: params.city,
      latitude: params.latitude,
      longitude: params.longitude,
    );
  }
}
