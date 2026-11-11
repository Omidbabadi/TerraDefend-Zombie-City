package com.sectorzero.citydefense.domain.model

enum class GameScreenPhase {
    TITLE,
    PLAYING,
    PAUSED,
    GAME_OVER
}

enum class AndroidTouchActionMode {
    BUILD_OR_INSPECT,
    MOVE_ARMY_ON_ROADS
}

enum class DockTabCategory(val title: String) {
    DEFENSIVE("1. Defense"),
    ECONOMY("2. Economy & HQ"),
    MILITARY("3. Military"),
    UNITS("4. Units & Army")
}

enum class TrainableUnitType(
    val displayName: String,
    val costScrap: Int,
    val requiredBuilding: DeployableBlueprint
) {
    RIFLE_SOLDIER(
        displayName = "Rifle Soldier Squad",
        costScrap = 75,
        requiredBuilding = DeployableBlueprint.INFANTRY_BARRACKS
    ),
    HEAVY_SIEGE_TANK(
        displayName = "Heavy Siege Tank",
        costScrap = 140,
        requiredBuilding = DeployableBlueprint.VEHICLE_FACTORY
    )
}

enum class DeployableBlueprint(
    val displayName: String,
    val tab: DockTabCategory,
    val flatCostScrap: Int,
    val baseHp: Float,
    val baseRangePx: Float,
    val baseDamage: Float,
    val fireRatePerSec: Float,
    val squareZoneHalfSpan: Float? = null,
    val roleSummary: String
) {
    ROTARY_TURRET(
        displayName = "Rotary Turret",
        tab = DockTabCategory.DEFENSIVE,
        flatCostScrap = 100,
        baseHp = 220f,
        baseRangePx = 135f,
        baseDamage = 15f,
        fireRatePerSec = 3.2f,
        roleSummary = "Rapid Point-Defense Tower"
    ),
    RAIL_SNIPER_TOWER(
        displayName = "Rail Sniper Tower",
        tab = DockTabCategory.DEFENSIVE,
        flatCostScrap = 160,
        baseHp = 190f,
        baseRangePx = 245f,
        baseDamage = 78f,
        fireRatePerSec = 0.7f,
        roleSummary = "Long-Range Armor Piercer"
    ),
    CRYO_EMP_PYLON(
        displayName = "Cryo EMP Tower",
        tab = DockTabCategory.DEFENSIVE,
        flatCostScrap = 145,
        baseHp = 210f,
        baseRangePx = 120f,
        baseDamage = 12f,
        fireRatePerSec = 1.15f,
        roleSummary = "Crowd Slow & Shock Pulse"
    ),
    HEAVY_FORTRESS(
        displayName = "Heavy Fortress",
        tab = DockTabCategory.DEFENSIVE,
        flatCostScrap = 190,
        baseHp = 680f,
        baseRangePx = 185f,
        baseDamage = 44f,
        fireRatePerSec = 1.95f,
        squareZoneHalfSpan = 0.16f,
        roleSummary = "Square Bastion · 680 HP · Dual Cannons"
    ),
    SCRAP_REFINERY(
        displayName = "Scrap Refinery",
        tab = DockTabCategory.ECONOMY,
        flatCostScrap = 120,
        baseHp = 230f,
        baseRangePx = 60f,
        baseDamage = 0f,
        fireRatePerSec = 0f,
        roleSummary = "Generates +5 Scrap/sec"
    ),
    FORWARD_HQ_BASE(
        displayName = "Forward HQ Base",
        tab = DockTabCategory.ECONOMY,
        flatCostScrap = 260,
        baseHp = 620f,
        baseRangePx = 165f,
        baseDamage = 26f,
        fireRatePerSec = 2.2f,
        squareZoneHalfSpan = 0.25f,
        roleSummary = "Expands Square City HQ Zone + Cannon"
    ),
    INFANTRY_BARRACKS(
        displayName = "Infantry Barracks",
        tab = DockTabCategory.MILITARY,
        flatCostScrap = 150,
        baseHp = 260f,
        baseRangePx = 115f,
        baseDamage = 14f,
        fireRatePerSec = 1.5f,
        roleSummary = "Unlocks Rifle Soldiers in Units Tab"
    ),
    VEHICLE_FACTORY(
        displayName = "Heavy Vehicle Factory",
        tab = DockTabCategory.MILITARY,
        flatCostScrap = 210,
        baseHp = 340f,
        baseRangePx = 125f,
        baseDamage = 20f,
        fireRatePerSec = 1.2f,
        roleSummary = "Unlocks Heavy Siege Tanks in Units Tab"
    ),
    ORBITAL_AIRSTRIKE(
        displayName = "Orbital Napalm Strike",
        tab = DockTabCategory.MILITARY,
        flatCostScrap = 225,
        baseHp = 1f,
        baseRangePx = 140f,
        baseDamage = 260f,
        fireRatePerSec = 1f,
        roleSummary = "Instant Heavy Area Bombardment"
    )
}

enum class ZombieArchetype {
    WALKER,
    RUNNER,
    SPITTER,
    JUGGERNAUT
}

data class DefenseBuilding(
    val id: Long,
    val blueprint: DeployableBlueprint,
    val normX: Float,
    val normY: Float,
    val level: Int = 1,
    val hp: Float = blueprint.baseHp,
    val maxHp: Float = blueprint.baseHp,
    val buildProgress: Float = 0f,
    val heat: Float = 0f,
    val overheated: Boolean = false,
    val cooldown: Float = 0f,
    val economyTimer: Float = 0f,
    val turretAngleRad: Float = 0f
) {
    val upgradeCostScrap: Int
        get() = (blueprint.flatCostScrap * 0.8f * level).toInt()
}

data class MilitaryUnit(
    val id: Long,
    val unitType: TrainableUnitType,
    val ownerBuildingId: Long?,
    val selected: Boolean = true,
    val normX: Float,
    val normY: Float,
    val rallyX: Float,
    val rallyY: Float,
    val roadPath: List<GeoPoint>,
    val roadPathIndex: Int = 0,
    val hp: Float,
    val maxHp: Float,
    val rangePx: Float,
    val damage: Float,
    val fireRatePerSec: Float,
    val speedNormPerSec: Float,
    val cooldown: Float = 0f,
    val headingRad: Float = 0f
)

data class ZombieHostile(
    val id: Long,
    val archetype: ZombieArchetype,
    val normX: Float,
    val normY: Float,
    val hp: Float,
    val maxHp: Float,
    val speedNormPerSec: Float,
    val damage: Float,
    val scrapReward: Int,
    val roadIndex: Int,
    val waypointIndex: Int = 1,
    val slowTimer: Float = 0f
)
