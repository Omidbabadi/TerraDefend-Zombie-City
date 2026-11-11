import React, { useState } from 'react';
import { StorePack, UpgradeStat } from '../game/types';
import { STORE_PACKS, calculateUpgradeCost } from '../game/rules';

interface StoreArmoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  gems: number;
  scrap: number;
  upgrades: UpgradeStat[];
  onBuyPack: (pack: StorePack) => void;
  onPurchaseUpgrade: (upgradeId: string) => void;
}

export const StoreArmoryModal: React.FC<StoreArmoryModalProps> = ({
  isOpen,
  onClose,
  gems,
  scrap,
  upgrades,
  onBuyPack,
  onPurchaseUpgrade,
}) => {
  const [activeTab, setActiveTab] = useState<'upgrades' | 'currency'>('upgrades');
  const [purchaseFeedback, setPurchaseFeedback] = useState<string | null>(null);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)', pointerEvents: 'auto' }}
      role="dialog"
      aria-label="Defense Armory & Virtual Currency Store"
    >
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-100 uppercase">
              Defense Armory &amp; Virtual Currency Store
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Upgrade permanent sector defense technologies or claim virtual currency supply crates.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-mono-tabular bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl">
              <span className="text-amber-400 font-bold">SCRAP: {Math.round(scrap)}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-cyan-400 font-bold">GEMS: {Math.round(gems)}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Armory Store"
              className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Done
            </button>
          </div>
        </div>

        {/* Sub-nav Tabs */}
        <div className="px-4 sm:px-6 pt-3 pb-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('upgrades')}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'upgrades'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Defense Upgrades (4)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('currency')}
              className={`min-h-[40px] px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                activeTab === 'currency'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Supply Packs (3)
            </button>
          </div>

          {purchaseFeedback && (
            <span className="text-xs font-medium text-emerald-400">
              {purchaseFeedback}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {activeTab === 'upgrades' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {upgrades.map((u) => {
                const cost = calculateUpgradeCost(u);
                const isMaxed = u.level >= u.maxLevel;
                const canAfford = !isMaxed && gems >= cost.gems && scrap >= cost.scrap;

                return (
                  <div
                    key={u.id}
                    className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-base font-bold text-slate-100">{u.name}</h3>
                        <span className="text-xs font-mono-tabular text-amber-400">
                          LVL {u.level} / {u.maxLevel}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{u.description}</p>
                      <div className="text-xs text-emerald-400 font-mono-tabular mt-2">
                        Effect per rank: {u.unitLabel}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-800/80">
                      <div className="text-xs font-mono-tabular text-slate-300">
                        {isMaxed ? (
                          <span className="text-emerald-400">MAX LEVEL REACHED</span>
                        ) : (
                          <>
                            <span className="text-amber-400">{cost.scrap} Scrap</span>
                            {' · '}
                            <span className="text-cyan-400">{cost.gems} Bio-Gems</span>
                          </>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={!canAfford || isMaxed}
                        onClick={() => {
                          onPurchaseUpgrade(u.id);
                          setPurchaseFeedback(`Upgraded ${u.name} to Level ${u.level + 1}`);
                        }}
                        className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                          canAfford
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {isMaxed ? 'Maxed' : `Upgrade`}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {STORE_PACKS.map((pack) => (
                <div
                  key={pack.id}
                  className="p-5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col justify-between gap-4"
                >
                  <div>
                    <div className="text-xs text-amber-400 font-semibold">
                      {pack.badgeText}
                    </div>
                    <h3 className="text-lg font-bold text-slate-100 mt-1">
                      {pack.name}
                    </h3>
                    <p className="text-xs text-slate-400 mt-1">{pack.subtitle}</p>

                    <div className="mt-4 space-y-1.5 pt-3 border-t border-slate-800/80 font-mono-tabular text-xs">
                      <div className="text-cyan-400 font-bold">
                        +{pack.gemsReward} Bio-Core Gems
                      </div>
                      <div className="text-amber-400 font-bold">
                        +{pack.scrapReward} Tactical Scrap
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onBuyPack(pack);
                      setPurchaseFeedback(
                        `Claimed ${pack.name} (+${pack.gemsReward} Gems, +${pack.scrapReward} Scrap)`
                      );
                    }}
                    className="min-h-[44px] w-full py-2.5 px-4 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0"
                  >
                    Claim {pack.name}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
