package com.sectorzero.citydefense.domain.usecase

import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.ZombieArchetype
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt
import kotlin.math.sin

data class WaveScalingProfile(
    val waveNumber: Int,
    val hostileCount: Int,
    val hpMultiplier: Float,
    val speedMultiplier: Float,
    val damageMultiplier: Float,
    val spawnIntervalSec: Float,
    val waveClearScrapBonus: Int,
    val waveClearGemsBonus: Int
)

data class RoadSpawnOrigin(
    val x: Float,
    val y: Float,
    val roadIndex: Int
)

class WaveScalingEngine {
    companion object {
        const val INITIAL_PREP_BREATHING_SEC = 12f
        const val INTER_WAVE_BREATHING_SEC = 16f
    }

    /**
     * Starts light on Wave 1 (6 zombies) with generous breathing time between assaults,
     * scaling endlessly harder on every subsequent wave.
     */
    fun getWaveScaling(waveNumber: Int): WaveScalingProfile {
        val w = max(1, waveNumber)
        val hpMult = (1.22.pow((w - 1).toDouble()) + (w - 1) * 0.20).toFloat()
        val speedMult = min(2.25f, 0.92f + (w - 1) * 0.05f)
        val dmgMult = 1f + (w - 1) * 0.15f
        val hostileCount = (3 + w * 2 + floor(w.toDouble().pow(1.38))).roundToInt()
        val spawnInterval = max(0.22f, (2.1 * 0.88.pow((w - 1).toDouble())).toFloat())

        return WaveScalingProfile(
            waveNumber = w,
            hostileCount = hostileCount,
            hpMultiplier = hpMult,
            speedMultiplier = speedMult,
            damageMultiplier = dmgMult,
            spawnIntervalSec = spawnInterval,
            waveClearScrapBonus = 42 + w * 16,
            waveClearGemsBonus = 10 + w * 3
        )
    }

    fun buildWaveComposition(waveNumber: Int): List<ZombieArchetype> {
        val profile = getWaveScaling(waveNumber)
        val w = profile.waveNumber
        return List(profile.hostileCount) { idx ->
            when {
                w >= 4 && idx % 9 == 8 -> ZombieArchetype.JUGGERNAUT
                w >= 3 && idx % 5 == 4 -> ZombieArchetype.SPITTER
                w >= 2 && idx % 3 == 2 -> ZombieArchetype.RUNNER
                else -> ZombieArchetype.WALKER
            }
        }
    }

    /**
     * Spawns zombies strictly on the outer road entries of the city's real road network
     * across all 4 compass quadrants.
     */
    fun createOuterRoadZombieSpawn(spawnIndex: Int, sector: CitySector): RoadSpawnOrigin {
        if (sector.roads.isNotEmpty()) {
            val roadIndex = spawnIndex % sector.roads.size
            val road = sector.roads[roadIndex]
            if (road.waypoints.size >= 2) {
                val p0 = road.waypoints[0]
                val p1 = road.waypoints[1]
                val staggerT = ((spawnIndex / sector.roads.size) % 4) * 0.05f
                return RoadSpawnOrigin(
                    x = p0.x + (p1.x - p0.x) * staggerT,
                    y = p0.y + (p1.y - p0.y) * staggerT,
                    roadIndex = roadIndex
                )
            }
        }
        val angle = (spawnIndex % 8) * (Math.PI / 4.0)
        return RoadSpawnOrigin(
            x = (0.5 + cos(angle) * 0.44).toFloat(),
            y = (0.5 + sin(angle) * 0.42).toFloat(),
            roadIndex = 0
        )
    }
}
