package com.sectorzero.citydefense.data.repository

import com.sectorzero.citydefense.data.local.OfflineSectorDataSource
import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.CommanderWallet
import com.sectorzero.citydefense.domain.repository.EconomyRepository
import com.sectorzero.citydefense.domain.repository.MapSectorRepository
import kotlinx.coroutines.flow.Flow

class MapSectorRepositoryImpl(
    private val localDataSource: OfflineSectorDataSource
) : MapSectorRepository {

    override fun observeCachedCitySectors(): Flow<List<CitySector>> {
        return localDataSource.observeCachedSectors()
    }

    override suspend fun traceRealRoadsWithOsrm(
        cityName: String,
        countryOrRegion: String,
        centerLat: Double,
        centerLng: Double
    ): CitySector {
        val traced = localDataSource.fetchOsrmCitySector(
            cityName = cityName,
            countryOrRegion = countryOrRegion,
            centerLat = centerLat,
            centerLng = centerLng
        )
        localDataSource.upsertCachedSector(traced)
        return traced
    }

    override suspend fun cacheCitySectorOffline(sector: CitySector) {
        localDataSource.upsertCachedSector(sector)
    }
}

class EconomyRepositoryImpl(
    private val localDataSource: OfflineSectorDataSource
) : EconomyRepository {

    override fun observeCommanderWallet(): Flow<CommanderWallet> {
        return localDataSource.observeWallet()
    }

    override suspend fun saveCommanderWallet(wallet: CommanderWallet) {
        localDataSource.saveWallet(wallet)
    }
}
