package com.sectorzero.citydefense.di

import android.content.Context
import com.sectorzero.citydefense.data.local.OfflineSectorDataSource
import com.sectorzero.citydefense.data.repository.EconomyRepositoryImpl
import com.sectorzero.citydefense.data.repository.MapSectorRepositoryImpl
import com.sectorzero.citydefense.domain.repository.EconomyRepository
import com.sectorzero.citydefense.domain.repository.MapSectorRepository
import com.sectorzero.citydefense.domain.usecase.RoadNetworkPathfinder
import com.sectorzero.citydefense.domain.usecase.WaveScalingEngine

class AppContainer(context: Context) {
    private val localDataSource = OfflineSectorDataSource(context)

    val mapSectorRepository: MapSectorRepository = MapSectorRepositoryImpl(localDataSource)
    val economyRepository: EconomyRepository = EconomyRepositoryImpl(localDataSource)

    val roadPathfinder = RoadNetworkPathfinder()
    val waveScalingEngine = WaveScalingEngine()
}
