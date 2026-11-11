package com.sectorzero.citydefense.domain.repository

import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.CommanderWallet
import kotlinx.coroutines.flow.Flow

interface MapSectorRepository {
    fun observeCachedCitySectors(): Flow<List<CitySector>>
    suspend fun traceRealRoadsWithOsrm(
        cityName: String,
        countryOrRegion: String,
        centerLat: Double,
        centerLng: Double
    ): CitySector
    suspend fun cacheCitySectorOffline(sector: CitySector)
}

interface EconomyRepository {
    fun observeCommanderWallet(): Flow<CommanderWallet>
    suspend fun saveCommanderWallet(wallet: CommanderWallet)
}
