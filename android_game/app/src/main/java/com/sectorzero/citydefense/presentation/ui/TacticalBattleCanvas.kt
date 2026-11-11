package com.sectorzero.citydefense.presentation.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.unit.IntSize
import com.sectorzero.citydefense.domain.model.DeployableBlueprint
import com.sectorzero.citydefense.domain.model.TrainableUnitType
import com.sectorzero.citydefense.presentation.viewmodel.AndroidGameUiState
import kotlin.math.cos
import kotlin.math.sin

/**
 * Hardware-accelerated Jetpack Compose Canvas rendering:
 * - Square HQ Player-Controlled Territory Zones & Red Zombie Fog outside player zones
 * - Real City Road Corridors
 * - Off-Road Static Buildings (Towers, Square Heavy Fortresses, Scrap Refineries, Barracks, Vehicle Factories, Forward HQs)
 * - Controllable Soldiers & Heavy Siege Tanks exiting buildings onto real roads
 * - Single-tap build/move and Long-Press unit road command gestures
 */
@Composable
fun TacticalBattleCanvas(
    state: AndroidGameUiState,
    onSingleTap: (normX: Float, normY: Float, widthPx: Float, heightPx: Float) -> Unit,
    onLongPressMoveUnits: (normX: Float, normY: Float) -> Unit,
    modifier: Modifier = Modifier
) {
    var canvasSize by remember { mutableStateOf(IntSize.Zero) }

    Canvas(
        modifier = modifier
            .onSizeChanged { canvasSize = it }
            .pointerInput(state.activeSector?.id, state.touchActionMode) {
                detectTapGestures(
                    onTap = { pos ->
                        if (canvasSize.width > 0 && canvasSize.height > 0) {
                            onSingleTap(
                                pos.x / canvasSize.width.toFloat(),
                                pos.y / canvasSize.height.toFloat(),
                                canvasSize.width.toFloat(),
                                canvasSize.height.toFloat()
                            )
                        }
                    },
                    onLongPress = { pos ->
                        if (canvasSize.width > 0 && canvasSize.height > 0) {
                            onLongPressMoveUnits(
                                pos.x / canvasSize.width.toFloat(),
                                pos.y / canvasSize.height.toFloat()
                            )
                        }
                    }
                )
            }
    ) {
        val w = size.width
        val h = size.height
        if (w <= 0f || h <= 0f) return@Canvas

        // 1. Subtle Hostile City Tint + Player Square HQ Territory Zones
        drawRect(color = Color(0x387F1D1D), size = size)

        state.squareHqZones.forEach { sq ->
            val left = (sq.centerX - sq.halfSpan) * w
            val top = (sq.centerY - sq.halfSpan) * h
            val boxW = sq.halfSpan * 2f * w
            val boxH = sq.halfSpan * 2f * h
            drawRect(
                color = Color(0x2810B981),
                topLeft = Offset(left, top),
                size = Size(boxW, boxH)
            )
            drawRect(
                color = Color(0xCC22C55E),
                topLeft = Offset(left, top),
                size = Size(boxW, boxH),
                style = Stroke(width = 3f)
            )
        }

        // 2. Real City Road Network Corridors
        state.activeSector?.roads?.forEach { road ->
            if (road.waypoints.size >= 2) {
                val path = Path().apply {
                    moveTo(road.waypoints[0].x * w, road.waypoints[0].y * h)
                    for (i in 1 until road.waypoints.size) {
                        lineTo(road.waypoints[i].x * w, road.waypoints[i].y * h)
                    }
                }
                drawPath(
                    path = path,
                    color = Color(0x880F172A),
                    style = Stroke(width = 18f, cap = StrokeCap.Round)
                )
                drawPath(
                    path = path,
                    color = Color(0xCCF59E0B),
                    style = Stroke(width = 2.5f, cap = StrokeCap.Round)
                )
            }
        }

        // 3. Central Primary HQ Bunker & Automated CIWS Cannon at (0.5, 0.5)
        val hqCenter = Offset(0.5f * w, 0.5f * h)
        drawRect(
            color = Color(0xFF0F172A),
            topLeft = Offset(hqCenter.x - 22f, hqCenter.y - 22f),
            size = Size(44f, 44f)
        )
        drawRect(
            color = Color(0xFF22C55E),
            topLeft = Offset(hqCenter.x - 22f, hqCenter.y - 22f),
            size = Size(44f, 44f),
            style = Stroke(width = 3f)
        )
        drawLine(
            color = Color(0xFFFBBF24),
            start = hqCenter,
            end = Offset(
                hqCenter.x + cos(state.primaryHqCannonAngleRad) * 26f,
                hqCenter.y + sin(state.primaryHqCannonAngleRad) * 26f
            ),
            strokeWidth = 5f,
            cap = StrokeCap.Round
        )

        // 4. Off-Road Static Buildings (including Square Heavy Fortress defense perimeters)
        state.buildings.forEach { b ->
            val bx = b.normX * w
            val by = b.normY * h

            if (b.blueprint == DeployableBlueprint.HEAVY_FORTRESS) {
                val span = b.blueprint.squareZoneHalfSpan ?: 0.16f
                drawRect(
                    color = Color(0x55FB923C),
                    topLeft = Offset((b.normX - span) * w, (b.normY - span) * h),
                    size = Size(span * 2f * w, span * 2f * h),
                    style = Stroke(width = 2f)
                )
            }

            val bColor = when (b.blueprint) {
                DeployableBlueprint.ROTARY_TURRET -> Color(0xFF38BDF8)
                DeployableBlueprint.RAIL_SNIPER_TOWER -> Color(0xFFF59E0B)
                DeployableBlueprint.CRYO_EMP_PYLON -> Color(0xFFA855F7)
                DeployableBlueprint.HEAVY_FORTRESS -> Color(0xFFFB923C)
                DeployableBlueprint.SCRAP_REFINERY -> Color(0xFFEAB308)
                DeployableBlueprint.FORWARD_HQ_BASE -> Color(0xFF22C55E)
                DeployableBlueprint.INFANTRY_BARRACKS -> Color(0xFF10B981)
                DeployableBlueprint.VEHICLE_FACTORY -> Color(0xFF06B6D4)
                DeployableBlueprint.ORBITAL_AIRSTRIKE -> Color(0xFFEF4444)
            }

            drawRect(
                color = Color(0xFF090D16),
                topLeft = Offset(bx - 13f, by - 13f),
                size = Size(26f, 26f)
            )
            drawRect(
                color = bColor,
                topLeft = Offset(bx - 13f, by - 13f),
                size = Size(26f, 26f),
                style = Stroke(width = if (b.id == state.selectedBuildingId) 3.5f else 2f)
            )
        }

        // 5. Controllable Soldiers & Heavy Siege Tanks along Real Roads
        state.units.forEach { u ->
            val ux = u.normX * w
            val uy = u.normY * h
            val uColor = if (u.unitType == TrainableUnitType.HEAVY_SIEGE_TANK) {
                Color(0xFF06B6D4)
            } else {
                Color(0xFF10B981)
            }

            // Draw active road path line
            if (u.selected && u.roadPath.isNotEmpty()) {
                val p = Path().apply {
                    moveTo(ux, uy)
                    for (idx in u.roadPathIndex until u.roadPath.size) {
                        lineTo(u.roadPath[idx].x * w, u.roadPath[idx].y * h)
                    }
                }
                drawPath(p, color = Color(0x8834D399), style = Stroke(width = 2f))
            }

            drawCircle(
                color = uColor,
                radius = if (u.unitType == TrainableUnitType.HEAVY_SIEGE_TANK) 10f else 7f,
                center = Offset(ux, uy)
            )
        }

        // 6. Road-Marching Zombies
        state.zombies.forEach { z ->
            drawCircle(
                color = Color(0xFFEF4444),
                radius = 8f,
                center = Offset(z.normX * w, z.normY * h)
            )
        }
    }
}
