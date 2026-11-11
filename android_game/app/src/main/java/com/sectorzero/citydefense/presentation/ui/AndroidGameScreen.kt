package com.sectorzero.citydefense.presentation.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.sectorzero.citydefense.domain.model.AndroidTouchActionMode
import com.sectorzero.citydefense.domain.model.DeployableBlueprint
import com.sectorzero.citydefense.domain.model.DockTabCategory
import com.sectorzero.citydefense.domain.model.GameScreenPhase
import com.sectorzero.citydefense.domain.model.TrainableUnitType
import com.sectorzero.citydefense.presentation.viewmodel.AndroidGameViewModel
import kotlin.math.roundToInt

private val SectorZeroDarkScheme = darkColorScheme(
    primary = Color(0xFFF59E0B),
    secondary = Color(0xFF10B981),
    tertiary = Color(0xFF38BDF8),
    background = Color(0xFF090D16),
    surface = Color(0xFF0F172A)
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AndroidGameScreen(viewModel: AndroidGameViewModel) {
    val state by viewModel.uiState.collectAsState()
    val haptics = LocalHapticFeedback.current

    MaterialTheme(colorScheme = SectorZeroDarkScheme) {
        Box(modifier = Modifier.fillMaxSize().background(Color(0xFF090D16))) {
            // 1. Live Whole-City Satellite Map Layer (Esri World Imagery)
            SatelliteMapComposable(
                sector = state.activeSector,
                modifier = Modifier.fillMaxSize()
            )

            // 2. 60 FPS Tactical Canvas Overlay (Square HQ Zones, Off-Road Buildings, Real-Road Units & Zombies)
            TacticalBattleCanvas(
                state = state,
                onSingleTap = { nx, ny, w, h ->
                    val acted = viewModel.onCanvasSingleTap(nx, ny, w, h)
                    if (acted) haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                },
                onLongPressMoveUnits = { nx, ny ->
                    val ordered = viewModel.orderUnitsAlongRealRoads(nx, ny)
                    if (ordered) haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                },
                modifier = Modifier.fillMaxSize()
            )

            // 3. Android Launch Screen Overlay
            if (state.phase == GameScreenPhase.TITLE) {
                Column(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(Color(0xCC090D16))
                        .padding(24.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    Text(
                        text = "ANDROID TACTICAL SATELLITE EDITION · ${state.activeSector?.name ?: ""}",
                        color = Color(0xFFF59E0B),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )

                    Column {
                        Text(
                            text = "SECTOR ZERO: CITY MAP DEFENSE",
                            color = Color.White,
                            fontSize = 34.sp,
                            fontWeight = FontWeight.ExtraBold
                        )
                        Spacer(modifier = Modifier.height(8.dp))
                        Text(
                            text = "Capture 100% of real Satellite Cities from your central Square HQ Zone. Place buildings outside roads; trained Soldiers & Heavy Tanks exit onto real roads to engage zombies.",
                            color = Color(0xFFCBD5E1),
                            fontSize = 14.sp
                        )
                        Spacer(modifier = Modifier.height(20.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            Button(
                                onClick = {
                                    haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                    viewModel.startOrRestartGame()
                                },
                                colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFF59E0B))
                            ) {
                                Text("PLAY ANDROID GAME", color = Color(0xFF090D16), fontWeight = FontWeight.Bold)
                            }
                            OutlinedButton(onClick = { viewModel.setCityPickerVisible(true) }) {
                                Text("CHOOSE CITY MAP", color = Color.White)
                            }
                            OutlinedButton(onClick = { viewModel.setArmoryStoreVisible(true) }) {
                                Text("ARMORY STORE", color = Color(0xFF38BDF8))
                            }
                        }
                    }

                    Text(
                        text = "Touch Controls: Tap Off-Road to Build · Toggle [MOVE UNITS] or Long-Press Map to Order Units on Real Roads",
                        color = Color(0xFF94A3B8),
                        fontSize = 12.sp
                    )
                }
            } else {
                // 4. Compact Android Tactical HUD (Top Status Bar + Bottom 4-Tab Command Sheet)
                Column(
                    modifier = Modifier.fillMaxSize().padding(10.dp),
                    verticalArrangement = Arrangement.SpaceBetween
                ) {
                    // Top Android Status Bar
                    Surface(
                        color = Color(0xE6090D16),
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Row(
                            modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "HQ ${state.primaryHqHp.roundToInt()} HP · ${state.playerControlPercent}% CITY",
                                color = Color(0xFF10B981),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = if (state.breathingSecondsRemaining > 0) {
                                    "W${state.waveNumber} · PEACE ${state.breathingSecondsRemaining}s"
                                } else {
                                    "W${state.waveNumber} · ${state.zombies.size} ZOM"
                                },
                                color = Color.White,
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "${state.scrap} SCRAP · ${state.wallet.gems} GEMS",
                                color = Color(0xFFF59E0B),
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }

                    state.bannerAlert?.let { alert ->
                        Surface(
                            color = Color(0xEE0F172A),
                            shape = RoundedCornerShape(8.dp),
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        ) {
                            Text(
                                text = alert,
                                color = Color(0xFFFBBF24),
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                            )
                        }
                    }

                    // Bottom Android Touch Mode Switcher + 4-Tab Dock
                    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                FilterChip(
                                    selected = state.touchActionMode == AndroidTouchActionMode.BUILD_OR_INSPECT,
                                    onClick = { viewModel.setTouchActionMode(AndroidTouchActionMode.BUILD_OR_INSPECT) },
                                    label = { Text("TAP: BUILD OFF-ROAD") }
                                )
                                FilterChip(
                                    selected = state.touchActionMode == AndroidTouchActionMode.MOVE_ARMY_ON_ROADS,
                                    onClick = { viewModel.setTouchActionMode(AndroidTouchActionMode.MOVE_ARMY_ON_ROADS) },
                                    label = { Text("TAP: MOVE UNITS (${state.units.size})") }
                                )
                            }
                            OutlinedButton(onClick = { viewModel.callWaveEarly() }) {
                                Text("CALL WAVE +25", fontSize = 11.sp)
                            }
                        }

                        Surface(
                            color = Color(0xF2090D16),
                            shape = RoundedCornerShape(14.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.padding(8.dp)) {
                                Row(
                                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    DockTabCategory.entries.forEach { tab ->
                                        FilterChip(
                                            selected = state.activeDockTab == tab,
                                            onClick = { viewModel.selectDockTab(tab) },
                                            label = { Text(tab.title, fontSize = 11.sp) }
                                        )
                                    }
                                }

                                Spacer(modifier = Modifier.height(6.dp))

                                Row(
                                    modifier = Modifier.horizontalScroll(rememberScrollState()),
                                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                                ) {
                                    if (state.activeDockTab == DockTabCategory.UNITS) {
                                        TrainableUnitType.entries.forEach { unitType ->
                                            val unlocked = state.buildings.any {
                                                it.blueprint == unitType.requiredBuilding && it.buildProgress >= 1f
                                            }
                                            Button(
                                                enabled = unlocked && state.scrap >= unitType.costScrap,
                                                onClick = {
                                                    if (viewModel.trainUnit(unitType)) {
                                                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                                                    }
                                                }
                                            ) {
                                                Text(
                                                    if (unlocked) {
                                                        "TRAIN ${unitType.displayName} (${unitType.costScrap})"
                                                    } else {
                                                        "LOCKED · NEED ${unitType.requiredBuilding.displayName}"
                                                    },
                                                    fontSize = 11.sp
                                                )
                                            }
                                        }
                                    } else {
                                        DeployableBlueprint.entries
                                            .filter { it.tab == state.activeDockTab }
                                            .forEach { bp ->
                                                FilterChip(
                                                    selected = state.selectedBlueprint == bp,
                                                    onClick = { viewModel.selectBlueprint(bp) },
                                                    label = {
                                                        Text("${bp.displayName} · ${bp.flatCostScrap}", fontSize = 11.sp)
                                                    }
                                                )
                                            }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            if (state.showCityPickerSheet) {
                ModalBottomSheet(onDismissRequest = { viewModel.setCityPickerVisible(false) }) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("CHOOSE WHOLE CITY SATELLITE MAP", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        state.cachedSectors.forEach { city ->
                            Button(
                                onClick = { viewModel.selectCitySector(city) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("${city.name} · ${city.roads.size} Real Roads")
                            }
                        }
                    }
                }
            }

            if (state.showArmoryStoreSheet) {
                ModalBottomSheet(onDismissRequest = { viewModel.setArmoryStoreVisible(false) }) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("DEFENSE ARMORY & SUPPLY STORE", fontWeight = FontWeight.Bold, fontSize = 18.sp)
                        state.supplyPacks.forEach { pack ->
                            Button(
                                onClick = { viewModel.claimSupplyPack(pack) },
                                modifier = Modifier.fillMaxWidth()
                            ) {
                                Text("${pack.name} (+${pack.scrapReward} Scrap / +${pack.gemsReward} Gems)")
                            }
                        }
                    }
                }
            }
        }
    }
}
