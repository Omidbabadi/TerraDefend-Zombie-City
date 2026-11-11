package com.sectorzero.citydefense.domain.usecase

import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.DefenseBuilding
import com.sectorzero.citydefense.domain.model.DeployableBlueprint
import com.sectorzero.citydefense.domain.model.GeoPoint
import com.sectorzero.citydefense.domain.model.MilitaryUnit
import com.sectorzero.citydefense.domain.model.RealRoadCorridor
import com.sectorzero.citydefense.domain.model.SquareTerritoryZone
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class RoadProjection(
    val x: Float,
    val y: Float,
    val roadIndex: Int,
    val segmentIndex: Int,
    val segmentT: Float,
    val distance: Float
)

data class MapControlSummary(
    val playerPercent: Int,
    val zombiePercent: Int,
    val hqCount: Int,
    val squareHqZones: List<SquareTerritoryZone>
)

data class PlacementCheckResult(
    val valid: Boolean,
    val reason: String
)

class RoadNetworkPathfinder {

    /**
     * Projects any normalized city coordinate (px, py) onto the closest point on the real road network.
     * Used when Soldiers or Heavy Tanks exit an off-road Barracks/Vehicle Factory onto the street,
     * and when snapping Android touch move orders onto real city roads.
     */
    fun projectPointToNearestRoad(
        px: Float,
        py: Float,
        roads: List<RealRoadCorridor>
    ): RoadProjection {
        if (roads.isEmpty()) {
            return RoadProjection(px, py, 0, 0, 0f, 0f)
        }

        var bestX = px
        var bestY = py
        var bestRoadIdx = 0
        var bestSegIdx = 0
        var bestT = 0f
        var bestDist = Float.MAX_VALUE

        roads.forEachIndexed { rIdx, road ->
            val pts = road.waypoints
            for (sIdx in 0 until (pts.size - 1)) {
                val p1 = pts[sIdx]
                val p2 = pts[sIdx + 1]
                val dx = p2.x - p1.x
                val dy = p2.y - p1.y
                val lenSq = dx * dx + dy * dy
                val t = if (lenSq <= 0f) {
                    0f
                } else {
                    (((px - p1.x) * dx + (py - p1.y) * dy) / lenSq).coerceIn(0f, 1f)
                }
                val projX = p1.x + t * dx
                val projY = p1.y + t * dy
                val d = hypot(px - projX, py - projY)
                if (d < bestDist) {
                    bestDist = d
                    bestX = projX
                    bestY = projY
                    bestRoadIdx = rIdx
                    bestSegIdx = sIdx
                    bestT = t
                }
            }
        }

        return RoadProjection(
            x = bestX,
            y = bestY,
            roadIndex = bestRoadIdx,
            segmentIndex = bestSegIdx,
            segmentT = bestT,
            distance = bestDist
        )
    }

    /**
     * Computes a strict real-road path for a Soldier Squad or Heavy Siege Tank:
     * 1. Exits the off-road building onto the nearest real road projection point.
     * 2. Traverses strictly along real city road segments (via central road hub if changing arteries)
     *    to the closest real-road point near (targetX, targetY).
     */
    fun computeRoadNetworkPath(
        startX: Float,
        startY: Float,
        targetX: Float,
        targetY: Float,
        roads: List<RealRoadCorridor>
    ): List<GeoPoint> {
        if (roads.isEmpty()) {
            return listOf(GeoPoint(targetX, targetY))
        }

        val startProj = projectPointToNearestRoad(startX, startY, roads)
        val endProj = projectPointToNearestRoad(targetX, targetY, roads)
        val raw = mutableListOf<GeoPoint>()

        // Step 1: Exit off-road building onto nearest real road
        raw.add(GeoPoint(startProj.x, startProj.y))

        if (startProj.roadIndex == endProj.roadIndex) {
            val pts = roads[startProj.roadIndex].waypoints
            val posA = startProj.segmentIndex + startProj.segmentT
            val posB = endProj.segmentIndex + endProj.segmentT

            if (posA < posB) {
                for (i in (startProj.segmentIndex + 1)..endProj.segmentIndex) {
                    raw.add(pts[i])
                }
            } else if (posA > posB) {
                for (i in startProj.segmentIndex downTo (endProj.segmentIndex + 1)) {
                    raw.add(pts[i])
                }
            }
        } else {
            val ptsA = roads[startProj.roadIndex].waypoints
            for (i in (startProj.segmentIndex + 1) until ptsA.size) {
                raw.add(ptsA[i])
            }
            val ptsB = roads[endProj.roadIndex].waypoints
            for (i in (ptsB.size - 2) downTo (endProj.segmentIndex + 1)) {
                raw.add(ptsB[i])
            }
        }

        raw.add(GeoPoint(endProj.x, endProj.y))

        val cleaned = mutableListOf<GeoPoint>()
        for (pt in raw) {
            val prev = cleaned.lastOrNull()
            if (prev == null || hypot(pt.x - prev.x, pt.y - prev.y) >= 0.004f) {
                cleaned.add(pt)
            }
        }
        return if (cleaned.isNotEmpty()) cleaned else listOf(GeoPoint(endProj.x, endProj.y))
    }

    /**
     * Returns all active Player-Controlled SQUARE HQ territory zones.
     * Only Primary HQ and Forward HQ Bases expand city map control; Heavy Fortresses project
     * square defensive combat zones without expanding territory percentage.
     */
    fun getPlayerSquareHqZones(
        buildings: List<DefenseBuilding>,
        primaryHqAlive: Boolean = true
    ): List<SquareTerritoryZone> {
        val zones = mutableListOf<SquareTerritoryZone>()
        if (primaryHqAlive) {
            zones.add(
                SquareTerritoryZone(
                    id = "primary_hq",
                    label = "PRIMARY HQ COMMAND",
                    centerX = 0.5f,
                    centerY = 0.5f,
                    halfSpan = 0.25f,
                    isHqZone = true
                )
            )
        }

        var idx = 2
        for (b in buildings) {
            if (b.hp <= 0f || b.buildProgress < 1f) continue
            if (b.blueprint == DeployableBlueprint.FORWARD_HQ_BASE) {
                val baseSpan = b.blueprint.squareZoneHalfSpan ?: 0.28f
                zones.add(
                    SquareTerritoryZone(
                        id = "forward_hq_${b.id}",
                        label = "FORWARD HQ 0${idx++}",
                        centerX = b.normX,
                        centerY = b.normY,
                        halfSpan = baseSpan + (b.level - 1) * 0.025f,
                        isHqZone = true
                    )
                )
            }
        }
        return zones
    }

    fun calculateMapControlPercentage(
        buildings: List<DefenseBuilding>,
        primaryHqAlive: Boolean = true
    ): MapControlSummary {
        val squares = getPlayerSquareHqZones(buildings, primaryHqAlive)
        if (squares.isEmpty()) {
            return MapControlSummary(0, 100, 0, emptyList())
        }

        val gridN = 20
        var controlledCells = 0
        val totalCells = gridN * gridN

        for (gx in 0 until gridN) {
            val px = 0.04f + (gx.toFloat() / (gridN - 1)) * 0.92f
            for (gy in 0 until gridN) {
                val py = 0.06f + (gy.toFloat() / (gridN - 1)) * 0.88f
                if (squares.any { it.containsSquare(px, py) }) {
                    controlledCells++
                }
            }
        }

        val rawRatio = controlledCells.toFloat() / totalCells.toFloat()
        val playerPercent = min(100, ((rawRatio / 0.88f) * 100f).roundToInt())
        return MapControlSummary(
            playerPercent = playerPercent,
            zombiePercent = max(0, 100 - playerPercent),
            hqCount = squares.size,
            squareHqZones = squares
        )
    }

    /**
     * Validates off-road building placement inside Square HQ Player-Controlled Area (or near
     * friendly Soldiers/Tanks marching along real roads).
     */
    fun validateOffRoadBuildingPlacement(
        normX: Float,
        normY: Float,
        blueprint: DeployableBlueprint,
        sector: CitySector,
        buildings: List<DefenseBuilding>,
        units: List<MilitaryUnit>,
        maxBuildingSlots: Int
    ): PlacementCheckResult {
        if (blueprint != DeployableBlueprint.FORWARD_HQ_BASE &&
            blueprint != DeployableBlueprint.ORBITAL_AIRSTRIKE &&
            buildings.size >= maxBuildingSlots
        ) {
            return PlacementCheckResult(
                valid = false,
                reason = "POWER GRID FULL (${buildings.size}/$maxBuildingSlots) · BUILD FORWARD HQ"
            )
        }

        if (normX !in 0.04f..0.96f || normY !in 0.06f..0.92f) {
            return PlacementCheckResult(false, "OUTSIDE CITY SATELLITE PERIMETER")
        }

        val hqSquares = getPlayerSquareHqZones(buildings, true)
        val expansionReach = when (blueprint) {
            DeployableBlueprint.FORWARD_HQ_BASE -> 0.16f
            DeployableBlueprint.HEAVY_FORTRESS -> 0.10f
            else -> 0f
        }
        val insideSquareHq = hqSquares.any {
            max(abs(normX - it.centerX), abs(normY - it.centerY)) <= (it.halfSpan + expansionReach)
        }
        val unitVanguardSpan = if (
            blueprint == DeployableBlueprint.FORWARD_HQ_BASE ||
            blueprint == DeployableBlueprint.HEAVY_FORTRESS
        ) 0.18f else 0.12f
        val nearRoadUnit = units.any {
            max(abs(normX - it.normX), abs(normY - it.normY)) <= unitVanguardSpan
        }

        if (!insideSquareHq && !nearRoadUnit) {
            return PlacementCheckResult(
                valid = false,
                reason = "ZOMBIE ZONE: MOVE UNITS ALONG ROADS OR BUILD FORWARD HQ"
            )
        }

        if (hypot(normX - 0.5f, normY - 0.5f) < 0.062f) {
            return PlacementCheckResult(false, "BLOCKED: PRIMARY HQ BUNKER")
        }

        val nearestRoad = projectPointToNearestRoad(normX, normY, sector.roads)
        if (nearestRoad.distance < 0.028f) {
            return PlacementCheckResult(
                valid = false,
                reason = "BLOCKED: REAL ROAD ASPHALT (BUILD OUTSIDE ROADS)"
            )
        }

        for (existing in buildings) {
            val minSpacing = if (
                blueprint == DeployableBlueprint.FORWARD_HQ_BASE &&
                existing.blueprint == DeployableBlueprint.FORWARD_HQ_BASE
            ) 0.16f else 0.056f
            if (hypot(normX - existing.normX, normY - existing.normY) < minSpacing) {
                return PlacementCheckResult(false, "BLOCKED: TOO CLOSE TO BUILDING")
            }
        }

        return PlacementCheckResult(true, "OFF-ROAD BUILDING SITE CLEAR")
    }
}
