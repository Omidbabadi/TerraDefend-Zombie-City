package com.sectorzero.citydefense.domain.model

import kotlin.math.pow
import kotlin.math.roundToInt

data class DefenseUpgrade(
    val id: String,
    val name: String,
    val description: String,
    val level: Int = 1,
    val maxLevel: Int = 10,
    val baseCostGems: Int,
    val baseCostScrap: Int,
    val bonusPerLevel: Float,
    val unitLabel: String
) {
    fun nextScrapCost(): Int = (baseCostScrap * 1.38.pow((level - 1).toDouble())).roundToInt()
    fun nextGemsCost(): Int = (baseCostGems * 1.38.pow((level - 1).toDouble())).roundToInt()
}

data class StoreSupplyPack(
    val id: String,
    val name: String,
    val subtitle: String,
    val gemsReward: Int,
    val scrapReward: Int,
    val badgeText: String
)

data class CommanderWallet(
    val gems: Int = 250,
    val bestScore: Int = 0,
    val bestWave: Int = 1,
    val upgrades: List<DefenseUpgrade> = defaultDefenseUpgrades()
)

fun defaultDefenseUpgrades(): List<DefenseUpgrade> = listOf(
    DefenseUpgrade(
        id = "turret_damage",
        name = "Tungsten Core Rounds",
        description = "Increases all deployed tower & heavy tank ballistic damage.",
        baseCostGems = 50,
        baseCostScrap = 150,
        bonusPerLevel = 0.15f,
        unitLabel = "+15% Tower & Tank DMG"
    ),
    DefenseUpgrade(
        id = "troop_training",
        name = "Exoskeleton Squad Rig",
        description = "Boosts Barracks Soldier & Heavy Siege Tank armor HP and speed.",
        baseCostGems = 60,
        baseCostScrap = 180,
        bonusPerLevel = 0.18f,
        unitLabel = "+18% Unit Power"
    ),
    DefenseUpgrade(
        id = "base_fortification",
        name = "Titanium Command Bulkhead",
        description = "Reinforces HQ bunker HP, expands Power Grid slots, and upgrades the HQ Auto-Cannon.",
        baseCostGems = 40,
        baseCostScrap = 120,
        bonusPerLevel = 250f,
        unitLabel = "+250 HP & HQ Cannon"
    ),
    DefenseUpgrade(
        id = "salvage_scanner",
        name = "Automated Drone Salvage",
        description = "Increases Scrap Refinery output and Scrap harvested per eliminated zombie.",
        baseCostGems = 75,
        baseCostScrap = 200,
        bonusPerLevel = 0.20f,
        unitLabel = "+20% Scrap Economy"
    )
)

fun defaultStoreSupplyPacks(): List<StoreSupplyPack> = listOf(
    StoreSupplyPack(
        id = "starter_drop",
        name = "Tactical Supply Drop",
        subtitle = "Instant emergency Scrap & Bio-Core Gems for field deployment",
        gemsReward = 150,
        scrapReward = 400,
        badgeText = "Instant Supply"
    ),
    StoreSupplyPack(
        id = "commander_crate",
        name = "Sector Commander Crate",
        subtitle = "High-grade Bio-Core Gems & heavy fortification salvage bundle",
        gemsReward = 500,
        scrapReward = 1200,
        badgeText = "Most Popular"
    ),
    StoreSupplyPack(
        id = "orbital_vault",
        name = "Aegis Orbital Warchest",
        subtitle = "Massive reserve of Bio-Core Gems to max out sector upgrades",
        gemsReward = 1500,
        scrapReward = 3500,
        badgeText = "Best Value"
    )
)
