import React, { useEffect, useState, useCallback } from 'react';
import { CachedSectorRoad, CitySector } from '../game/types';
import { buildProceduralSectorFromCoords } from '../game/rules';
import {
  OsmPlaceSuggestion,
  searchOpenStreetMapPlaces,
  traceRealRoadsWithOSRM,
} from '../game/osmService';
import { OpenStreetMapView } from './OpenStreetMapView';

interface SectorMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectors: CitySector[];
  activeSector: CitySector;
  isOfflineMode: boolean;
  onToggleOfflineMode: () => void;
  onSelectSector: (sector: CitySector) => void;
  onCacheSector: (sector: CitySector) => void;
}

export const SectorMapModal: React.FC<SectorMapModalProps> = ({
  isOpen,
  onClose,
  sectors,
  activeSector,
  isOfflineMode,
  onToggleOfflineMode,
  onSelectSector,
  onCacheSector,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<OsmPlaceSuggestion[]>([]);
  const [cameraCenter, setCameraCenter] = useState<{ lat: number; lng: number }>({
    lat: activeSector.lat,
    lng: activeSector.lng,
  });
  const [previewName, setPreviewName] = useState(activeSector.name);
  const [previewCity, setPreviewCity] = useState(activeSector.city);
  const [previewRoads, setPreviewRoads] = useState<CachedSectorRoad[]>(
    activeSector.roads
  );
  const [isTracingRealRoads, setIsTracingRealRoads] = useState(false);
  const [cacheNotice, setCacheNotice] = useState<string | null>(null);

  useEffect(() => {
    setCameraCenter({ lat: activeSector.lat, lng: activeSector.lng });
    setPreviewName(activeSector.name);
    setPreviewCity(activeSector.city);
    setPreviewRoads(activeSector.roads);
  }, [activeSector]);

  // Free OpenStreetMap Nominatim Geocoding Search (with instant preset fallback)
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      searchOpenStreetMapPlaces(searchQuery).then((res) => {
        if (!cancelled) {
          setSuggestions(res);
        }
      });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSuggestionSelect = useCallback(
    async (suggestion: OsmPlaceSuggestion) => {
      setCameraCenter({ lat: suggestion.lat, lng: suggestion.lng });
      setPreviewName(suggestion.shortName);
      setPreviewCity(suggestion.cityOrAddress);
      setSuggestions([]);
      setSearchQuery('');

      setIsTracingRealRoads(true);
      const realRoads = await traceRealRoadsWithOSRM(
        suggestion.lat,
        suggestion.lng,
        suggestion.shortName,
        suggestion.cityOrAddress
      );
      setPreviewRoads(realRoads);
      setIsTracingRealRoads(false);
    },
    []
  );

  const handleMapLocationPick = useCallback(
    async (lat: number, lng: number) => {
      setCameraCenter({ lat, lng });
      setPreviewName('Tactical OpenStreetMap Sector');
      setPreviewCity(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
      setIsTracingRealRoads(true);
      const realRoads = await traceRealRoadsWithOSRM(
        lat,
        lng,
        'Tactical OpenStreetMap Sector',
        `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      );
      setPreviewRoads(realRoads);
      setIsTracingRealRoads(false);
    },
    []
  );

  const handleTraceAndDeployRealRoads = async () => {
    setIsTracingRealRoads(true);
    setCacheNotice(
      'Tracing real-world street geometry via free OpenStreetMap OSRM router...'
    );
    const realRoads = await traceRealRoadsWithOSRM(
      cameraCenter.lat,
      cameraCenter.lng,
      previewName,
      previewCity
    );
    setPreviewRoads(realRoads);
    setIsTracingRealRoads(false);

    const customSector = buildProceduralSectorFromCoords(
      `${previewName} (Full Satellite Map)`,
      previewCity,
      cameraCenter.lat,
      cameraCenter.lng,
      14,
      realRoads
    );
    onCacheSector(customSector);
    onSelectSector(customSector);
    setCacheNotice(
      `Synced ${realRoads.length} real city road highways (${customSector.tileSizeKb} KB satellite + road pack) for Units & Zombies.`
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:p-4"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)', pointerEvents: 'auto' }}
      role="dialog"
      aria-label="Choose Whole City Satellite Map & Real-Road Network"
    >
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="font-display text-xl sm:text-2xl font-bold tracking-wide text-slate-100 uppercase">
              Choose Whole City (Satellite Map &amp; Real-Road Network)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Start in your central Square HQ Zone and capture the whole city on Satellite Maps. Buildings place outside roads only; all Units &amp; Zombies strictly use real roads.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleOfflineMode}
              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                isOfflineMode
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isOfflineMode
                ? 'Offline Vector Mode: ON'
                : 'Live Satellite Map Mode'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Sector Map Modal"
              className="min-h-[44px] px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors whitespace-nowrap shrink-0"
            >
              Done
            </button>
          </div>
        </div>

        {/* Body Split */}
        <div className="grid grid-cols-1 lg:grid-cols-12 flex-1 min-h-0 overflow-y-auto lg:overflow-hidden">
          {/* Left Column: Preset & Cached City Sectors */}
          <div className="lg:col-span-5 p-5 border-b lg:border-b-0 lg:border-r border-slate-800 flex flex-col gap-4 overflow-y-auto">
            <div>
              <label
                htmlFor="city-search-input"
                className="block text-xs font-semibold text-slate-300 mb-1.5"
              >
                Search Real-World City or Intersection (Free Nominatim OSM)
              </label>
              <div className="relative">
                <input
                  id="city-search-input"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Type a city (e.g. Paris, San Francisco, Seoul)..."
                  className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-lg text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
                {suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto divide-y divide-slate-800">
                    {suggestions.map((sug) => (
                      <li key={sug.placeId}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionSelect(sug)}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          {sug.displayName}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
              <span>Real-Road Cached Sectors ({sectors.length})</span>
              <span className="font-mono-tabular text-emerald-400">
                {previewRoads.length} Real Streets Active
              </span>
            </div>

            <div className="space-y-2.5">
              {sectors.map((sector) => {
                const isSelected = sector.id === activeSector.id;
                const isCached = sector.cachedAt !== null;
                return (
                  <div
                    key={sector.id}
                    className={`p-3.5 rounded-lg border transition-colors ${
                      isSelected
                        ? 'bg-slate-800/90 border-amber-500/80'
                        : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-100">
                          {sector.name}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {sector.city} ·{' '}
                          <span className="font-mono-tabular">
                            {sector.roads.length} Real Road Paths
                          </span>
                        </div>
                      </div>
                      <span className="text-xs font-mono-tabular text-slate-400">
                        {isCached ? 'CACHED' : 'UNCACHED'} ·{' '}
                        {(sector.tileSizeKb / 1024).toFixed(1)} MB
                      </span>
                    </div>

                    <div className="text-xs text-amber-400/90 mt-1.5">
                      {sector.threatRating}
                    </div>

                    {/* Road Corridor Names */}
                    <div className="text-[11px] text-slate-400 mt-1 truncate">
                      Streets: {sector.roads.map((r) => r.name).join(' · ')}
                    </div>

                    <div className="flex items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => {
                          onSelectSector(sector);
                          setCameraCenter({ lat: sector.lat, lng: sector.lng });
                          setPreviewRoads(sector.roads);
                        }}
                        className={`min-h-[44px] flex-1 py-2 px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 font-bold'
                            : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {isSelected ? 'Active Sector' : 'Deploy to Sector'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onCacheSector({ ...sector, cachedAt: Date.now() });
                          setCacheNotice(
                            `Offline real-road polyline package verified for ${sector.name}.`
                          );
                        }}
                        className="min-h-[44px] py-2 px-3 rounded-xl text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isCached ? 'Refresh Cache' : 'Cache Roads'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {cacheNotice && (
              <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-200">
                {cacheNotice}
              </div>
            )}
          </div>

          {/* Right Column: Live Interactive Free OpenStreetMap + Real Road Polyline Preview */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950 min-h-[360px]">
            <div className="relative flex-1 min-h-[320px] w-full">
              <OpenStreetMapView
                center={cameraCenter}
                zoom={16}
                roads={previewRoads}
                interactive={true}
                showSpawnMarkers={true}
                onSelectLocation={handleMapLocationPick}
              />
            </div>

            {/* Bottom Action Bar for Map Coordinates & Real Road Sync */}
            <div className="p-4 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">
                  HQ Target ·{' '}
                  <span className="font-mono-tabular text-slate-200">
                    LAT {cameraCenter.lat.toFixed(4)} · LNG{' '}
                    {cameraCenter.lng.toFixed(4)}
                  </span>{' '}
                  ·{' '}
                  <span className="text-rose-400 font-semibold">
                    {previewRoads.length} Real OSM Street Polylines Traced
                  </span>
                </div>
                <div className="text-sm font-semibold text-slate-100">
                  {previewName} ({previewCity})
                </div>
              </div>
              <button
                type="button"
                disabled={isTracingRealRoads}
                onClick={handleTraceAndDeployRealRoads}
                className="min-h-[44px] px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl transition-colors whitespace-nowrap shrink-0"
              >
                {isTracingRealRoads
                  ? 'Tracing Real Streets via OSRM...'
                  : 'Trace Real Roads & Deploy HQ Here'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
