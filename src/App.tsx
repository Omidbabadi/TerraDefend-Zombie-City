import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  CitySector,
  DeployableId,
  GameScreenState,
  RunSnapshot,
  StorePack,
  UpgradeStat,
} from './game/types';
import {
  DEPLOYABLE_BLUEPRINTS,
  TRAINABLE_UNITS,
  calculateUpgradeCost,
  canTrainUnit,
  createInitialFortressZones,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getHqDefenseWeaponStats,
  getMaxTowerSlots,
  getScrapCollectorYieldPerSecond,
} from './game/rules';
import {
  loadCachedSectors,
  loadPersistedEconomy,
  saveCachedSectors,
  savePersistedEconomy,
} from './game/offlineCache';
import { traceRealRoadsWithOSRM } from './game/osmService';
import { soundEngine } from './game/audio';
import { triggerAndroidHaptic } from './game/haptics';
import {
  HudSyncPayload,
  TacticalBattleCanvas,
} from './components/TacticalBattleCanvas';
import { OpenStreetMapView } from './components/OpenStreetMapView';
import { SectorMapModal } from './components/SectorMapModal';
import { StoreArmoryModal } from './components/StoreArmoryModal';
import { AndroidStudioModal } from './components/AndroidStudioModal';
import { PWAInstallButton } from './components/PWAInstallButton';

export default function App() {
  const [gameState, setGameState] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  const syncedSectorIdRef = useRef<string | null>(null);

  // Cached Sectors & Active City Satellite Map
  const [sectors, setSectors] = useState<CitySector[]>(() => loadCachedSectors());
  const [activeSector, setActiveSector] = useState<CitySector>(
    () => loadCachedSectors()[0]
  );
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Economy & Permanent Upgrades
  const [scrap, setScrap] = useState<number>(420);
  const [gems, setGems] = useState<number>(() => loadPersistedEconomy().gems);
  const [bestScore, setBestScore] = useState<number>(
    () => loadPersistedEconomy().bestScore
  );
  const [bestWave, setBestWave] = useState<number>(
    () => loadPersistedEconomy().bestWave
  );
  const [upgrades, setUpgrades] = useState<UpgradeStat[]>(
    () => loadPersistedEconomy().upgrades
  );

  // Android Touch Action Mode & 4-Tab Dock State
  const [touchActionMode, setTouchActionMode] = useState<'build' | 'move_units'>(
    'build'
  );
  const [activeDockTab, setActiveDockTab] = useState<
    'defensive' | 'economy' | 'military' | 'units'
  >('defensive');
  const [selectedDeployable, setSelectedDeployable] =
    useState<DeployableId>('rotary_turret');
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [nextWaveSignal, setNextWaveSignal] = useState<number>(0);
  const [trainUnitSignal, setTrainUnitSignal] = useState<{
    unitType: 'soldier' | 'heavy_vehicle';
    seq: number;
  } | null>(null);
  const [unitSelectFilterSignal, setUnitSelectFilterSignal] = useState<{
    filter: 'all' | 'soldier' | 'heavy_vehicle';
    seq: number;
  } | null>(null);
  const [focusZoneSignal, setFocusZoneSignal] = useState<{
    zoneId: string;
    seq: number;
  } | null>(null);
  const [upgradeTowerSignal, setUpgradeTowerSignal] = useState<number>(0);
  const [repairTowerSignal, setRepairTowerSignal] = useState<number>(0);
  const [sellTowerSignal, setSellTowerSignal] = useState<number>(0);
  const [deselectTowerSignal, setDeselectTowerSignal] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);

  // Throttled HUD State from 60 FPS Canvas Simulation
  const [hudState, setHudState] = useState<HudSyncPayload>(() => ({
    baseHp: 1000,
    baseMaxHp: 1000,
    wave: 1,
    threatMultiplier: 1.0,
    zombiesRemaining: 6,
    breathingTimeRemaining: 12,
    activeTowerCount: 0,
    maxTowerSlots: getMaxTowerSlots(loadPersistedEconomy().upgrades, 1),
    scrapPerSec: 0,
    playerControlPercent: 31,
    zombieControlPercent: 69,
    hqCount: 1,
    capturedZonesCount: 1,
    totalZonesCount: 5,
    zones: createInitialFortressZones(loadCachedSectors()[0]),
    priorityZoneId: 'fortress_nw',
    soldierCount: 0,
    heavyVehicleCount: 0,
    selectedUnitCount: 0,
    unitCountsByType: {
      rotary_turret: 0,
      sniper_nest: 0,
      emp_pylon: 0,
      fortress: 0,
      scrap_collector: 0,
      infantry_barracks: 0,
      vehicle_factory: 0,
      forward_hq: 0,
      airstrike: 0,
      unit_command: 0,
    },
    selectedTower: null,
    statusAlert: null,
  }));

  // Sheets & Modals
  const [isSectorModalOpen, setIsSectorModalOpen] = useState<boolean>(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);
  const [isAndroidStudioModalOpen, setIsAndroidStudioModalOpen] =
    useState<boolean>(false);
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  useEffect(() => {
    const updatedBestWave = Math.max(bestWave, hudState.wave);
    if (updatedBestWave !== bestWave) {
      setBestWave(updatedBestWave);
    }
    savePersistedEconomy({
      gems,
      scrapBank: scrap,
      bestScore,
      bestWave: updatedBestWave,
      upgrades,
    });
  }, [gems, scrap, bestScore, bestWave, hudState.wave, upgrades]);

  const handleStartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    triggerAndroidHaptic('deploy');
    setRunSnapshot(null);
    setScrap(420);
    setTouchActionMode('build');
    setResetSignal((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleRestartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    triggerAndroidHaptic('deploy');
    setRunSnapshot(null);
    setScrap(420);
    setTouchActionMode('build');
    setResetSignal((n) => n + 1);
    setGameState('playing');
  }, []);

  // Keyboard shortcuts for Android hardware keyboards / Chromebooks / desktop testing
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      if (gameState === 'title') {
        if (
          (e.key === 'Enter' || e.key === ' ') &&
          !isSectorModalOpen &&
          !isStoreModalOpen &&
          !isAndroidStudioModalOpen
        ) {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.key === '1') {
        setActiveDockTab('defensive');
        setSelectedDeployable('rotary_turret');
        setTouchActionMode('build');
      } else if (e.key === '2') {
        setActiveDockTab('defensive');
        setSelectedDeployable('sniper_nest');
        setTouchActionMode('build');
      } else if (e.key === '3') {
        setActiveDockTab('defensive');
        setSelectedDeployable('emp_pylon');
        setTouchActionMode('build');
      } else if (e.key === '4') {
        setActiveDockTab('defensive');
        setSelectedDeployable('fortress');
        setTouchActionMode('build');
      } else if (e.key === '5') {
        setActiveDockTab('economy');
        setSelectedDeployable('scrap_collector');
        setTouchActionMode('build');
      } else if (e.key === '6') {
        setActiveDockTab('military');
        setSelectedDeployable('infantry_barracks');
        setTouchActionMode('build');
      } else if (e.key === '7') {
        setActiveDockTab('military');
        setSelectedDeployable('vehicle_factory');
        setTouchActionMode('build');
      } else if (e.key === '8') {
        setActiveDockTab('economy');
        setSelectedDeployable('forward_hq');
        setTouchActionMode('build');
      } else if (e.key === '9') {
        setActiveDockTab('military');
        setSelectedDeployable('airstrike');
        setTouchActionMode('build');
      } else if (e.key === 'm' || e.key === 'M') {
        setActiveDockTab('units');
        setSelectedDeployable('unit_command');
        setTouchActionMode('move_units');
        setUnitSelectFilterSignal((prev) => ({
          filter: 'all',
          seq: (prev?.seq || 0) + 1,
        }));
      } else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (
          isSectorModalOpen ||
          isStoreModalOpen ||
          isAndroidStudioModalOpen
        ) {
          setIsSectorModalOpen(false);
          setIsStoreModalOpen(false);
          setIsAndroidStudioModalOpen(false);
          return;
        }
        setGameState((prev) =>
          prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev
        );
      } else if (e.key === 'r' || e.key === 'R') {
        if (gameState === 'playing' || gameState === 'paused') {
          handleRestartGame();
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    gameState,
    isSectorModalOpen,
    isStoreModalOpen,
    isAndroidStudioModalOpen,
    handleStartGame,
    handleRestartGame,
  ]);

  const handleSpendScrap = useCallback((amount: number) => {
    setScrap((prev) => Math.max(0, prev - amount));
  }, []);

  const handleEarnScrapAndGems = useCallback(
    (scrapDelta: number, gemsDelta: number, _scoreDelta: number) => {
      if (scrapDelta > 0) setScrap((prev) => prev + scrapDelta);
      if (gemsDelta > 0) setGems((prev) => prev + gemsDelta);
    },
    []
  );

  const handleGameEnd = useCallback(
    (snap: Omit<RunSnapshot, 'bestScore' | 'bestWave'>) => {
      const updatedBestScore = Math.max(bestScore, snap.score);
      const updatedBestWave = Math.max(bestWave, snap.waveReached);
      setBestScore(updatedBestScore);
      setBestWave(updatedBestWave);
      setRunSnapshot({
        ...snap,
        bestScore: updatedBestScore,
        bestWave: updatedBestWave,
      });
      setGameState('gameover');
    },
    [bestScore, bestWave]
  );

  const handleCacheSector = useCallback((updatedSector: CitySector) => {
    setSectors((prev) => {
      const exists = prev.some((s) => s.id === updatedSector.id);
      const next = exists
        ? prev.map((s) => (s.id === updatedSector.id ? updatedSector : s))
        : [updatedSector, ...prev];
      saveCachedSectors(next);
      return next;
    });
  }, []);

  const handleSyncActiveSectorRoads = useCallback(
    (updatedSector: CitySector) => {
      setActiveSector(updatedSector);
      handleCacheSector(updatedSector);
    },
    [handleCacheSector]
  );

  useEffect(() => {
    if (isOfflineMode || activeSector.realRoadSynced) return;
    if (syncedSectorIdRef.current === activeSector.id) return;
    syncedSectorIdRef.current = activeSector.id;

    let cancelled = false;
    traceRealRoadsWithOSRM(
      activeSector.lat,
      activeSector.lng,
      activeSector.name,
      activeSector.city
    ).then((tracedRoads) => {
      if (!cancelled && tracedRoads.length > 0) {
        handleSyncActiveSectorRoads({
          ...activeSector,
          roads: tracedRoads,
          realRoadSynced: true,
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [activeSector, isOfflineMode, handleSyncActiveSectorRoads]);

  const handleSelectSector = useCallback((sector: CitySector) => {
    setActiveSector(sector);
    setScrap(420);
    setTouchActionMode('build');
    setResetSignal((n) => n + 1);
  }, []);

  const handleBuyPack = useCallback((pack: StorePack) => {
    soundEngine.playDeploy();
    triggerAndroidHaptic('deploy');
    setGems((prev) => prev + pack.gemsReward);
    setScrap((prev) => prev + pack.scrapReward);
  }, []);

  const handlePurchaseUpgrade = useCallback(
    (upgradeId: string) => {
      setUpgrades((prev) =>
        prev.map((u) => {
          if (u.id !== upgradeId || u.level >= u.maxLevel) return u;
          const cost = calculateUpgradeCost(u);
          if (gems < cost.gems || scrap < cost.scrap) return u;
          setGems((g) => g - cost.gems);
          setScrap((s) => s - cost.scrap);
          soundEngine.playDeploy();
          triggerAndroidHaptic('deploy');
          return { ...u, level: u.level + 1 };
        })
      );
    },
    [gems, scrap]
  );

  const deployableList = Object.values(DEPLOYABLE_BLUEPRINTS);
  const hqWeaponStats = getHqDefenseWeaponStats(upgrades);
  const totalArmyUnits = hudState.soldierCount + hudState.heavyVehicleCount;
  const selectedTowerStats = hudState.selectedTower
    ? getEffectiveTowerStats(
        hudState.selectedTower.blueprintId,
        hudState.selectedTower.level,
        upgrades
      )
    : null;

  const soldierTrainCheck = canTrainUnit(
    'soldier',
    scrap,
    hudState.unitCountsByType
  );
  const tankTrainCheck = canTrainUnit(
    'heavy_vehicle',
    scrap,
    hudState.unitCountsByType
  );

  return (
    <main className="relative w-screen h-[100dvh] overflow-hidden bg-slate-950 select-none flex flex-col">
      <div className="relative flex-1 w-full h-full overflow-hidden">
        {/* Live Whole-City Satellite Map Layer */}
        {!isOfflineMode && (
          <div className="absolute inset-0 z-0 pointer-events-none opacity-95">
            <OpenStreetMapView
              center={{ lat: activeSector.lat, lng: activeSector.lng }}
              zoom={activeSector.zoom}
              roads={activeSector.roads}
              interactive={false}
            />
          </div>
        )}

        {/* 60 FPS Android Touch Canvas Simulation */}
        <TacticalBattleCanvas
          gameState={
            isSectorModalOpen || isStoreModalOpen || isAndroidStudioModalOpen
              ? 'paused'
              : gameState
          }
          activeSector={activeSector}
          isOfflineMode={isOfflineMode}
          selectedDeployable={selectedDeployable}
          touchActionMode={touchActionMode}
          scrap={scrap}
          gems={gems}
          upgrades={upgrades}
          resetSignal={resetSignal}
          nextWaveSignal={nextWaveSignal}
          trainUnitSignal={trainUnitSignal}
          unitSelectFilterSignal={unitSelectFilterSignal}
          focusZoneIdSignal={focusZoneSignal}
          onSpendScrap={handleSpendScrap}
          onEarnScrapAndGems={handleEarnScrapAndGems}
          onHudSync={setHudState}
          onGameEnd={handleGameEnd}
          upgradeTowerSignal={upgradeTowerSignal}
          repairTowerSignal={repairTowerSignal}
          sellTowerSignal={sellTowerSignal}
          deselectTowerSignal={deselectTowerSignal}
        />

        {/* ==================== ANDROID LAUNCH SCREEN ==================== */}
        {gameState === 'title' && (
          <div
            className="fixed inset-0 z-30 flex flex-col justify-between p-5 sm:p-10 md:p-14"
            style={{
              background:
                'linear-gradient(105deg, rgba(9,13,22,0.92) 0%, rgba(9,13,22,0.72) 52%, rgba(9,13,22,0.22) 100%)',
            }}
          >
            {/* Top Android Status Telemetry */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300 font-mono-tabular">
              <div className="truncate max-w-full">
                ANDROID SATELLITE MAP:{' '}
                <span className="text-slate-100 font-bold">
                  {activeSector.name}
                </span>{' '}
                <span className="hidden sm:inline">· {activeSector.city}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-amber-400 font-bold">
                  SCRAP {Math.round(scrap)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-400 font-bold">
                  GEMS {Math.round(gems)}
                </span>
              </div>
            </div>

            {/* Android Game Crest & Launch Actions */}
            <div className="max-w-xl my-auto">
              <div className="flex items-center gap-3.5 mb-3">
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 52 52"
                  className="shrink-0"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="3"
                    width="46"
                    height="46"
                    rx="12"
                    fill="#090d16"
                    stroke="#22c55e"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M8 26h36M26 8v36"
                    stroke="#f59e0b"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                  />
                  <rect
                    x="18"
                    y="18"
                    width="16"
                    height="16"
                    rx="3"
                    fill="#0f172a"
                    stroke="#38bdf8"
                    strokeWidth="2"
                  />
                  <circle cx="26" cy="26" r="4" fill="#22c55e" />
                </svg>
                <div>
                  <div className="text-[11px] sm:text-xs font-mono-tabular tracking-wider text-emerald-400 uppercase font-bold">
                    Android Tactical Satellite Edition · Real-Road Combat
                  </div>
                  <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-slate-100 uppercase leading-none mt-1">
                    Sector Zero: City Map Defense
                  </h1>
                </div>
              </div>

              <p className="text-xs sm:text-sm md:text-base text-slate-200 leading-relaxed max-w-lg">
                Command your central Square HQ Zone on real-world Satellite City
                Maps and capture 100% of the city. Tap outside roads to construct
                defenses, economy refineries, and military factories—trained
                Soldiers and Heavy Tanks exit onto real roads to battle zombies.
              </p>

              {/* Primary & Secondary Android Touch CTAs */}
              <div className="flex flex-wrap items-center gap-2.5 mt-6">
                <button
                  type="button"
                  data-start="true"
                  onClick={handleStartGame}
                  className="min-h-[48px] px-6 py-3 bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-display text-lg sm:text-xl font-bold tracking-wide uppercase rounded-xl shadow-lg transition-transform whitespace-nowrap shrink-0"
                >
                  Play Android Game
                </button>

                <button
                  type="button"
                  onClick={() => setIsSectorModalOpen(true)}
                  className="min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Choose City Map
                </button>

                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(true)}
                  className="min-h-[48px] px-4 py-3 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Armory &amp; Store
                </button>

                <PWAInstallButton />
              </div>

              <div className="mt-3.5">
                <button
                  type="button"
                  onClick={() => setIsAndroidStudioModalOpen(true)}
                  className="min-h-[44px] px-3.5 py-2 bg-slate-950/95 hover:bg-slate-900 border border-emerald-700/70 rounded-xl text-xs font-mono-tabular text-emerald-300 font-semibold transition-colors inline-flex items-center gap-2"
                >
                  <span>Android Studio Kotlin Project (/android_game)</span>
                </button>
              </div>
            </div>

            {/* Single Flat Inline Touch Control Hint */}
            <div className="text-[11px] sm:text-xs font-mono-tabular text-slate-300">
              Touch Controls: Tap Off-Road Lot to Build · Switch to [Move Units]
              or Long-Press Map to Command Army Along Real Roads
            </div>
          </div>
        )}

        {/* ==================== ANDROID PLAYING HUD ==================== */}
        {gameState !== 'title' && (
          <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-2 sm:p-3">
            {/* Compact Single-Row Android Top Status Bar (48px height -> < 6% of 844px mobile height) */}
            <div className="pointer-events-auto w-full bg-slate-950/95 border border-slate-800 rounded-2xl px-2.5 sm:px-4 h-12 flex items-center justify-between gap-2 shadow-xl">
              {/* Left: HQ HP & Whole-City Square Control % */}
              <div className="flex items-center gap-2.5 sm:gap-4 shrink-0">
                <div>
                  <div className="flex items-center gap-1.5 font-mono-tabular leading-none">
                    <span className="text-[11px] sm:text-sm font-bold text-emerald-400">
                      {Math.round(hudState.baseHp)} HP
                    </span>
                    <span className="text-slate-600">·</span>
                    <span className="text-[11px] sm:text-sm font-bold text-sky-300">
                      {hudState.playerControlPercent}% CITY
                    </span>
                    <span className="text-[10px] text-slate-400 hidden lg:inline">
                      ({hudState.hqCount} HQ · GRID {hudState.activeTowerCount}/
                      {hudState.maxTowerSlots} · CANNON {hqWeaponStats.damage}{' '}
                      DMG)
                    </span>
                  </div>
                  <div className="w-24 sm:w-36 h-1.5 bg-rose-950 rounded-full overflow-hidden border border-slate-800 mt-1">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-200"
                      style={{ width: `${hudState.playerControlPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Center: Wave / Breathing Timer & Scrap / Gems */}
              <div className="flex items-center gap-2 sm:gap-4 font-mono-tabular shrink-0">
                <div className="border-l border-slate-800 pl-2 sm:pl-3.5">
                  <div className="text-[11px] sm:text-sm font-bold text-slate-100 leading-none whitespace-nowrap">
                    W{hudState.wave}
                    {hudState.breathingTimeRemaining > 0 ? (
                      <span className="text-emerald-400">
                        {' '}
                        · {hudState.breathingTimeRemaining}s
                      </span>
                    ) : (
                      <span className="text-rose-400">
                        {' '}
                        · {hudState.zombiesRemaining}Z
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] sm:text-xs font-bold text-amber-400 leading-tight whitespace-nowrap mt-0.5">
                    {Math.round(scrap)} SCRAP
                    {hudState.scrapPerSec > 0 && (
                      <span className="text-[10px] text-yellow-300 hidden sm:inline">
                        {' '}
                        (+{hudState.scrapPerSec}/s)
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden md:block border-l border-slate-800 pl-3.5">
                  <div className="text-xs font-bold text-cyan-400 leading-none">
                    {Math.round(gems)} GEMS
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[140px]">
                    {activeSector.name.split('(')[0].trim()}
                  </div>
                </div>
              </div>

              {/* Right: Android Action Icon Triggers */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label="Choose Whole City Satellite Map"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setIsSectorModalOpen(true);
                  }}
                  className="min-w-[38px] sm:min-w-[44px] h-10 sm:h-11 px-2 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-semibold transition-colors"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
                    <line x1="9" y1="3" x2="9" y2="18" />
                    <line x1="15" y1="6" x2="15" y2="21" />
                  </svg>
                  <span className="hidden xl:inline">City Map</span>
                </button>

                <button
                  type="button"
                  aria-label="Open Defense Armory and Store"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setIsStoreModalOpen(true);
                  }}
                  className="min-w-[38px] sm:min-w-[44px] h-10 sm:h-11 px-2 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-900/70 text-cyan-300 text-xs font-semibold transition-colors"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <path d="M12 2L3 7v6c0 5.5 3.8 10.7 9 12 5.2-1.3 9-6.5 9-12V7l-9-5z" />
                  </svg>
                  <span className="hidden xl:inline">Armory</span>
                </button>

                <button
                  type="button"
                  aria-label="Inspect Native Android Studio Kotlin Code"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setIsAndroidStudioModalOpen(true);
                  }}
                  className="min-w-[38px] sm:min-w-[44px] h-10 sm:h-11 px-2 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-emerald-800/80 text-emerald-300 text-xs font-semibold transition-colors"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <polyline points="16 18 22 12 16 6" />
                    <polyline points="8 6 2 12 8 18" />
                  </svg>
                  <span className="hidden xl:inline">Android APK</span>
                </button>

                <button
                  type="button"
                  aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setMuted((prev) => {
                      const next = !prev;
                      soundEngine.muted = next;
                      return next;
                    });
                  }}
                  className="hidden sm:flex min-w-[44px] h-11 items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    {muted ? (
                      <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                    ) : (
                      <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14" />
                    )}
                  </svg>
                </button>

                <button
                  type="button"
                  aria-label="Pause Game"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    setGameState((prev) =>
                      prev === 'playing' ? 'paused' : 'playing'
                    );
                  }}
                  className="min-w-[38px] sm:min-w-[44px] h-10 sm:h-11 flex items-center justify-center rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 transition-colors"
                >
                  <svg
                    width="15"
                    height="15"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden="true"
                  >
                    <rect x="6" y="4" width="4" height="16" />
                    <rect x="14" y="4" width="4" height="16" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Live Tactical Alert Toast */}
            {hudState.statusAlert && (
              <div className="mx-auto max-w-[92vw] pointer-events-none bg-slate-950/95 border border-amber-500/80 text-amber-300 px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-mono-tabular font-bold tracking-wide text-center shadow-lg">
                {hudState.statusAlert}
              </div>
            )}

            {/* Bottom Android Thumb-Zone Command Stack */}
            <div className="flex flex-col gap-1.5 w-full max-w-4xl mx-auto">
              {/* Contextual Slide-Up Building Inspector Bar */}
              {hudState.selectedTower && selectedTowerStats && (
                <div className="pointer-events-auto bg-slate-950/95 border border-amber-500/70 rounded-2xl px-3 py-2 shadow-2xl flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-100 truncate">
                      {
                        DEPLOYABLE_BLUEPRINTS[hudState.selectedTower.blueprintId]
                          .name
                      }{' '}
                      <span className="text-amber-400 font-mono-tabular">
                        LVL {hudState.selectedTower.level}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono-tabular text-slate-300">
                      HP {Math.round(hudState.selectedTower.hp)}/
                      {hudState.selectedTower.maxHp}
                      {hudState.selectedTower.blueprintId ===
                      'scrap_collector' ? (
                        <span className="text-emerald-400">
                          {' '}
                          · +
                          {getScrapCollectorYieldPerSecond(
                            hudState.selectedTower.level,
                            upgrades
                          )}{' '}
                          Scrap/s
                        </span>
                      ) : (
                        <span> · {selectedTowerStats.damage} DMG</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button
                      type="button"
                      disabled={
                        hudState.selectedTower.level >= 5 ||
                        scrap < selectedTowerStats.upgradeCostScrap
                      }
                      onClick={() => setUpgradeTowerSignal((n) => n + 1)}
                      className={`min-h-[44px] px-3 py-1.5 rounded-xl text-xs font-bold font-mono-tabular transition-colors ${
                        hudState.selectedTower.level < 5 &&
                        scrap >= selectedTowerStats.upgradeCostScrap
                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {hudState.selectedTower.level >= 5
                        ? 'MAX LVL'
                        : `Upgrade (${selectedTowerStats.upgradeCostScrap})`}
                    </button>

                    <button
                      type="button"
                      onClick={() => setRepairTowerSignal((n) => n + 1)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-emerald-900/90 hover:bg-emerald-800 border border-emerald-700 text-emerald-200 text-xs font-bold transition-colors"
                    >
                      Repair
                    </button>

                    <button
                      type="button"
                      onClick={() => setSellTowerSignal((n) => n + 1)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-200 text-xs font-bold transition-colors"
                    >
                      Salvage
                    </button>

                    <button
                      type="button"
                      aria-label="Close Building Inspector"
                      onClick={() => setDeselectTowerSignal((n) => n + 1)}
                      className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}

              {/* Android Single-Finger Touch Mode Switcher + Call Wave Bar */}
              <div className="flex items-center justify-between gap-2">
                <div className="pointer-events-auto inline-flex items-center p-1 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-xl gap-1">
                  <button
                    type="button"
                    data-testid="touch-mode-build"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setTouchActionMode('build');
                      if (selectedDeployable === 'unit_command') {
                        setSelectedDeployable('rotary_turret');
                      }
                    }}
                    className={`min-h-[44px] px-3 sm:px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      touchActionMode === 'build'
                        ? 'bg-amber-500 text-slate-950 shadow'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    Build Off-Road
                  </button>

                  <button
                    type="button"
                    data-testid="touch-mode-move"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setTouchActionMode('move_units');
                      setUnitSelectFilterSignal((prev) => ({
                        filter: 'all',
                        seq: (prev?.seq || 0) + 1,
                      }));
                    }}
                    className={`min-h-[44px] px-3 sm:px-4 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      touchActionMode === 'move_units'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-emerald-300 hover:bg-slate-900'
                    }`}
                  >
                    Move Units ({totalArmyUnits})
                  </button>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    triggerAndroidHaptic('tap');
                    setNextWaveSignal((n) => n + 1);
                  }}
                  className="pointer-events-auto min-h-[44px] px-3.5 py-2 bg-slate-950/95 hover:bg-slate-900 border border-rose-800/80 text-rose-300 font-mono-tabular text-xs font-bold rounded-2xl shadow-xl transition-colors whitespace-nowrap shrink-0"
                >
                  Call Wave +25
                </button>
              </div>

              {/* 4-Tab Material 3 Tactical Command Sheet */}
              <div className="pointer-events-auto bg-slate-950/95 border border-slate-800 rounded-2xl p-2 shadow-2xl flex flex-col gap-1.5">
                {/* 4 Categorized Tabs */}
                <div className="grid grid-cols-4 gap-1 border-b border-slate-800/90 pb-1.5">
                  <button
                    type="button"
                    data-testid="tab-defensive"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setActiveDockTab('defensive');
                      setSelectedDeployable('rotary_turret');
                      setTouchActionMode('build');
                    }}
                    className={`min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-display font-bold tracking-wide uppercase transition-colors truncate ${
                      activeDockTab === 'defensive'
                        ? 'bg-sky-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    1. Defense
                  </button>

                  <button
                    type="button"
                    data-testid="tab-economy"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setActiveDockTab('economy');
                      setSelectedDeployable('scrap_collector');
                      setTouchActionMode('build');
                    }}
                    className={`min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-display font-bold tracking-wide uppercase transition-colors truncate ${
                      activeDockTab === 'economy'
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    2. Economy
                  </button>

                  <button
                    type="button"
                    data-testid="tab-military"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setActiveDockTab('military');
                      setSelectedDeployable('infantry_barracks');
                      setTouchActionMode('build');
                    }}
                    className={`min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-display font-bold tracking-wide uppercase transition-colors truncate ${
                      activeDockTab === 'military'
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    3. Military
                  </button>

                  <button
                    type="button"
                    data-testid="tab-units"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      triggerAndroidHaptic('tap');
                      setActiveDockTab('units');
                    }}
                    className={`min-h-[44px] px-2 rounded-xl text-[11px] sm:text-xs font-display font-bold tracking-wide uppercase transition-colors truncate ${
                      activeDockTab === 'units'
                        ? 'bg-cyan-400 text-slate-950'
                        : 'bg-slate-900 text-cyan-300 hover:bg-slate-800'
                    }`}
                  >
                    4. Units ({totalArmyUnits})
                  </button>
                </div>

                {/* Horizontal Touch Cards */}
                {activeDockTab !== 'units' ? (
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {deployableList
                      .filter((bp) => {
                        if (activeDockTab === 'defensive') {
                          return (
                            bp.id === 'rotary_turret' ||
                            bp.id === 'sniper_nest' ||
                            bp.id === 'emp_pylon' ||
                            bp.id === 'fortress'
                          );
                        }
                        if (activeDockTab === 'economy') {
                          return (
                            bp.id === 'scrap_collector' ||
                            bp.id === 'forward_hq'
                          );
                        }
                        return (
                          bp.id === 'infantry_barracks' ||
                          bp.id === 'vehicle_factory' ||
                          bp.id === 'airstrike'
                        );
                      })
                      .map((bp) => {
                        const isSelected =
                          selectedDeployable === bp.id &&
                          touchActionMode === 'build';
                        const activeCount =
                          hudState.unitCountsByType?.[bp.id] || 0;
                        const flatCost = getDynamicDeployCost(
                          bp.id,
                          activeCount
                        );
                        const isGridFull =
                          bp.category !== 'ability' &&
                          bp.id !== 'forward_hq' &&
                          hudState.activeTowerCount >= hudState.maxTowerSlots;
                        const affordable = scrap >= flatCost && !isGridFull;

                        return (
                          <button
                            key={bp.id}
                            type="button"
                            onClick={(e) => {
                              e.currentTarget.blur();
                              triggerAndroidHaptic('tap');
                              setSelectedDeployable(bp.id);
                              setTouchActionMode('build');
                            }}
                            className={`min-h-[54px] px-3 py-1.5 rounded-xl border text-left transition-all flex items-center gap-2.5 shrink-0 ${
                              isSelected
                                ? 'bg-slate-800 border-amber-500 shadow-md'
                                : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                            } ${!affordable ? 'opacity-60' : ''}`}
                          >
                            <svg
                              width="24"
                              height="24"
                              viewBox="0 0 28 28"
                              className="shrink-0"
                              aria-hidden="true"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="24"
                                height="24"
                                rx="5"
                                fill="#090d16"
                                stroke={bp.color}
                                strokeWidth="2"
                              />
                              {bp.category === 'tower' && (
                                <circle cx="14" cy="14" r="5" fill={bp.color} />
                              )}
                              {(bp.category === 'fortress' ||
                                bp.category === 'hq') && (
                                <rect
                                  x="7"
                                  y="7"
                                  width="14"
                                  height="14"
                                  fill={bp.color}
                                />
                              )}
                              {bp.category === 'economy' && (
                                <path
                                  d="M14 6l6 8-6 8-6-8 6-8z"
                                  fill={bp.color}
                                />
                              )}
                              {bp.id === 'infantry_barracks' && (
                                <polygon
                                  points="14,6 21,20 7,20"
                                  fill={bp.color}
                                />
                              )}
                              {bp.id === 'vehicle_factory' && (
                                <rect
                                  x="6"
                                  y="9"
                                  width="16"
                                  height="10"
                                  rx="2"
                                  fill={bp.color}
                                />
                              )}
                              {bp.category === 'ability' && (
                                <path
                                  d="M14 5v18M5 14h18"
                                  stroke={bp.color}
                                  strokeWidth="2.5"
                                />
                              )}
                            </svg>

                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold text-slate-100 whitespace-nowrap">
                                  {bp.name}
                                </span>
                                {activeCount > 0 && (
                                  <span className="text-[10px] font-mono-tabular text-emerald-400 font-bold">
                                    ×{activeCount}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] font-mono-tabular">
                                <span className="text-amber-400 font-bold">
                                  {flatCost} Scrap
                                </span>
                                <span className="text-slate-400 hidden sm:inline">
                                  · {bp.roleClue}
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
                    {/* Train Rifle Soldier Squad */}
                    <button
                      type="button"
                      data-testid="train-soldier-btn"
                      disabled={!soldierTrainCheck.allowed}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setTrainUnitSignal((prev) => ({
                          unitType: 'soldier',
                          seq: (prev?.seq || 0) + 1,
                        }));
                      }}
                      className={`min-h-[54px] px-3.5 py-1.5 rounded-xl border text-left transition-colors shrink-0 ${
                        soldierTrainCheck.allowed
                          ? 'bg-emerald-950/90 hover:bg-emerald-900 border-emerald-500 text-slate-100'
                          : 'bg-slate-900 border-slate-800 text-slate-400 opacity-75 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                        Train {TRAINABLE_UNITS.soldier.name} (
                        {hudState.soldierCount})
                      </div>
                      <div className="text-[11px] font-mono-tabular text-amber-400">
                        {soldierTrainCheck.unlocked
                          ? `${TRAINABLE_UNITS.soldier.costScrap} Scrap · Exits onto Road`
                          : 'Locked — Build Infantry Barracks'}
                      </div>
                    </button>

                    {/* Train Heavy Siege Tank */}
                    <button
                      type="button"
                      data-testid="train-tank-btn"
                      disabled={!tankTrainCheck.allowed}
                      onClick={(e) => {
                        e.currentTarget.blur();
                        setTrainUnitSignal((prev) => ({
                          unitType: 'heavy_vehicle',
                          seq: (prev?.seq || 0) + 1,
                        }));
                      }}
                      className={`min-h-[54px] px-3.5 py-1.5 rounded-xl border text-left transition-colors shrink-0 ${
                        tankTrainCheck.allowed
                          ? 'bg-cyan-950/90 hover:bg-cyan-900 border-cyan-500 text-slate-100'
                          : 'bg-slate-900 border-slate-800 text-slate-400 opacity-75 cursor-not-allowed'
                      }`}
                    >
                      <div className="text-xs font-bold text-cyan-300 whitespace-nowrap">
                        Train {TRAINABLE_UNITS.heavy_vehicle.name} (
                        {hudState.heavyVehicleCount})
                      </div>
                      <div className="text-[11px] font-mono-tabular text-amber-400">
                        {tankTrainCheck.unlocked
                          ? `${TRAINABLE_UNITS.heavy_vehicle.costScrap} Scrap · Exits onto Road`
                          : 'Locked — Build Vehicle Factory'}
                      </div>
                    </button>

                    {/* Quick Road Rally Quadrant Shortcuts */}
                    {(['fortress_nw', 'fortress_ne', 'fortress_se', 'fortress_sw'] as const).map(
                      (zid, i) => {
                        const labels = ['NW Road', 'NE Road', 'SE Road', 'SW Road'];
                        return (
                          <button
                            key={zid}
                            type="button"
                            onClick={(e) => {
                              e.currentTarget.blur();
                              setTouchActionMode('move_units');
                              setFocusZoneSignal((prev) => ({
                                zoneId: zid,
                                seq: (prev?.seq || 0) + 1,
                              }));
                            }}
                            className="min-h-[54px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-mono-tabular font-bold text-slate-200 whitespace-nowrap shrink-0"
                          >
                            Send {labels[i]}
                          </button>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==================== PAUSED ANDROID SHEET ==================== */}
        {gameState === 'paused' &&
          !isSectorModalOpen &&
          !isStoreModalOpen &&
          !isAndroidStudioModalOpen && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
              role="dialog"
              aria-label="Game Paused"
            >
              <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                <div>
                  <div className="text-xs font-mono-tabular text-amber-400 uppercase font-bold">
                    Android Tactical Pause
                  </div>
                  <h2 className="font-display text-3xl font-bold text-slate-100 uppercase mt-0.5">
                    Sector Defense Paused
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    Wave {hudState.wave} · {hudState.playerControlPercent}% City
                    Controlled · {hudState.hqCount} Active HQ
                  </p>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState('playing')}
                    className="min-h-[46px] w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors"
                  >
                    Resume Battle
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartGame}
                    className="min-h-[46px] w-full bg-slate-800 hover:bg-slate-700 text-slate-100 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Restart City Defense
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsAndroidStudioModalOpen(true)}
                    className="min-h-[46px] w-full bg-slate-950 hover:bg-slate-800 border border-emerald-800 text-emerald-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Inspect Android Studio Kotlin Code
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameState('title')}
                    className="min-h-[46px] w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-300 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Exit to Launch Screen
                  </button>
                </div>
              </div>
            </div>
          )}

        {/* ==================== GAME OVER / VICTORY DEBRIEF ==================== */}
        {gameState === 'gameover' && runSnapshot && (
          <div
            className="fixed inset-0 z-40 flex items-center justify-center p-4"
            style={{ backgroundColor: 'rgba(9, 13, 22, 0.90)' }}
            role="dialog"
            aria-label={
              runSnapshot.victory ? 'City Liberated Victory' : 'HQ Overrun'
            }
          >
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
              <div>
                <div
                  className={`text-xs font-mono-tabular font-bold uppercase ${
                    runSnapshot.victory ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {runSnapshot.victory
                    ? '100% Whole-City Satellite Liberation'
                    : 'Primary HQ Command Overrun'}
                </div>
                <h2 className="font-display text-3xl font-bold text-slate-100 uppercase mt-1">
                  {runSnapshot.victory
                    ? `${runSnapshot.sectorName} Secured`
                    : 'Sector Defense Fallen'}
                </h2>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-slate-950 border border-slate-800 rounded-xl p-4 font-mono-tabular text-xs">
                <div>
                  <div className="text-slate-400">Wave Reached</div>
                  <div className="text-lg font-bold text-slate-100">
                    Wave {runSnapshot.waveReached}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">City Control</div>
                  <div className="text-lg font-bold text-emerald-400">
                    {runSnapshot.mapControlPercent}% ({runSnapshot.hqCount} HQ)
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Zombies Cleared</div>
                  <div className="text-lg font-bold text-amber-400">
                    {runSnapshot.zombiesEliminated}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Best Wave</div>
                  <div className="text-lg font-bold text-cyan-400">
                    Wave {runSnapshot.bestWave}
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5">
                <button
                  type="button"
                  onClick={handleRestartGame}
                  className="min-h-[46px] flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm rounded-xl transition-colors"
                >
                  Play Again
                </button>
                <button
                  type="button"
                  onClick={() => setIsStoreModalOpen(true)}
                  className="min-h-[46px] flex-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-xl transition-colors"
                >
                  Upgrade Armory
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modals & Sheets */}
        <SectorMapModal
          isOpen={isSectorModalOpen}
          onClose={() => setIsSectorModalOpen(false)}
          sectors={sectors}
          activeSector={activeSector}
          isOfflineMode={isOfflineMode}
          onToggleOfflineMode={() => setIsOfflineMode((prev) => !prev)}
          onSelectSector={(sec) => {
            handleSelectSector(sec);
            setIsSectorModalOpen(false);
          }}
          onCacheSector={handleCacheSector}
        />

        <StoreArmoryModal
          isOpen={isStoreModalOpen}
          onClose={() => setIsStoreModalOpen(false)}
          gems={gems}
          scrap={scrap}
          upgrades={upgrades}
          onBuyPack={handleBuyPack}
          onPurchaseUpgrade={handlePurchaseUpgrade}
        />

        <AndroidStudioModal
          isOpen={isAndroidStudioModalOpen}
          onClose={() => setIsAndroidStudioModalOpen(false)}
        />
      </div>
    </main>
  );
}
