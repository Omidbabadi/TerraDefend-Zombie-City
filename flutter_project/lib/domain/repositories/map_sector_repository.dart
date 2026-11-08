import '../../core/usecases/usecase.dart';
import '../entities/city_sector_entity.dart';

abstract class MapSectorRepository {
  Future<Result<List<CitySectorEntity>>> getAvailableSectors();
  Future<Result<CitySectorEntity>> cacheSectorOffline(CitySectorEntity sector);
  Future<Result<CitySectorEntity>> buildCustomSectorFromCoordinates({
    required String name,
    required String city,
    required double latitude,
    required double longitude,
  });
}
