package com.sectorzero.citydefense.data.local

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.intPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.CommanderWallet
import com.sectorzero.citydefense.domain.model.GeoPoint
import com.sectorzero.citydefense.domain.model.RealRoadCorridor
import com.sectorzero.citydefense.domain.model.defaultDefenseUpgrades
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max

private val Context.commanderDataStore by preferencesDataStore(name = "sector_zero_android_store")

class OfflineSectorDataSource(private val context: Context) {

    private val gemsKey = intPreferencesKey("commander_gems")
    private val bestScoreKey = intPreferencesKey("commander_best_score")
    private val bestWaveKey = intPreferencesKey("commander_best_wave")

    private val cachedSectorsState = MutableStateFlow(buildPresetSatelliteCities())

    fun observeCachedSectors(): Flow<List<CitySector>> = cachedSectorsState.asStateFlow()

    suspend fun upsertCachedSector(sector: CitySector) {
        val current = cachedSectorsState.value.toMutableList()
        val idx = current.indexOfFirst { it.id == sector.id }
        val stamped = sector.copy(cachedTimestampMs = System.currentTimeMillis())
        if (idx >= 0) {
            current[idx] = stamped
        } else {
            current.add(0, stamped)
        }
        cachedSectorsState.value = current
    }

    fun observeWallet(): Flow<CommanderWallet> {
        return context.commanderDataStore.data.map { prefs ->
            val defaultUpgrades = defaultDefenseUpgrades().map { upg ->
                val lvl = prefs[intPreferencesKey("upg_${upg.id}")] ?: 1
                upg.copy(level = lvl)
            }
            CommanderWallet(
                gems = prefs[gemsKey] ?: 250,
                bestScore = prefs[bestScoreKey] ?: 0,
                bestWave = prefs[bestWaveKey] ?: 1,
                upgrades = defaultUpgrades
            )
        }
    }

    suspend fun saveWallet(wallet: CommanderWallet) {
        context.commanderDataStore.edit { prefs ->
            prefs[gemsKey] = wallet.gems
            prefs[bestScoreKey] = wallet.bestScore
            prefs[bestWaveKey] = wallet.bestWave
            wallet.upgrades.forEach { upg ->
                prefs[intPreferencesKey("upg_${upg.id}")] = upg.level
            }
        }
    }

    /**
     * Queries the free OpenStreetMap OSRM router for real street geometry converging on the city HQ.
     */
    suspend fun fetchOsrmCitySector(
        cityName: String,
        countryOrRegion: String,
        centerLat: Double,
        centerLng: Double
    ): CitySector = withContext(Dispatchers.IO) {
        val halfSpanLat = 0.0052
        val cosLat = max(0.2, cos(Math.toRadians(centerLat)))
        val halfSpanLng = (halfSpanLat / cosLat) * 1.35

        val origins = listOf(
            Triple("road_nw", "NW Arterial Highway", Pair(centerLat + halfSpanLat, centerLng - halfSpanLng * 0.65)),
            Triple("road_ne", "NE Arterial Highway", Pair(centerLat + halfSpanLat * 0.75, centerLng + halfSpanLng)),
            Triple("road_se", "SE Arterial Highway", Pair(centerLat - halfSpanLat, centerLng + halfSpanLng * 0.60)),
            Triple("road_sw", "SW Arterial Highway", Pair(centerLat - halfSpanLat * 0.75, centerLng - halfSpanLng))
        )

        val tracedRoads = origins.map { (id, label, origin) ->
            val coords = runCatching {
                val urlStr =
                    "https://router.project-osrm.org/route/v1/driving/${origin.second},${origin.first};$centerLng,$centerLat?overview=full&geometries=geojson"
                val conn = (URL(urlStr).openConnection() as HttpURLConnection).apply {
                    connectTimeout = 3500
                    readTimeout = 3500
                    requestMethod = "GET"
                }
                val body = conn.inputStream.bufferedReader().use { it.readText() }
                val json = JSONObject(body)
                val coordArr = json.getJSONArray("routes")
                    .getJSONObject(0)
                    .getJSONObject("geometry")
                    .getJSONArray("coordinates")
                buildList {
                    for (i in 0 until coordArr.length()) {
                        val pt = coordArr.getJSONArray(i)
                        add(Pair(pt.getDouble(1), pt.getDouble(0)))
                    }
                }
            }.getOrElse {
                listOf(
                    origin,
                    Pair((origin.first + centerLat) * 0.5, (origin.second + centerLng) * 0.5),
                    Pair(centerLat, centerLng)
                )
            }
            projectGpsPolylineToCorridor(id, label, coords, centerLat, centerLng)
        }

        CitySector(
            id = "city_${cityName.lowercase().replace(Regex("[^a-z0-9]+"), "_")}",
            name = "$cityName (Full Satellite Map)",
            city = countryOrRegion,
            centerLat = centerLat,
            centerLng = centerLng,
            zoom = 15.0,
            cachedTimestampMs = System.currentTimeMillis(),
            tilePackageSizeKb = 5240,
            threatRating = "SATELLITE CITY MAP · REAL OSRM ROAD NETWORK",
            roads = tracedRoads
        )
    }

    private fun projectGpsPolylineToCorridor(
        id: String,
        name: String,
        gpsPoints: List<Pair<Double, Double>>,
        centerLat: Double,
        centerLng: Double
    ): RealRoadCorridor {
        val halfSpanLat = 0.0052
        val cosLat = max(0.2, cos(Math.toRadians(centerLat)))
        val halfSpanLng = (halfSpanLat / cosLat) * 1.45
        val waypoints = mutableListOf<GeoPoint>()

        for ((lat, lng) in gpsPoints) {
            val nx = (0.5 + (lng - centerLng) / (2.0 * halfSpanLng)).coerceIn(0.03, 0.97).toFloat()
            val ny = (0.5 - (lat - centerLat) / (2.0 * halfSpanLat)).coerceIn(0.03, 0.97).toFloat()
            val prev = waypoints.lastOrNull()
            if (prev == null || hypot(nx - prev.x, ny - prev.y) >= 0.018f) {
                waypoints.add(GeoPoint(nx, ny, lat, lng))
            }
        }

        val last = waypoints.lastOrNull()
        if (last == null || hypot(last.x - 0.5f, last.y - 0.5f) > 0.015f) {
            waypoints.add(GeoPoint(0.5f, 0.5f, centerLat, centerLng))
        }

        return RealRoadCorridor(id = id, name = name, widthPx = 24f, waypoints = waypoints)
    }

    private fun buildPresetSatelliteCities(): List<CitySector> {
        return listOf(
            CitySector(
                id = "manhattan_midtown",
                name = "New York City (Full Satellite Map)",
                city = "New York, USA",
                centerLat = 40.7580,
                centerLng = -73.9855,
                zoom = 15.0,
                cachedTimestampMs = 1730980000000L,
                tilePackageSizeKb = 4280,
                threatRating = "SATELLITE CITY MAP · REAL NYC ROAD NETWORK",
                roads = listOf(
                    projectGpsPolylineToCorridor(
                        "broadway_nw",
                        "Broadway & West Side Hwy",
                        listOf(
                            40.7620 to -73.9932,
                            40.7608 to -73.9902,
                            40.7598 to -73.9875,
                            40.7589 to -73.9855,
                            40.7580 to -73.9855
                        ),
                        40.7580,
                        -73.9855
                    ),
                    projectGpsPolylineToCorridor(
                        "fdr_ne",
                        "FDR Drive & Lexington Ave",
                        listOf(
                            40.7620 to -73.9775,
                            40.7605 to -73.9802,
                            40.7592 to -73.9825,
                            40.7584 to -73.9842,
                            40.7580 to -73.9855
                        ),
                        40.7580,
                        -73.9855
                    ),
                    projectGpsPolylineToCorridor(
                        "queens_se",
                        "3rd Ave & E 34th St",
                        listOf(
                            40.7540 to -73.9775,
                            40.7556 to -73.9802,
                            40.7574 to -73.9818,
                            40.7578 to -73.9838,
                            40.7580 to -73.9855
                        ),
                        40.7580,
                        -73.9855
                    ),
                    projectGpsPolylineToCorridor(
                        "lincoln_sw",
                        "9th Ave & W 34th St",
                        listOf(
                            40.7540 to -73.9932,
                            40.7554 to -73.9904,
                            40.7566 to -73.9882,
                            40.7574 to -73.9866,
                            40.7580 to -73.9855
                        ),
                        40.7580,
                        -73.9855
                    )
                )
            ),
            CitySector(
                id = "shibuya_crossing",
                name = "Tokyo Metropolis (Full Satellite Map)",
                city = "Tokyo, Japan",
                centerLat = 35.6595,
                centerLng = 139.7004,
                zoom = 15.0,
                cachedTimestampMs = 1730980000000L,
                tilePackageSizeKb = 5120,
                threatRating = "SATELLITE CITY MAP · REAL TOKYO ARTERIAL ROADS",
                roads = listOf(
                    projectGpsPolylineToCorridor(
                        "dogenzaka",
                        "Dogenzaka Real Corridor",
                        listOf(
                            35.6582 to 139.6952,
                            35.6587 to 139.6972,
                            35.6591 to 139.6989,
                            35.6595 to 139.7004
                        ),
                        35.6595,
                        139.7004
                    ),
                    projectGpsPolylineToCorridor(
                        "koen_dori",
                        "Koen-Dori & Jinnan Street",
                        listOf(
                            35.6638 to 139.6992,
                            35.6622 to 139.6998,
                            35.6608 to 139.7001,
                            35.6595 to 139.7004
                        ),
                        35.6595,
                        139.7004
                    ),
                    projectGpsPolylineToCorridor(
                        "meiji_dori",
                        "Meiji-Dori & Miyamasuzaka",
                        listOf(
                            35.6612 to 139.7058,
                            35.6604 to 139.7038,
                            35.6599 to 139.7019,
                            35.6595 to 139.7004
                        ),
                        35.6595,
                        139.7004
                    ),
                    projectGpsPolylineToCorridor(
                        "route_246",
                        "Route 246 Aoyama-Dori",
                        listOf(
                            35.6552 to 139.7026,
                            35.6568 to 139.7016,
                            35.6582 to 139.7009,
                            35.6595 to 139.7004
                        ),
                        35.6595,
                        139.7004
                    )
                )
            ),
            CitySector(
                id = "london_soho",
                name = "London City (Full Satellite Map)",
                city = "London, UK",
                centerLat = 51.5101,
                centerLng = -0.1340,
                zoom = 15.0,
                cachedTimestampMs = null,
                tilePackageSizeKb = 3890,
                threatRating = "SATELLITE CITY MAP · REAL LONDON ROAD NETWORK",
                roads = listOf(
                    projectGpsPolylineToCorridor(
                        "regent_st",
                        "Regent Street Quadrant",
                        listOf(
                            51.5142 to -0.1388,
                            51.5126 to -0.1372,
                            51.5112 to -0.1355,
                            51.5101 to -0.1340
                        ),
                        51.5101,
                        -0.1340
                    ),
                    projectGpsPolylineToCorridor(
                        "shaftesbury",
                        "Shaftesbury Ave",
                        listOf(
                            51.5124 to -0.1278,
                            51.5116 to -0.1301,
                            51.5108 to -0.1322,
                            51.5101 to -0.1340
                        ),
                        51.5101,
                        -0.1340
                    ),
                    projectGpsPolylineToCorridor(
                        "piccadilly",
                        "Piccadilly Thoroughfare",
                        listOf(
                            51.5076 to -0.1405,
                            51.5085 to -0.1382,
                            51.5093 to -0.1360,
                            51.5101 to -0.1340
                        ),
                        51.5101,
                        -0.1340
                    ),
                    projectGpsPolylineToCorridor(
                        "haymarket",
                        "Haymarket & Coventry St",
                        listOf(
                            51.5062 to -0.1315,
                            51.5078 to -0.1321,
                            51.5094 to -0.1327,
                            51.5101 to -0.1340
                        ),
                        51.5101,
                        -0.1340
                    )
                )
            )
        )
    }
}
