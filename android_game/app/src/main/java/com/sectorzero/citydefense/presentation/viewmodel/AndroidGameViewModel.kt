package com.sectorzero.citydefense.presentation.viewmodel

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.sectorzero.citydefense.di.AppContainer
import com.sectorzero.citydefense.domain.model.AndroidTouchActionMode
import com.sectorzero.citydefense.domain.model.CitySector
import com.sectorzero.citydefense.domain.model.CommanderWallet
import com.sectorzero.citydefense.domain.model.DefenseBuilding
import com.sectorzero.citydefense.domain.model.DeployableBlueprint
import com.sectorzero.citydefense.domain.model.DockTabCategory
import com.sectorzero.citydefense.domain.model.GameScreenPhase
import com.sectorzero.citydefense.domain.model.MilitaryUnit
import com.sectorzero.citydefense.domain.model.SquareTerritoryZone
import com.sectorzero.citydefense.domain.model.StoreSupplyPack
import com.sectorzero.citydefense.domain.model.TrainableUnitType
import com.sectorzero.citydefense.domain.model.ZombieArchetype
import com.sectorzero.citydefense.domain.model.ZombieHostile
import com.sectorzero.citydefense.domain.model.defaultStoreSupplyPacks
import com.sectorzero.citydefense.domain.usecase.WaveScalingEngine
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

data class AndroidGameUiState(
    val phase: GameScreenPhase = GameScreenPhase.TITLE,
    val cachedSectors: List<CitySector> = emptyList(),
    val activeSector: CitySector? = null,
    val offlineVectorMode: Boolean = false,
    val touchActionMode: AndroidTouchActionMode = AndroidTouchActionMode.BUILD_OR_INSPECT,
    val activeDockTab: DockTabCategory = DockTabCategory.DEFENSIVE,
    val selectedBlueprint: DeployableBlueprint = DeployableBlueprint.ROTARY_TURRET,
    val selectedBuildingId: Long? = null,
    val scrap: Int = 420,
    val scrapPerSec: Float = 0f,
    val wallet: CommanderWallet = CommanderWallet(),
    val supplyPacks: List<StoreSupplyPack> = defaultStoreSupplyPacks(),
    val primaryHqHp: Float = 1000f,
    val primaryHqMaxHp: Float = 1000f,
    val primaryHqCannonAngleRad: Float = 0f,
    val waveNumber: Int = 1,
    val breathingSecondsRemaining: Int = 12,
    val playerControlPercent: Int = 31,
    val zombieControlPercent: Int = 69,
    val hqCount: Int = 1,
    val maxBuildingSlots: Int = 8,
    val squareHqZones: List<SquareTerritoryZone> = emptyList(),
    val buildings: List<DefenseBuilding> = emptyList(),
    val units: List<MilitaryUnit> = emptyList(),
    val zombies: List<ZombieHostile> = emptyList(),
    val rallyPointNormX: Float = 0.5f,
    val rallyPointNormY: Float = 0.36f,
    val bannerAlert: String? = null,
    val victoryAchieved: Boolean = false,
    val showCityPickerSheet: Boolean = false,
    val showArmoryStoreSheet: Boolean = false
)

class AndroidGameViewModel(
    private val container: AppContainer
) : ViewModel() {

    private val _uiState = MutableStateFlow(AndroidGameUiState())
    val uiState: StateFlow<AndroidGameUiState> = _uiState.asStateFlow()

    private var nextEntityId = 1L
    private var waveSpawnQueue = ArrayDeque<ZombieArchetype>()
    private var spawnedInWave = 0
    private var spawnTimerSec = WaveScalingEngine.INITIAL_PREP_BREATHING_SEC
    private var interWaveTimerSec = 0f
    private var hqCannonCooldownSec = 0f
    private var alertTimerSec = 0f

    init {
        viewModelScope.launch {
            container.mapSectorRepository.observeCachedCitySectors().collectLatest { sectors ->
                _uiState.update { curr ->
                    val active = curr.activeSector ?: sectors.firstOrNull()
                    val ctrl = container.roadPathfinder.calculateMapControlPercentage(curr.buildings, true)
                    curr.copy(
                        cachedSectors = sectors,
                        activeSector = active,
                        playerControlPercent = ctrl.playerPercent,
                        zombieControlPercent = ctrl.zombiePercent,
                        hqCount = ctrl.hqCount,
                        squareHqZones = ctrl.squareHqZones
                    )
                }
            }
        }

        viewModelScope.launch {
            container.economyRepository.observeCommanderWallet().collectLatest { wallet ->
                _uiState.update { it.copy(wallet = wallet) }
            }
        }

        // 60 FPS Android Game Simulation Loop
        viewModelScope.launch {
            val dt = 1f / 60f
            while (isActive) {
                delay(16L)
                if (_uiState.value.phase == GameScreenPhase.PLAYING) {
                    stepSimulationTick(dt)
                }
            }
        }
    }

    fun startOrRestartGame() {
        val wallet = _uiState.value.wallet
        val fortLvl = wallet.upgrades.find { it.id == "base_fortification" }?.level ?: 1
        val maxHp = 1000f + (fortLvl - 1) * 250f
        waveSpawnQueue.clear()
        waveSpawnQueue.addAll(container.waveScalingEngine.buildWaveComposition(1))
        spawnedInWave = 0
        spawnTimerSec = WaveScalingEngine.INITIAL_PREP_BREATHING_SEC
        interWaveTimerSec = 0f
        hqCannonCooldownSec = 0f
        alertTimerSec = 4.5f

        val ctrl = container.roadPathfinder.calculateMapControlPercentage(emptyList(), true)
        _uiState.update {
            it.copy(
                phase = GameScreenPhase.PLAYING,
                touchActionMode = AndroidTouchActionMode.BUILD_OR_INSPECT,
                scrap = 420,
                scrapPerSec = 0f,
                primaryHqHp = maxHp,
                primaryHqMaxHp = maxHp,
                waveNumber = 1,
                breathingSecondsRemaining = 12,
                playerControlPercent = ctrl.playerPercent,
                zombieControlPercent = ctrl.zombiePercent,
                hqCount = ctrl.hqCount,
                maxBuildingSlots = 8 + (fortLvl - 1) / 2,
                squareHqZones = ctrl.squareHqZones,
                buildings = emptyList(),
                units = emptyList(),
                zombies = emptyList(),
                selectedBuildingId = null,
                victoryAchieved = false,
                bannerAlert = "12s PREP TIME: BUILD OFF-ROAD DEFENSES & EXPAND SQUARE HQ ZONES"
            )
        }
    }

    fun togglePause() {
        _uiState.update { curr ->
            val nextPhase = when (curr.phase) {
                GameScreenPhase.PLAYING -> GameScreenPhase.PAUSED
                GameScreenPhase.PAUSED -> GameScreenPhase.PLAYING
                else -> curr.phase
            }
            curr.copy(phase = nextPhase)
        }
    }

    fun setTouchActionMode(mode: AndroidTouchActionMode) {
        _uiState.update { it.copy(touchActionMode = mode) }
    }

    fun selectDockTab(tab: DockTabCategory) {
        val defaultBp = when (tab) {
            DockTabCategory.DEFENSIVE -> DeployableBlueprint.ROTARY_TURRET
            DockTabCategory.ECONOMY -> DeployableBlueprint.SCRAP_REFINERY
            DockTabCategory.MILITARY -> DeployableBlueprint.INFANTRY_BARRACKS
            DockTabCategory.UNITS -> _uiState.value.selectedBlueprint
        }
        _uiState.update {
            it.copy(
                activeDockTab = tab,
                selectedBlueprint = defaultBp,
                touchActionMode = if (tab == DockTabCategory.UNITS) {
                    AndroidTouchActionMode.MOVE_ARMY_ON_ROADS
                } else {
                    AndroidTouchActionMode.BUILD_OR_INSPECT
                }
            )
        }
    }

    fun selectBlueprint(blueprint: DeployableBlueprint) {
        _uiState.update {
            it.copy(
                selectedBlueprint = blueprint,
                selectedBuildingId = null,
                touchActionMode = AndroidTouchActionMode.BUILD_OR_INSPECT
            )
        }
    }

    fun setCityPickerVisible(visible: Boolean) {
        _uiState.update { it.copy(showCityPickerSheet = visible) }
    }

    fun setArmoryStoreVisible(visible: Boolean) {
        _uiState.update { it.copy(showArmoryStoreSheet = visible) }
    }

    fun selectCitySector(sector: CitySector) {
        _uiState.update { it.copy(activeSector = sector, showCityPickerSheet = false) }
        startOrRestartGame()
    }

    fun traceCustomCity(cityName: String, country: String, lat: Double, lng: Double) {
        viewModelScope.launch {
            val traced = container.mapSectorRepository.traceRealRoadsWithOsrm(cityName, country, lat, lng)
            selectCitySector(traced)
        }
    }

    fun callWaveEarly() {
        if (waveSpawnQueue.isNotEmpty() && spawnTimerSec > 0.25f) {
            spawnTimerSec = 0.15f
            _uiState.update { it.copy(scrap = it.scrap + 25) }
        } else if (waveSpawnQueue.isEmpty() && _uiState.value.zombies.isEmpty()) {
            interWaveTimerSec = WaveScalingEngine.INTER_WAVE_BREATHING_SEC
            _uiState.update { it.copy(scrap = it.scrap + 25) }
        }
    }

    /**
     * Handles single-tap on the Android Canvas:
     * - If in MOVE_ARMY_ON_ROADS mode, orders Soldiers & Heavy Tanks along real roads.
     * - Otherwise inspects existing buildings/units or deploys the selected off-road building.
     */
    fun onCanvasSingleTap(normX: Float, normY: Float, viewportWidthPx: Float, viewportHeightPx: Float): Boolean {
        val state = _uiState.value
        val sector = state.activeSector ?: return false

        if (state.touchActionMode == AndroidTouchActionMode.MOVE_ARMY_ON_ROADS) {
            return orderUnitsAlongRealRoads(normX, normY)
        }

        // Tap existing building to inspect/upgrade/salvage
        val hitBuilding = state.buildings.firstOrNull { b ->
            hypot((b.normX - normX) * viewportWidthPx, (b.normY - normY) * viewportHeightPx) <= 28f
        }
        if (hitBuilding != null) {
            _uiState.update { it.copy(selectedBuildingId = hitBuilding.id) }
            return true
        }

        val bp = state.selectedBlueprint
        if (bp == DeployableBlueprint.ORBITAL_AIRSTRIKE) {
            if (state.scrap < bp.flatCostScrap) {
                postAlert("NEED ${bp.flatCostScrap} SCRAP FOR ORBITAL STRIKE")
                return false
            }
            val surviving = state.zombies.mapNotNull { z ->
                val dPx = hypot((z.normX - normX) * viewportWidthPx, (z.normY - normY) * viewportHeightPx)
                if (dPx <= bp.baseRangePx) {
                    val rem = z.hp - bp.baseDamage
                    if (rem <= 0f) null else z.copy(hp = rem)
                } else z
            }
            _uiState.update {
                it.copy(
                    scrap = it.scrap - bp.flatCostScrap,
                    zombies = surviving,
                    bannerAlert = "ORBITAL NAPALM STRIKE DELIVERED"
                )
            }
            alertTimerSec = 2.5f
            return true
        }

        val check = container.roadPathfinder.validateOffRoadBuildingPlacement(
            normX = normX,
            normY = normY,
            blueprint = bp,
            sector = sector,
            buildings = state.buildings,
            units = state.units,
            maxBuildingSlots = state.maxBuildingSlots
        )
        if (!check.valid) {
            postAlert(check.reason)
            return false
        }

        if (state.scrap < bp.flatCostScrap) {
            postAlert("NEED ${bp.flatCostScrap} SCRAP")
            return false
        }

        val newBuilding = DefenseBuilding(
            id = nextEntityId++,
            blueprint = bp,
            normX = normX,
            normY = normY
        )
        val updatedBuildings = state.buildings + newBuilding
        val ctrl = container.roadPathfinder.calculateMapControlPercentage(updatedBuildings, state.primaryHqHp > 0f)
        val fortLvl = state.wallet.upgrades.find { it.id == "base_fortification" }?.level ?: 1
        val maxSlots = 8 + (fortLvl - 1) / 2 + max(0, ctrl.hqCount - 1) * 3

        _uiState.update {
            it.copy(
                scrap = it.scrap - bp.flatCostScrap,
                buildings = updatedBuildings,
                selectedBuildingId = newBuilding.id,
                playerControlPercent = ctrl.playerPercent,
                zombieControlPercent = ctrl.zombiePercent,
                hqCount = ctrl.hqCount,
                squareHqZones = ctrl.squareHqZones,
                maxBuildingSlots = maxSlots
            )
        }
        return true
    }

    /**
     * Long-press anywhere on the Android map commands Soldiers & Heavy Tanks along real city roads!
     */
    fun orderUnitsAlongRealRoads(normX: Float, normY: Float): Boolean {
        val state = _uiState.value
        val sector = state.activeSector ?: return false
        if (state.units.isEmpty()) {
            postAlert("NO ACTIVE UNITS — BUILD BARRACKS OR VEHICLE FACTORY FIRST")
            return false
        }

        val snapped = container.roadPathfinder.projectPointToNearestRoad(normX, normY, sector.roads)
        val updatedUnits = state.units.mapIndexed { idx, u ->
            val angle = (idx.toDouble() / max(1, state.units.size)) * Math.PI * 2.0
            val spread = if (state.units.size > 1) 0.014f else 0f
            val destX = snapped.x + (cos(angle) * spread).toFloat()
            val destY = snapped.y + (sin(angle) * spread).toFloat()
            val roadPath = container.roadPathfinder.computeRoadNetworkPath(
                startX = u.normX,
                startY = u.normY,
                targetX = destX,
                targetY = destY,
                roads = sector.roads
            )
            val finalPt = roadPath.lastOrNull()
            u.copy(
                selected = true,
                roadPath = roadPath,
                roadPathIndex = 0,
                rallyX = finalPt?.x ?: snapped.x,
                rallyY = finalPt?.y ?: snapped.y
            )
        }

        alertTimerSec = 2.8f
        _uiState.update {
            it.copy(
                units = updatedUnits,
                rallyPointNormX = snapped.x,
                rallyPointNormY = snapped.y,
                bannerAlert = "ORDERED ${updatedUnits.size} UNITS ALONG REAL CITY ROADS"
            )
        }
        return true
    }

    /**
     * Trains a controllable Soldier Squad or Heavy Siege Tank when its producer building is built.
     * The unit spawns at the off-road building and immediately exits onto the nearest real road.
     */
    fun trainUnit(unitType: TrainableUnitType): Boolean {
        val state = _uiState.value
        val sector = state.activeSector ?: return false
        val producer = state.buildings.firstOrNull {
            it.blueprint == unitType.requiredBuilding && it.buildProgress >= 1f
        }
        if (producer == null) {
            postAlert("LOCKED — BUILD ${unitType.requiredBuilding.displayName.uppercase()} FIRST")
            return false
        }
        if (state.scrap < unitType.costScrap) {
            postAlert("NEED ${unitType.costScrap} SCRAP")
            return false
        }

        val roadExit = container.roadPathfinder.projectPointToNearestRoad(
            px = producer.normX,
            py = producer.normY,
            roads = sector.roads
        )
        val roadPath = container.roadPathfinder.computeRoadNetworkPath(
            startX = producer.normX,
            startY = producer.normY,
            targetX = state.rallyPointNormX,
            targetY = state.rallyPointNormY,
            roads = sector.roads
        )
        val dest = roadPath.lastOrNull()
        val isTank = unitType == TrainableUnitType.HEAVY_SIEGE_TANK
        val hp = if (isTank) 460f else 185f

        val created = MilitaryUnit(
            id = nextEntityId++,
            unitType = unitType,
            ownerBuildingId = producer.id,
            selected = true,
            normX = producer.normX,
            normY = producer.normY,
            rallyX = dest?.x ?: roadExit.x,
            rallyY = dest?.y ?: roadExit.y,
            roadPath = roadPath,
            roadPathIndex = 0,
            hp = hp,
            maxHp = hp,
            rangePx = if (isTank) 160f else 125f,
            damage = if (isTank) 56f else 17f,
            fireRatePerSec = if (isTank) 1.2f else 2.6f,
            speedNormPerSec = if (isTank) 0.062f else 0.082f,
            headingRad = atan2(roadExit.y - producer.normY, roadExit.x - producer.normX)
        )

        alertTimerSec = 3.2f
        _uiState.update {
            it.copy(
                scrap = it.scrap - unitType.costScrap,
                units = it.units + created,
                bannerAlert = "${unitType.displayName.uppercase()} EXITED BUILDING ONTO REAL ROAD"
            )
        }
        return true
    }

    fun upgradeSelectedBuilding() {
        val state = _uiState.value
        val target = state.buildings.firstOrNull { it.id == state.selectedBuildingId } ?: return
        if (target.level >= 5 || state.scrap < target.upgradeCostScrap) return

        val nextLevel = target.level + 1
        val nextMaxHp = target.blueprint.baseHp * (1f + (nextLevel - 1) * 0.35f)
        val updated = state.buildings.map {
            if (it.id == target.id) {
                it.copy(level = nextLevel, maxHp = nextMaxHp, hp = nextMaxHp, heat = 0f, overheated = false)
            } else it
        }
        val ctrl = container.roadPathfinder.calculateMapControlPercentage(updated, state.primaryHqHp > 0f)
        _uiState.update {
            it.copy(
                scrap = it.scrap - target.upgradeCostScrap,
                buildings = updated,
                playerControlPercent = ctrl.playerPercent,
                zombieControlPercent = ctrl.zombiePercent,
                squareHqZones = ctrl.squareHqZones
            )
        }
    }

    fun salvageSelectedBuilding() {
        val state = _uiState.value
        val target = state.buildings.firstOrNull { it.id == state.selectedBuildingId } ?: return
        val refund = (target.blueprint.flatCostScrap * 0.6f * target.level).roundToInt()
        val updated = state.buildings.filterNot { it.id == target.id }
        val ctrl = container.roadPathfinder.calculateMapControlPercentage(updated, state.primaryHqHp > 0f)
        _uiState.update {
            it.copy(
                scrap = it.scrap + refund,
                buildings = updated,
                selectedBuildingId = null,
                playerControlPercent = ctrl.playerPercent,
                zombieControlPercent = ctrl.zombiePercent,
                hqCount = ctrl.hqCount,
                squareHqZones = ctrl.squareHqZones
            )
        }
    }

    fun claimSupplyPack(pack: StoreSupplyPack) {
        viewModelScope.launch {
            val nextWallet = _uiState.value.wallet.copy(gems = _uiState.value.wallet.gems + pack.gemsReward)
            container.economyRepository.saveCommanderWallet(nextWallet)
            _uiState.update {
                it.copy(
                    scrap = it.scrap + pack.scrapReward,
                    wallet = nextWallet
                )
            }
        }
    }

    fun purchasePermanentUpgrade(upgradeId: String) {
        val state = _uiState.value
        val target = state.wallet.upgrades.firstOrNull { it.id == upgradeId } ?: return
        val scrapCost = target.nextScrapCost()
        val gemsCost = target.nextGemsCost()
        if (target.level >= target.maxLevel || state.scrap < scrapCost || state.wallet.gems < gemsCost) return

        viewModelScope.launch {
            val updatedUpgrades = state.wallet.upgrades.map {
                if (it.id == upgradeId) it.copy(level = it.level + 1) else it
            }
            val nextWallet = state.wallet.copy(
                gems = state.wallet.gems - gemsCost,
                upgrades = updatedUpgrades
            )
            container.economyRepository.saveCommanderWallet(nextWallet)
            _uiState.update {
                it.copy(
                    scrap = it.scrap - scrapCost,
                    wallet = nextWallet
                )
            }
        }
    }

    private fun postAlert(message: String) {
        alertTimerSec = 2.8f
        _uiState.update { it.copy(bannerAlert = message) }
    }

    private fun stepSimulationTick(dt: Float) {
        val state = _uiState.value
        val sector = state.activeSector ?: return

        if (alertTimerSec > 0f) {
            alertTimerSec = max(0f, alertTimerSec - dt)
            if (alertTimerSec == 0f) {
                _uiState.update { it.copy(bannerAlert = null) }
            }
        }

        var scrapEarned = 0
        var gemsEarned = 0
        var baseHp = state.primaryHqHp
        var wave = state.waveNumber
        val zombiesMutable = state.zombies.toMutableList()

        // 1. Wave Spawning & Breathing Time
        val waveProfile = container.waveScalingEngine.getWaveScaling(wave)
        if (waveSpawnQueue.isNotEmpty()) {
            spawnTimerSec -= dt
            if (spawnTimerSec <= 0f) {
                val arch = waveSpawnQueue.removeFirst()
                val origin = container.waveScalingEngine.createOuterRoadZombieSpawn(spawnedInWave++, sector)
                val baseZombieHp = when (arch) {
                    ZombieArchetype.WALKER -> 74f
                    ZombieArchetype.RUNNER -> 48f
                    ZombieArchetype.SPITTER -> 64f
                    ZombieArchetype.JUGGERNAUT -> 275f
                } * waveProfile.hpMultiplier
                val baseSpeed = when (arch) {
                    ZombieArchetype.WALKER -> 0.052f
                    ZombieArchetype.RUNNER -> 0.092f
                    ZombieArchetype.SPITTER -> 0.048f
                    ZombieArchetype.JUGGERNAUT -> 0.032f
                } * waveProfile.speedMultiplier

                zombiesMutable.add(
                    ZombieHostile(
                        id = nextEntityId++,
                        archetype = arch,
                        normX = origin.x,
                        normY = origin.y,
                        hp = baseZombieHp,
                        maxHp = baseZombieHp,
                        speedNormPerSec = baseSpeed,
                        damage = 18f * waveProfile.damageMultiplier,
                        scrapReward = if (arch == ZombieArchetype.JUGGERNAUT) 42 else 14,
                        roadIndex = origin.roadIndex,
                        waypointIndex = 1
                    )
                )
                spawnTimerSec = waveProfile.spawnIntervalSec
            }
        } else if (zombiesMutable.isEmpty()) {
            if (interWaveTimerSec == 0f) {
                scrapEarned += waveProfile.waveClearScrapBonus
                gemsEarned += waveProfile.waveClearGemsBonus
            }
            interWaveTimerSec += dt
            if (interWaveTimerSec >= WaveScalingEngine.INTER_WAVE_BREATHING_SEC) {
                wave += 1
                waveSpawnQueue.addAll(container.waveScalingEngine.buildWaveComposition(wave))
                spawnedInWave = 0
                spawnTimerSec = 1.2f
                interWaveTimerSec = 0f
            }
        }

        // 2. Advance Buildings (Construction, Scrap Refinery Economy, Tower Combat)
        var scrapPerSec = 0f
        val nextBuildings = state.buildings.map { b ->
            if (b.buildProgress < 1f) {
                b.copy(buildProgress = min(1f, b.buildProgress + dt / 2.2f))
            } else if (b.blueprint == DeployableBlueprint.SCRAP_REFINERY) {
                val rate = 5f + (b.level - 1) * 2.5f
                scrapPerSec += rate
                val nextTimer = b.economyTimer + dt
                if (nextTimer >= 2f) {
                    scrapEarned += (rate * 2f).roundToInt()
                    b.copy(economyTimer = nextTimer - 2f)
                } else {
                    b.copy(economyTimer = nextTimer)
                }
            } else {
                val cd = max(0f, b.cooldown - dt)
                val targetIdx = zombiesMutable.indexOfFirst { z ->
                    hypot((z.normX - b.normX) * 1000f, (z.normY - b.normY) * 650f) <= b.blueprint.baseRangePx
                }
                if (targetIdx >= 0 && cd <= 0f && b.blueprint.fireRatePerSec > 0f) {
                    val z = zombiesMutable[targetIdx]
                    val dealt = b.blueprint.baseDamage * (1f + (b.level - 1) * 0.25f)
                    val remHp = z.hp - dealt
                    if (remHp <= 0f) {
                        scrapEarned += z.scrapReward
                        zombiesMutable.removeAt(targetIdx)
                    } else {
                        zombiesMutable[targetIdx] = z.copy(
                            hp = remHp,
                            slowTimer = if (b.blueprint == DeployableBlueprint.CRYO_EMP_PYLON) 2.2f else z.slowTimer
                        )
                    }
                    b.copy(
                        cooldown = 1f / b.blueprint.fireRatePerSec,
                        turretAngleRad = atan2(z.normY - b.normY, z.normX - b.normX)
                    )
                } else {
                    b.copy(cooldown = cd)
                }
            }
        }

        // 3. Primary HQ Auto-Cannon at (0.5, 0.5)
        hqCannonCooldownSec = max(0f, hqCannonCooldownSec - dt)
        var hqAngle = state.primaryHqCannonAngleRad
        val hqTargetIdx = zombiesMutable.indexOfFirst { z ->
            hypot((z.normX - 0.5f) * 1000f, (z.normY - 0.5f) * 650f) <= 170f
        }
        if (hqTargetIdx >= 0) {
            val z = zombiesMutable[hqTargetIdx]
            hqAngle = atan2(z.normY - 0.5f, z.normX - 0.5f)
            if (hqCannonCooldownSec <= 0f) {
                hqCannonCooldownSec = 0.42f
                val rem = z.hp - 24f
                if (rem <= 0f) {
                    scrapEarned += z.scrapReward
                    zombiesMutable.removeAt(hqTargetIdx)
                } else {
                    zombiesMutable[hqTargetIdx] = z.copy(hp = rem)
                }
            }
        }

        // 4. Advance Units Strictly Along Real Roads
        val nextUnits = state.units.mapNotNull { u ->
            if (u.hp <= 0f) return@mapNotNull null
            val wp = u.roadPath.getOrNull(u.roadPathIndex)
            var nx = u.normX
            var ny = u.normY
            var nextIdx = u.roadPathIndex
            var heading = u.headingRad

            if (wp != null) {
                val dx = wp.x - nx
                val dy = wp.y - ny
                val dist = hypot(dx, dy)
                if (dist > 0.005f) {
                    val step = min(dist, u.speedNormPerSec * dt)
                    nx += (dx / dist) * step
                    ny += (dy / dist) * step
                    heading = atan2(dy, dx)
                } else if (nextIdx < u.roadPath.size - 1) {
                    nextIdx += 1
                }
            }

            var cd = max(0f, u.cooldown - dt)
            val zIdx = zombiesMutable.indexOfFirst { z ->
                hypot((z.normX - nx) * 1000f, (z.normY - ny) * 650f) <= u.rangePx
            }
            if (zIdx >= 0 && cd <= 0f) {
                val z = zombiesMutable[zIdx]
                heading = atan2(z.normY - ny, z.normX - nx)
                cd = 1f / u.fireRatePerSec
                val rem = z.hp - u.damage
                if (rem <= 0f) {
                    scrapEarned += z.scrapReward
                    zombiesMutable.removeAt(zIdx)
                } else {
                    zombiesMutable[zIdx] = z.copy(hp = rem)
                }
            }

            u.copy(
                normX = nx,
                normY = ny,
                roadPathIndex = nextIdx,
                cooldown = cd,
                headingRad = heading
            )
        }

        // 5. Advance Zombies Strictly Along Real Roads Toward HQ
        val marchedZombies = zombiesMutable.mapNotNull { z ->
            val road = sector.roads.getOrNull(z.roadIndex)
            val wp = road?.waypoints?.getOrNull(z.waypointIndex)
            val slowFactor = if (z.slowTimer > 0f) 0.45f else 1f
            val nextSlow = max(0f, z.slowTimer - dt)

            if (wp == null) {
                baseHp = max(0f, baseHp - z.damage)
                null
            } else {
                val dx = wp.x - z.normX
                val dy = wp.y - z.normY
                val dist = hypot(dx, dy)
                val step = min(dist, z.speedNormPerSec * slowFactor * dt)
                val nx = if (dist > 0.001f) z.normX + (dx / dist) * step else wp.x
                val ny = if (dist > 0.001f) z.normY + (dy / dist) * step else wp.y
                val reached = dist <= 0.008f
                val nextWpIdx = if (reached) z.waypointIndex + 1 else z.waypointIndex

                if (hypot(nx - 0.5f, ny - 0.5f) <= 0.032f) {
                    baseHp = max(0f, baseHp - z.damage)
                    null
                } else {
                    z.copy(normX = nx, normY = ny, waypointIndex = nextWpIdx, slowTimer = nextSlow)
                }
            }
        }

        val ctrl = container.roadPathfinder.calculateMapControlPercentage(nextBuildings, baseHp > 0f)
        val breathing = when {
            wave == 1 && spawnedInWave == 0 && marchedZombies.isEmpty() -> spawnTimerSec.roundToInt()
            waveSpawnQueue.isEmpty() && marchedZombies.isEmpty() ->
                max(0, (WaveScalingEngine.INTER_WAVE_BREATHING_SEC - interWaveTimerSec).roundToInt())
            else -> 0
        }

        val nextPhase = when {
            baseHp <= 0f -> GameScreenPhase.GAME_OVER
            ctrl.playerPercent >= 100 -> GameScreenPhase.GAME_OVER
            else -> state.phase
        }

        _uiState.update {
            it.copy(
                phase = nextPhase,
                victoryAchieved = ctrl.playerPercent >= 100,
                scrap = it.scrap + scrapEarned,
                scrapPerSec = scrapPerSec,
                wallet = if (gemsEarned > 0) it.wallet.copy(gems = it.wallet.gems + gemsEarned) else it.wallet,
                primaryHqHp = baseHp,
                primaryHqCannonAngleRad = hqAngle,
                waveNumber = wave,
                breathingSecondsRemaining = breathing,
                playerControlPercent = ctrl.playerPercent,
                zombieControlPercent = ctrl.zombiePercent,
                hqCount = ctrl.hqCount,
                squareHqZones = ctrl.squareHqZones,
                buildings = nextBuildings,
                units = nextUnits,
                zombies = marchedZombies
            )
        }
    }
}

class AndroidGameViewModelFactory(
    private val container: AppContainer
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T {
        return AndroidGameViewModel(container) as T
    }
}
