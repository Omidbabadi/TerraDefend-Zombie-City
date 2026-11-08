import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../../domain/entities/store_entities.dart';
import '../bloc/tactical_defense_cubit.dart';

class StoreBottomSheet extends StatelessWidget {
  const StoreBottomSheet({super.key});

  static const List<CurrencyPackEntity> _storePacks = [
    CurrencyPackEntity(
      id: 'starter_drop',
      name: 'Tactical Supply Drop',
      subtitle: 'Instant emergency Scrap & Bio-Core Gems for field deployment',
      gemsReward: 150,
      scrapReward: 400,
      badgeText: 'Instant Supply',
    ),
    CurrencyPackEntity(
      id: 'commander_crate',
      name: 'Sector Commander Crate',
      subtitle: 'High-grade Bio-Core Gems & heavy fortification salvage bundle',
      gemsReward: 500,
      scrapReward: 1200,
      badgeText: 'Most Popular',
    ),
    CurrencyPackEntity(
      id: 'orbital_vault',
      name: 'Aegis Orbital Warchest',
      subtitle: 'Massive reserve of Bio-Core Gems to max out sector upgrades',
      gemsReward: 1500,
      scrapReward: 3500,
      badgeText: 'Best Value',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return BlocBuilder<TacticalDefenseCubit, TacticalDefenseState>(
      builder: (context, state) {
        final cubit = context.read<TacticalDefenseCubit>();
        return DefaultTabController(
          length: 2,
          child: Container(
            height: 500,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    const Text(
                      'DEFENSE ARMORY & CURRENCY STORE',
                      style: TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'SCRAP: ${state.wallet.tacticalScrap}  ·  GEMS: ${state.wallet.bioCoreGems}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFF59E0B),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                const TabBar(
                  tabs: [
                    Tab(text: 'Permanent Upgrades'),
                    Tab(text: 'Virtual Currency Packs'),
                  ],
                ),
                const SizedBox(height: 12),
                Expanded(
                  child: TabBarView(
                    children: [
                      ListView.builder(
                        itemCount: state.wallet.upgrades.length,
                        itemBuilder: (context, idx) {
                          final upg = state.wallet.upgrades[idx];
                          return Card(
                            color: const Color(0xFF090D16),
                            child: ListTile(
                              title: Text(
                                '${upg.name} (LVL ${upg.level}/${upg.maxLevel})',
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle: Text(
                                '${upg.description}\nCost: ${upg.nextCostScrap} Scrap · ${upg.nextCostGems} Gems',
                              ),
                              trailing: ElevatedButton(
                                onPressed: upg.isMaxed
                                    ? null
                                    : () => cubit.purchaseUpgrade(upg.id),
                                child: Text(upg.isMaxed ? 'Maxed' : 'Upgrade'),
                              ),
                            ),
                          );
                        },
                      ),
                      ListView.builder(
                        itemCount: _storePacks.length,
                        itemBuilder: (context, idx) {
                          final pack = _storePacks[idx];
                          return Card(
                            color: const Color(0xFF090D16),
                            child: ListTile(
                              title: Text(
                                pack.name,
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              subtitle: Text(
                                '${pack.subtitle}\n+${pack.gemsReward} Bio-Gems · +${pack.scrapReward} Scrap',
                              ),
                              trailing: ElevatedButton(
                                onPressed: () => cubit.claimCurrencyPack(pack),
                                child: const Text('Claim Pack'),
                              ),
                            ),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}
