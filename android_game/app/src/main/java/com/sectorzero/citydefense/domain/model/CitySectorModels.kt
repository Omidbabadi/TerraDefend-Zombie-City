package com.sectorzero.citydefense.domain.model

import kotlin.math.abs
import kotlin.math.max

data class GeoPoint(
    val x: Float,
    val y: Float,
    val latitude: Double? = null,
    val longitude: Double? = null
)

data class RealRoadCorridor(
    val id: String,
    val name: String,
    val widthPx: Float = 24f,
    val waypoints: List<GeoPoint>
)

data class SquareTerritoryZone(
    val id: String,
    val label: String,
    val centerX: Float,
    val centerY: Float,
    val halfSpan: Float,
    val isHqZone: Boolean = true
) {
    /** Square zone containment using Chebyshev (L-infinity) norm */
    fun containsSquare(px: Float, py: Float): Boolean {
        return max(abs(px - centerX), abs(py - centerY)) <= halfSpan
    }
}

data class CitySector(
    val id: String,
    val name: String,
    val city: String,
    val centerLat: Double,
    val centerLng: Double,
    val zoom: Double = 14.0,
    val cachedTimestampMs: Long? = null,
    val tilePackageSizeKb: Int = 6420,
    val threatRating: String,
    val roads: List<RealRoadCorridor>
)
