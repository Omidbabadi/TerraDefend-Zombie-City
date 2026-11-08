import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  APIProvider,
  Map as GoogleMapView,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import {
  CachedSectorRoad,
  CitySector,
  DeployableId,
  GameScreenState,
  RunSnapshot,
  StorePack,
  TowerEntity,
  UpgradeStat,
} from './game/types';
import {
  DEPLOYABLE_BLUEPRINTS,
  calculateUpgradeCost,
  convertLatLngPathToSectorRoad,
  getDynamicDeployCost,
  getEffectiveTowerStats,
  getHqDefenseWeaponStats,
  getMaxTowerSlots,
  getPerimeterRoadSpawnOrigins,
  unprojectSectorPointToLatLng,
} from './game/rules';
import {
  loadCachedSectors,
  loadPersistedEconomy,
  saveCachedSectors,
  savePersistedEconomy,
} from './game/offlineCache';
import { soundEngine } from './game/audio';
import { TacticalBattleCanvas } from './components/TacticalBattleCanvas';
import { SectorMapModal } from './components/SectorMapModal';
import { StoreArmoryModal } from './components/StoreArmoryModal';
import { FlutterCodeModal } from './components/FlutterCodeModal';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

/**
 * Synchronizes real-world street paths via Google Maps Routes API (`Route.computeRoutes`)
 * and renders glowing tactical road polylines directly on the live gameplay Google Map.
 */
const GameplayRealRoadOverlay: React.FC<{
  activeSector: CitySector;
  onSyncSectorRoads: (updated: CitySector) => void;
}> = ({ activeSector, onSyncSectorRoads }) => {
  const map = useMap('gameplay-live-map');
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);
  const syncedSectorIdRef = useRef<string | null>(null);

  // Render real-road polylines on the underlying Google Map
  useEffect(() => {
    if (!map || typeof google === 'undefined' || !google.maps?.Polyline) return;

    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    for (const road of activeSector.roads) {
      const pathCoords =
        road.latLngPoints && road.latLngPoints.length >= 2
          ? road.latLngPoints
          : road.points.map((pt) =>
              unprojectSectorPointToLatLng(
                pt.x,
                pt.y,
                activeSector.lat,
                activeSector.lng
              )
            );

      const poly = new google.maps.Polyline({
        path: pathCoords,
        geodesic: true,
        strokeColor: '#ef4444',
        strokeOpacity: 0.75,
        strokeWeight: 4,
        map,
      });
      polylinesRef.current.push(poly);
    }

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, activeSector]);

  // Automatically trace real street geometry via Route.computeRoutes when a sector is loaded
  useEffect(() => {
    if (!routesLib || activeSector.realRoadSynced) return;
    if (syncedSectorIdRef.current === activeSector.id) return;
    syncedSectorIdRef.current = activeSector.id;

    const RouteClass = (
      routesLib as unknown as {
        Route?: {
          computeRoutes?: (req: unknown) => Promise<{
            routes?: Array<{
              path?: Array<{ lat: number; lng: number } | google.maps.LatLng>;
              legs?: Array<{
                steps?: Array<{
                  navigationInstruction?: { instructions?: string };
                }>;
              }>;
            }>;
          }>;
        };
      }
    ).Route;
    const computeRoutesFn = RouteClass?.computeRoutes;
    if (!RouteClass || typeof computeRoutesFn !== 'function') return;

    let cancelled = false;
    const syncRealRoads = async () => {
      const origins = getPerimeterRoadSpawnOrigins(
        activeSector.lat,
        activeSector.lng
      );
      const tracedRoads: CachedSectorRoad[] = [];

      for (let i = 0; i < origins.length; i++) {
        const originInfo = origins[i];
        const fallbackRoad = activeSector.roads[i];
        try {
          const response = await computeRoutesFn.call(RouteClass, {
            origin: originInfo.origin,
            destination: { lat: activeSector.lat, lng: activeSector.lng },
            travelMode: 'WALKING',
            fields: ['path', 'legs'],
          });

          const route = response?.routes?.[0];
          if (route && Array.isArray(route.path) && route.path.length >= 2) {
            const rawLatLngs = route.path.map((pt) => {
              const latVal =
                typeof (pt as google.maps.LatLng).lat === 'function'
                  ? (pt as google.maps.LatLng).lat()
                  : (pt as { lat: number }).lat;
              const lngVal =
                typeof (pt as google.maps.LatLng).lng === 'function'
                  ? (pt as google.maps.LatLng).lng()
                  : (pt as { lng: number }).lng;
              return { lat: latVal, lng: lngVal };
            });

            let roadName = fallbackRoad?.name || originInfo.name;
            const firstInstruction =
              route.legs?.[0]?.steps?.[0]?.navigationInstruction?.instructions;
            if (firstInstruction) {
              const cleaned = firstInstruction
                .replace(
                  /^(Head|Walk|Turn|Continue)\s+(north|south|east|west|northeast|northwest|southeast|southwest|left|right)?\s*(on|toward|onto)?\s*/i,
                  ''
                )
                .split('\n')[0]
                .trim();
              if (cleaned.length >= 3 && cleaned.length <= 28) {
                roadName = cleaned;
              }
            }

            tracedRoads.push(
              convertLatLngPathToSectorRoad(
                originInfo.id,
                roadName,
                rawLatLngs,
                activeSector.lat,
                activeSector.lng,
                fallbackRoad?.distanceMeters
              )
            );
          } else if (fallbackRoad) {
            tracedRoads.push(fallbackRoad);
          }
        } catch {
          if (fallbackRoad) tracedRoads.push(fallbackRoad);
        }
      }

      if (!cancelled && tracedRoads.length > 0) {
        onSyncSectorRoads({
          ...activeSector,
          roads: tracedRoads,
          realRoadSynced: true,
        });
      }
    };

    syncRealRoads();
    return () => {
      cancelled = true;
    };
  }, [routesLib, activeSector, onSyncSectorRoads]);

  return null;
};

export default function App() {
  // Game Screen State Machine
  const [gameState, setGameState] = useState<GameScreenState>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        return 'playing';
      }
    }
    return 'title';
  });

  // Google Maps Quota Banner State (Section 8 Case A)
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  // Cached Sectors & Active City Sector
  const [sectors, setSectors] = useState<CitySector[]>(() => loadCachedSectors());
  const [activeSector, setActiveSector] = useState<CitySector>(
    () => loadCachedSectors()[0]
  );
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);

  // Economy & Permanent Upgrades (Start with 220 Scrap: enough for 1 initial fortification)
  const [scrap, setScrap] = useState<number>(220);
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

  // Tactical Dock Selection & Signals
  const [selectedDeployable, setSelectedDeployable] =
    useState<DeployableId>('rotary_turret');
  const [resetSignal, setResetSignal] = useState<number>(0);
  const [nextWaveSignal, setNextWaveSignal] = useState<number>(0);
  const [upgradeTowerSignal, setUpgradeTowerSignal] = useState<number>(0);
  const [repairTowerSignal, setRepairTowerSignal] = useState<number>(0);
  const [sellTowerSignal, setSellTowerSignal] = useState<number>(0);
  const [muted, setMuted] = useState<boolean>(false);

  // Throttled HUD State from Canvas Simulation
  const [hudState, setHudState] = useState<{
    baseHp: number;
    baseMaxHp: number;
    wave: number;
    threatMultiplier: number;
    zombiesRemaining: number;
    activeTowerCount: number;
    maxTowerSlots: number;
    unitCountsByType: Record<DeployableId, number>;
    selectedTower: TowerEntity | null;
  }>({
    baseHp: 1000,
    baseMaxHp: 1000,
    wave: 1,
    threatMultiplier: 1.0,
    zombiesRemaining: 16,
    activeTowerCount: 0,
    maxTowerSlots: getMaxTowerSlots(loadPersistedEconomy().upgrades),
    unitCountsByType: {
      rotary_turret: 0,
      sniper_nest: 0,
      emp_pylon: 0,
      rifle_squad: 0,
      airstrike: 0,
    },
    selectedTower: null,
  });

  // Modals
  const [isSectorModalOpen, setIsSectorModalOpen] = useState<boolean>(false);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState<boolean>(false);
  const [isFlutterModalOpen, setIsFlutterModalOpen] = useState<boolean>(false);
  const [runSnapshot, setRunSnapshot] = useState<RunSnapshot | null>(null);

  // Sync document.body.dataset.state
  useEffect(() => {
    document.body.dataset.state = gameState;
  }, [gameState]);

  // Listen for Google Maps Platform quota exceeded event
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Persist economy whenever gems, bestScore, bestWave, or upgrades change
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
    setRunSnapshot(null);
    setScrap(220);
    setResetSignal((n) => n + 1);
    setGameState('playing');
  }, []);

  const handleRestartGame = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    setRunSnapshot(null);
    setScrap(220);
    setResetSignal((n) => n + 1);
    setGameState('playing');
  }, []);

  // Global keyboard shortcuts (1-5 deployables, Enter/Space start on title, P/Escape pause, M mute, R restart)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcuts if typing in an input field
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (gameState === 'title') {
        if ((e.key === 'Enter' || e.key === ' ') && !isSectorModalOpen && !isStoreModalOpen && !isFlutterModalOpen) {
          e.preventDefault();
          handleStartGame();
        }
        return;
      }

      if (e.key === '1') setSelectedDeployable('rotary_turret');
      else if (e.key === '2') setSelectedDeployable('sniper_nest');
      else if (e.key === '3') setSelectedDeployable('emp_pylon');
      else if (e.key === '4') setSelectedDeployable('rifle_squad');
      else if (e.key === '5') setSelectedDeployable('airstrike');
      else if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
        if (isSectorModalOpen || isStoreModalOpen || isFlutterModalOpen) {
          setIsSectorModalOpen(false);
          setIsStoreModalOpen(false);
          setIsFlutterModalOpen(false);
          return;
        }
        setGameState((prev) =>
          prev === 'playing' ? 'paused' : prev === 'paused' ? 'playing' : prev
        );
      } else if (e.key === 'm' || e.key === 'M') {
        setMuted((prev) => {
          const next = !prev;
          soundEngine.muted = next;
          return next;
        });
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
    isFlutterModalOpen,
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

  const handleSelectSector = useCallback((sector: CitySector) => {
    setActiveSector(sector);
    setScrap(220);
    setResetSignal((n) => n + 1);
  }, []);

  const handleBuyPack = useCallback((pack: StorePack) => {
    soundEngine.playDeploy();
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
          return { ...u, level: u.level + 1 };
        })
      );
    },
    [gems, scrap]
  );

  const deployableList = Object.values(DEPLOYABLE_BLUEPRINTS);
  const hqWeaponStats = getHqDefenseWeaponStats(upgrades);
  const selectedTowerStats = hudState.selectedTower
    ? getEffectiveTowerStats(
        hudState.selectedTower.blueprintId,
        hudState.selectedTower.level,
        upgrades
      )
    : null;

  return (
    <APIProvider
      apiKey={API_KEY}
      language="en"
      region="US"
    >
      <div className="relative w-screen h-screen overflow-hidden bg-slate-950 select-none flex flex-col">
        {/* Mandatory Google Maps Platform Quota Exceeded Sticky Banner (Section 8 Case A) */}
        {quotaExceeded && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
            <span>
              Google Maps Platform quota reached. If you are the app owner, visit{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="underline font-semibold text-amber-950 hover:text-amber-800"
              >
                maps developer site
              </a>{' '}
              for instructions to update your account.
            </span>
          </div>
        )}

        {/* Main Viewport Stage */}
        <div className="relative flex-1 w-full h-full overflow-hidden">
          {/* Underlying Live Google Map (rendered when Online Mode is active) */}
          {!isOfflineMode && (
            <div className="absolute inset-0 z-0 pointer-events-none opacity-45">
              <GoogleMapView
                id="gameplay-live-map"
                center={{ lat: activeSector.lat, lng: activeSector.lng }}
                zoom={activeSector.zoom}
                mapId="DEMO_MAP_ID"
                disableDefaultUI={true}
                gestureHandling="none"
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                style={{ width: '100%', height: '100%' }}
              >
                <GameplayRealRoadOverlay
                  activeSector={activeSector}
                  onSyncSectorRoads={handleSyncActiveSectorRoads}
                />
              </GoogleMapView>
            </div>
          )}

          {/* 60 FPS Tactical Canvas Simulation & Vector Overlay */}
          <TacticalBattleCanvas
            gameState={
              isSectorModalOpen || isStoreModalOpen || isFlutterModalOpen
                ? 'paused'
                : gameState
            }
            activeSector={activeSector}
            isOfflineMode={isOfflineMode}
            selectedDeployable={selectedDeployable}
            scrap={scrap}
            gems={gems}
            upgrades={upgrades}
            resetSignal={resetSignal}
            nextWaveSignal={nextWaveSignal}
            onSpendScrap={handleSpendScrap}
            onEarnScrapAndGems={handleEarnScrapAndGems}
            onHudSync={setHudState}
            onGameEnd={handleGameEnd}
            upgradeTowerSignal={upgradeTowerSignal}
            repairTowerSignal={repairTowerSignal}
            sellTowerSignal={sellTowerSignal}
          />

          {/* ==================== TITLE SCREEN OVERLAY ==================== */}
          {gameState === 'title' && (
            <div
              className="fixed inset-0 z-30 flex flex-col justify-between p-8 md:p-14"
              style={{
                background:
                  'linear-gradient(90deg, rgba(9,13,22,0.95) 0%, rgba(9,13,22,0.82) 48%, rgba(9,13,22,0.35) 100%)',
              }}
            >
              {/* Top Minimal Status Strip */}
              <div className="flex items-center justify-between text-xs text-slate-400 font-mono-tabular">
                <div>
                  ACTIVE SECTOR: <span className="text-slate-100 font-bold">{activeSector.name}</span> ·{' '}
                  <span>{activeSector.city}</span> ·{' '}
                  <span className="text-emerald-400">
                    {activeSector.cachedAt ? 'OFFLINE VECTOR PACK READY' : 'LIVE GEO-SYNC'}
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-amber-400 font-bold">SCRAP: {Math.round(scrap)}</span>
                  <span>·</span>
                  <span className="text-cyan-400 font-bold">BIO-GEMS: {Math.round(gems)}</span>
                </div>
              </div>

              {/* Left-Third Asymmetric Title Lockup & Primary Actions */}
              <div className="max-w-xl my-auto">
                {/* Custom Inline SVG Emblem Lockup */}
                <div className="flex items-center gap-3 mb-4">
                  <svg
                    width="48"
                    height="48"
                    viewBox="0 0 48 48"
                    className="shrink-0"
                    aria-hidden="true"
                  >
                    <polygon
                      points="24,3 44,14 44,34 24,45 4,34 4,14"
                      fill="#0f172a"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="24"
                      cy="24"
                      r="11"
                      fill="none"
                      stroke="#38bdf8"
                      strokeWidth="2"
                      strokeDasharray="5 3"
                    />
                    <circle cx="24" cy="24" r="4.5" fill="#ef4444" />
                  </svg>
                  <div>
                    <div className="text-xs font-mono-tabular tracking-widest text-amber-400 uppercase">
                      Real-World Geolocation & Offline Tactical Defense
                    </div>
                    <h1
                      className="font-display text-5xl md:text-6xl font-bold tracking-tight text-slate-100 uppercase leading-none mt-1"
                      style={{ textWrap: 'balance' }}
                    >
                      Sector Zero: City Map Defense
                    </h1>
                  </div>
                </div>

                <p className="text-sm md:text-base text-slate-300 leading-relaxed max-w-lg">
                  Select any real-world city intersection via Google Maps Platform, cache its vector road corridors for smooth offline play, and fortify your HQ command base against multi-archetype zombie waves.
                </p>

                {/* Primary & Secondary CTAs (<= 3 menu actions) */}
                <div className="flex flex-wrap items-center gap-3 mt-7">
                  <button
                    type="button"
                    data-start="true"
                    onClick={handleStartGame}
                    className="px-7 py-3.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-display text-xl font-bold tracking-wide uppercase rounded-lg shadow-lg transition-transform active:scale-95 whitespace-nowrap shrink-0"
                  >
                    Deploy to {activeSector.name}
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsSectorModalOpen(true)}
                    className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Choose City Map & Offline Cache
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsStoreModalOpen(true)}
                    className="px-5 py-3.5 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Armory & Currency Store
                  </button>
                </div>

                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => setIsFlutterModalOpen(true)}
                    className="text-xs font-mono-tabular text-slate-400 hover:text-amber-400 underline transition-colors"
                  >
                    Inspect Flutter Mobile SDK Code (`flutter_project/lib/main.dart`)
                  </button>
                </div>
              </div>

              {/* Single Flat Inline Control Hint in Bottom Safe Margin */}
              <div className="text-xs font-mono-tabular text-slate-400">
                1–5 Select Tower / Squad / Airstrike · Click Map to Deploy · P or Esc Pause · M Mute · Enter Start
              </div>
            </div>
          )}

          {/* ==================== PLAYING HUD SHELL ==================== */}
          {gameState !== 'title' && (
            <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-4">
              {/* Top Perimeter Clusters */}
              <div className="flex items-start justify-between gap-4">
                {/* Top-Left Cluster: Command Base Vitality & Sector Cache Status */}
                <div
                  className="pointer-events-auto bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-3 shadow-xl flex items-center gap-5"
                >
                  <div>
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      HQ Command Integrity
                    </div>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="font-display text-3xl font-bold font-mono-tabular text-emerald-400 stroke-text">
                        {Math.round(hudState.baseHp)}
                      </span>
                      <span className="text-xs font-mono-tabular text-slate-400">
                        / {hudState.baseMaxHp} HP ·{' '}
                        <span className="text-amber-400">
                          HQ CANNON {hqWeaponStats.damage} DMG
                        </span>
                      </span>
                    </div>
                    {/* Continuous Health Bar */}
                    <div className="w-44 h-2 bg-slate-900 rounded-full overflow-hidden mt-1.5 border border-slate-800">
                      <div
                        className="h-full transition-transform duration-150 origin-left"
                        style={{
                          backgroundColor:
                            hudState.baseHp > hudState.baseMaxHp * 0.35
                              ? '#10b981'
                              : '#ef4444',
                          transform: `scaleX(${Math.max(
                            0,
                            Math.min(1, hudState.baseHp / hudState.baseMaxHp)
                          )})`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="border-l border-slate-800 pl-4">
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                      Active City Sector
                    </div>
                    <div className="text-sm font-bold text-slate-100 truncate max-w-[190px]">
                      {activeSector.name}
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                      {isOfflineMode ? 'OFFLINE VECTOR CACHE' : 'LIVE GOOGLE MAP'} ·{' '}
                      {activeSector.cachedAt ? 'CACHED' : 'ONLINE'}
                    </div>
                  </div>
                </div>

                {/* Top-Center Cluster: Endless Wave, Threat Scaling & Economy Counters */}
                <div className="pointer-events-auto bg-slate-950/90 border border-slate-800 rounded-xl px-5 py-2.5 shadow-xl flex items-center gap-6">
                  <div>
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      ENDLESS WAVE · BEST W{Math.max(bestWave, hudState.wave)}
                    </div>
                    <div className="font-display text-3xl font-bold font-mono-tabular text-slate-100 flex items-baseline gap-2">
                      <span>W{hudState.wave}</span>
                      <span className="text-xs font-mono-tabular text-amber-400">
                        ×{hudState.threatMultiplier.toFixed(2)} THREAT
                      </span>
                    </div>
                  </div>

                  <div className="border-l border-slate-800 pl-5">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      HOSTILES
                    </div>
                    <div className="font-display text-3xl font-bold font-mono-tabular text-rose-400">
                      {hudState.zombiesRemaining}
                    </div>
                  </div>

                  <div className="border-l border-slate-800 pl-5">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      POWER GRID
                    </div>
                    <div className="font-display text-3xl font-bold font-mono-tabular text-sky-400">
                      {hudState.activeTowerCount}
                      <span className="text-sm text-slate-400">
                        /{hudState.maxTowerSlots}
                      </span>
                    </div>
                  </div>

                  <div className="border-l border-slate-800 pl-5">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      SCRAP SALVAGE
                    </div>
                    <div className="font-display text-3xl font-bold font-mono-tabular text-amber-400">
                      {Math.round(scrap)}
                    </div>
                  </div>

                  <div className="border-l border-slate-800 pl-5">
                    <div className="text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                      BIO-GEMS
                    </div>
                    <div className="font-display text-3xl font-bold font-mono-tabular text-cyan-400">
                      {Math.round(gems)}
                    </div>
                  </div>
                </div>

                {/* Top-Right Cluster: Compact Utility Controls */}
                <div className="pointer-events-auto flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setIsSectorModalOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 text-slate-200 text-xs font-semibold rounded-xl shadow-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Map & Offline Cache
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setIsStoreModalOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-slate-950/90 hover:bg-slate-900 border border-cyan-800/80 text-cyan-300 text-xs font-semibold rounded-xl shadow-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Store & Upgrades
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setIsFlutterModalOpen(true);
                    }}
                    className="px-3.5 py-2.5 bg-slate-950/90 hover:bg-slate-900 border border-amber-700/80 text-amber-300 text-xs font-semibold rounded-xl shadow-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Flutter Clean Arch (20 Files)
                  </button>

                  {/* Mute [M] */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label={muted ? 'Unmute Audio' : 'Mute Audio'}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setMuted((prev) => {
                        const next = !prev;
                        soundEngine.muted = next;
                        return next;
                      });
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 shadow-lg transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      {muted ? (
                        <path d="M11 5L6 9H2v6h4l5 4V5zM23 9l-6 6M17 9l6 6" />
                      ) : (
                        <path d="M11 5L6 9H2v6h4l5 4V5zM19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                      )}
                    </svg>
                  </button>

                  {/* Pause [P] */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Pause Game"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setGameState((prev) =>
                        prev === 'playing' ? 'paused' : 'playing'
                      );
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 shadow-lg transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  </button>

                  {/* Restart [R] */}
                  <button
                    type="button"
                    tabIndex={-1}
                    aria-label="Restart Sector Defense"
                    onClick={(e) => {
                      e.currentTarget.blur();
                      handleRestartGame();
                    }}
                    className="w-10 h-10 flex items-center justify-center bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-xl text-slate-200 shadow-lg transition-colors"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                      <path d="M3 3v5h5" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Bottom Unified Perimeter Tactical Dock */}
              <div className="flex items-end justify-between gap-4">
                {/* Main Buildable & Troop Deployment Strip (with Dynamic Escalating Costs & Grid Cap) */}
                <div className="pointer-events-auto bg-slate-950/95 border border-slate-800 rounded-xl p-2 shadow-2xl flex items-center gap-2 overflow-x-auto max-w-full">
                  {deployableList.map((bp) => {
                    const isSelected = selectedDeployable === bp.id;
                    const activeCount = hudState.unitCountsByType?.[bp.id] || 0;
                    const dynamicCost = getDynamicDeployCost(bp.id, activeCount);
                    const isGridFull =
                      bp.category === 'tower' &&
                      hudState.activeTowerCount >= hudState.maxTowerSlots;
                    const affordable = scrap >= dynamicCost && !isGridFull;
                    return (
                      <button
                        key={bp.id}
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          setSelectedDeployable(bp.id);
                        }}
                        className={`px-3.5 py-2 rounded-lg border text-left transition-all flex items-center gap-3 shrink-0 ${
                          isSelected
                            ? 'bg-slate-800 border-amber-500 shadow-md'
                            : 'bg-slate-900/90 border-slate-800 hover:border-slate-700'
                        } ${!affordable ? 'opacity-60' : ''}`}
                      >
                        {/* Custom SVG Silhouette Icon */}
                        <svg width="28" height="28" viewBox="0 0 28 28" className="shrink-0">
                          <rect
                            x="2"
                            y="2"
                            width="24"
                            height="24"
                            rx="6"
                            fill="#090d16"
                            stroke={bp.color}
                            strokeWidth="2"
                          />
                          {bp.category === 'tower' && (
                            <circle cx="14" cy="14" r="5" fill={bp.color} />
                          )}
                          {bp.category === 'troop' && (
                            <polygon points="14,6 21,20 7,20" fill={bp.color} />
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
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-100 whitespace-nowrap">
                              [{bp.keyBinding}] {bp.name}
                            </span>
                            <span
                              className={`text-xs font-mono-tabular font-bold ${
                                affordable ? 'text-amber-400' : 'text-rose-400'
                              }`}
                            >
                              {isGridFull ? 'GRID FULL' : `${dynamicCost} SCRAP`}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 whitespace-nowrap">
                            {bp.roleClue}
                            {activeCount > 0 ? ` · ${activeCount} ACTIVE (+38%)` : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Selected Tower Inspector OR Wave Trigger Card */}
                {hudState.selectedTower && selectedTowerStats ? (
                  <div className="pointer-events-auto bg-slate-950/95 border border-slate-800 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-4 shrink-0">
                    <div>
                      <div className="text-xs font-bold text-slate-100">
                        {
                          DEPLOYABLE_BLUEPRINTS[
                            hudState.selectedTower.blueprintId
                          ].name
                        }{' '}
                        · LVL {hudState.selectedTower.level} ·{' '}
                        <span
                          className={
                            hudState.selectedTower.hp <
                            hudState.selectedTower.maxHp * 0.45
                              ? 'text-rose-400'
                              : 'text-emerald-400'
                          }
                        >
                          {Math.round(hudState.selectedTower.hp)}/
                          {hudState.selectedTower.maxHp} HP
                        </span>
                      </div>
                      <div className="text-[11px] font-mono-tabular text-slate-400">
                        DMG {selectedTowerStats.damage} · RNG{' '}
                        {selectedTowerStats.range}m ·{' '}
                        {hudState.selectedTower.overheated
                          ? 'OVERHEATED (VENTING)'
                          : `${Math.round(hudState.selectedTower.heat * 100)}% HEAT`}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {(hudState.selectedTower.hp < hudState.selectedTower.maxHp ||
                        hudState.selectedTower.overheated ||
                        hudState.selectedTower.heat >= 0.25) && (
                        <button
                          type="button"
                          onClick={() => setRepairTowerSignal((n) => n + 1)}
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 transition-colors whitespace-nowrap shrink-0"
                        >
                          Repair & Vent (
                          {Math.max(
                            25,
                            Math.round(
                              Math.max(
                                0.25,
                                1 -
                                  hudState.selectedTower.hp /
                                    hudState.selectedTower.maxHp
                              ) * 75
                            )
                          )}{' '}
                          Scrap)
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          hudState.selectedTower.level >= 5 ||
                          scrap < selectedTowerStats.upgradeCostScrap
                        }
                        onClick={() => setUpgradeTowerSignal((n) => n + 1)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                          hudState.selectedTower.level < 5 &&
                          scrap >= selectedTowerStats.upgradeCostScrap
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        {hudState.selectedTower.level >= 5
                          ? 'Max Level'
                          : `Upgrade (${selectedTowerStats.upgradeCostScrap} Scrap)`}
                      </button>

                      <button
                        type="button"
                        onClick={() => setSellTowerSignal((n) => n + 1)}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        Salvage Tower
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="pointer-events-auto bg-slate-950/95 border border-slate-800 rounded-xl px-4 py-2.5 shadow-2xl flex items-center gap-3 shrink-0">
                    <button
                      type="button"
                      onClick={() => setNextWaveSignal((n) => n + 1)}
                      className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Call Next Wave Early
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ==================== PAUSE MODAL ==================== */}
          {gameState === 'paused' && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.86)' }}
              role="dialog"
              aria-label="Tactical Operations Paused"
            >
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                <h2 className="font-display text-3xl font-bold uppercase text-slate-100">
                  Tactical Operations Paused
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Sector: {activeSector.name} ({activeSector.city})
                </p>

                <div className="grid grid-cols-3 gap-3 my-5">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Endless Wave</div>
                    <div className="font-display text-2xl font-bold font-mono-tabular text-slate-100">
                      W{hudState.wave}{' '}
                      <span className="text-xs text-amber-400">
                        ×{hudState.threatMultiplier.toFixed(1)}
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">HQ HP</div>
                    <div className="font-display text-2xl font-bold font-mono-tabular text-emerald-400">
                      {hudState.baseHp}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">Scrap</div>
                    <div className="font-display text-2xl font-bold font-mono-tabular text-amber-400">
                      {Math.round(scrap)}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => setGameState('playing')}
                    className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                  >
                    Resume Defense
                  </button>
                  <button
                    type="button"
                    onClick={handleRestartGame}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Restart Sector Wave 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameState('title')}
                    className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 font-semibold text-xs rounded-lg border border-slate-800 transition-colors"
                  >
                    Return to Title Screen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ==================== VICTORY / GAME OVER MODAL ==================== */}
          {gameState === 'gameover' && runSnapshot && (
            <div
              className="fixed inset-0 z-40 flex items-center justify-center p-4"
              style={{ backgroundColor: 'rgba(9, 13, 22, 0.90)' }}
              role="dialog"
              aria-label={runSnapshot.victory ? 'Sector Secured Victory' : 'HQ Overrun Defeat'}
            >
              <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-2xl">
                <div className="text-xs font-mono-tabular uppercase text-amber-400">
                  {runSnapshot.sectorName}
                </div>
                <h2 className="font-display text-4xl font-bold uppercase text-slate-100 mt-0.5">
                  {runSnapshot.victory
                    ? 'Sector Secured: Victory'
                    : 'Command Base Overrun'}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {runSnapshot.victory
                    ? 'All zombie waves eliminated across urban corridors.'
                    : 'Hostile swarm breached the central HQ perimeter.'}
                </p>

                <div className="grid grid-cols-3 gap-3 my-5">
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">
                      Wave / Best
                    </div>
                    <div className="font-display text-2xl font-bold font-mono-tabular text-slate-100">
                      W{runSnapshot.waveReached} / W{runSnapshot.bestWave}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">
                      Hostiles Killed
                    </div>
                    <div className="font-display text-2xl font-bold font-mono-tabular text-rose-400">
                      {runSnapshot.zombiesEliminated}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
                    <div className="text-[10px] text-slate-400 uppercase">
                      Score / Best
                    </div>
                    <div className="font-display text-xl font-bold font-mono-tabular text-amber-400">
                      {runSnapshot.score} / {runSnapshot.bestScore}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2.5">
                  <button
                    type="button"
                    data-start="true"
                    onClick={handleRestartGame}
                    className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors"
                  >
                    {runSnapshot.victory ? 'Play Again' : 'Try Again'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsStoreModalOpen(true)}
                    className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 font-semibold text-xs rounded-lg transition-colors"
                  >
                    Upgrade Defenses in Armory
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameState('title')}
                    className="w-full py-2.5 bg-slate-950 hover:bg-slate-800 text-slate-400 font-semibold text-xs rounded-lg border border-slate-800 transition-colors"
                  >
                    Return to Title Screen
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modals */}
          <SectorMapModal
            isOpen={isSectorModalOpen}
            onClose={() => setIsSectorModalOpen(false)}
            sectors={sectors}
            activeSector={activeSector}
            isOfflineMode={isOfflineMode}
            onToggleOfflineMode={() => setIsOfflineMode((prev) => !prev)}
            onSelectSector={handleSelectSector}
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

          <FlutterCodeModal
            isOpen={isFlutterModalOpen}
            onClose={() => setIsFlutterModalOpen(false)}
          />
        </div>
      </div>
    </APIProvider>
  );
}
