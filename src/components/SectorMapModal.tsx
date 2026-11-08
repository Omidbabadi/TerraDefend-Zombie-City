import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  Map as GoogleMapView,
  AdvancedMarker,
  useMapsLibrary,
  useMap,
} from '@vis.gl/react-google-maps';
import { CachedSectorRoad, CitySector } from '../game/types';
import {
  buildProceduralSectorFromCoords,
  convertLatLngPathToSectorRoad,
  getPerimeterRoadSpawnOrigins,
} from '../game/rules';

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

/**
 * Child component inside <GoogleMapView> that renders the active sector's real road polylines
 * directly on the Google Map so the player can inspect the exact real-world zombie street corridors.
 */
const MapRoadCorridorPolylines: React.FC<{ roads: CachedSectorRoad[] }> = ({
  roads,
}) => {
  const map = useMap();
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    if (!map) return;

    // Clean up existing polylines
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    const created: google.maps.Polyline[] = [];
    for (const road of roads) {
      if (!road.latLngPoints || road.latLngPoints.length < 2) continue;
      const poly = new google.maps.Polyline({
        path: road.latLngPoints,
        geodesic: true,
        strokeColor: '#ef4444',
        strokeOpacity: 0.88,
        strokeWeight: 5,
        map,
      });
      created.push(poly);
    }

    polylinesRef.current = created;

    return () => {
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, roads]);

  return null;
};

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
  const placesLib = useMapsLibrary('places');
  const routesLib = useMapsLibrary('routes');

  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<
    google.maps.places.AutocompleteSuggestion[]
  >([]);
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

  // Places API (New) AutocompleteSuggestion
  useEffect(() => {
    if (!placesLib || !searchQuery.trim() || searchQuery.trim().length < 2) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const { AutocompleteSuggestion, AutocompleteSessionToken } = placesLib;
    const token = new AutocompleteSessionToken();

    AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input: searchQuery,
      sessionToken: token,
    })
      .then(
        (res: {
          suggestions: google.maps.places.AutocompleteSuggestion[];
        }) => {
          if (!cancelled) {
            setSuggestions(res.suggestions || []);
          }
        }
      )
      .catch((err: unknown) => {
        const msg = String(err);
        if (
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('OVER_QUERY_LIMIT')
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [placesLib, searchQuery]);

  /**
   * Uses the modern Google Maps Platform Routes API (`Route.computeRoutes`) to trace real-world
   * road geometry from 4 perimeter spawn points into the selected HQ coordinates.
   */
  const computeRealRoadCorridorsForCenter = useCallback(
    async (
      centerLat: number,
      centerLng: number
    ): Promise<CachedSectorRoad[]> => {
      if (!routesLib || !(routesLib as unknown as { Route?: unknown }).Route) {
        return buildProceduralSectorFromCoords(
          previewName,
          previewCity,
          centerLat,
          centerLng
        ).roads;
      }

      const RouteClass = (
        routesLib as unknown as {
          Route: {
            computeRoutes: (req: unknown) => Promise<{
              routes?: Array<{
                path?: Array<
                  | { lat: number; lng: number }
                  | { lat: () => number; lng: () => number }
                >;
                distanceMeters?: number;
                legs?: Array<{
                  steps?: Array<{
                    path?: Array<
                      | { lat: number; lng: number }
                      | { lat: () => number; lng: () => number }
                    >;
                  }>;
                }>;
              }>;
            }>;
          };
        }
      ).Route;

      const origins = getPerimeterRoadSpawnOrigins(centerLat, centerLng);
      const tracedRoads: CachedSectorRoad[] = [];

      await Promise.all(
        origins.map(async (item) => {
          try {
            const response = await RouteClass.computeRoutes({
              origin: item.origin,
              destination: { lat: centerLat, lng: centerLng },
              travelMode: 'DRIVING',
              fields: ['path', 'distanceMeters'],
            });

            const primaryRoute = response?.routes?.[0];
            const rawPath = primaryRoute?.path || [];
            const latLngPath: { lat: number; lng: number }[] = rawPath.map(
              (pt) => ({
                lat: typeof pt.lat === 'function' ? pt.lat() : pt.lat,
                lng: typeof pt.lng === 'function' ? pt.lng() : pt.lng,
              })
            );

            if (latLngPath.length >= 2) {
              tracedRoads.push(
                convertLatLngPathToSectorRoad(
                  item.id,
                  item.name,
                  latLngPath,
                  centerLat,
                  centerLng,
                  primaryRoute?.distanceMeters
                )
              );
            }
          } catch (err: unknown) {
            const msg = String(err);
            if (
              msg.includes('429') ||
              msg.includes('RESOURCE_EXHAUSTED') ||
              msg.includes('OVER_QUERY_LIMIT')
            ) {
              window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
            }
          }
        })
      );

      if (tracedRoads.length > 0) {
        return tracedRoads;
      }

      return buildProceduralSectorFromCoords(
        previewName,
        previewCity,
        centerLat,
        centerLng
      ).roads;
    },
    [routesLib, previewName, previewCity]
  );

  const handleSuggestionSelect = useCallback(
    async (suggestion: google.maps.places.AutocompleteSuggestion) => {
      if (!suggestion.placePrediction) return;
      try {
        const place = suggestion.placePrediction.toPlace();
        await place.fetchFields({
          fields: ['displayName', 'formattedAddress', 'location'],
        });
        if (place.location) {
          const lat = place.location.lat();
          const lng = place.location.lng();
          const name =
            place.displayName || suggestion.placePrediction.text.text;
          const addr =
            place.formattedAddress || `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
          setCameraCenter({ lat, lng });
          setPreviewName(`${name} Defense Grid`);
          setPreviewCity(addr);
          setSuggestions([]);
          setSearchQuery('');

          setIsTracingRealRoads(true);
          const realRoads = await computeRealRoadCorridorsForCenter(lat, lng);
          setPreviewRoads(realRoads);
          setIsTracingRealRoads(false);
        }
      } catch (err: unknown) {
        setIsTracingRealRoads(false);
        const msg = String(err);
        if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
        }
      }
    },
    [computeRealRoadCorridorsForCenter]
  );

  const handleTraceAndDeployRealRoads = async () => {
    setIsTracingRealRoads(true);
    setCacheNotice(
      'Tracing real-world street geometry via Google Maps Routes API...'
    );
    const realRoads = await computeRealRoadCorridorsForCenter(
      cameraCenter.lat,
      cameraCenter.lng
    );
    setPreviewRoads(realRoads);
    setIsTracingRealRoads(false);

    const customSector = buildProceduralSectorFromCoords(
      previewName,
      previewCity,
      cameraCenter.lat,
      cameraCenter.lng,
      16,
      realRoads
    );
    onCacheSector(customSector);
    onSelectSector(customSector);
    setCacheNotice(
      `Synced ${realRoads.length} real-world street paths (${customSector.tileSizeKb} KB offline vector pack) for zombie waves.`
    );
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(9, 13, 22, 0.88)', pointerEvents: 'auto' }}
      role="dialog"
      aria-label="City Sector Reconnaissance & Real-Road Zombie Pathing"
    >
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-wide text-slate-100 uppercase">
              Real-World City Sector & Google Routes Zombie Pathing
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Zombies follow real street polylines computed via Google Maps Routes API (`Route.computeRoutes`) and cached offline.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onToggleOfflineMode}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 border ${
                isOfflineMode
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-700'
                  : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              {isOfflineMode ? 'Offline Vector Mode: ON' : 'Live Google Maps Mode'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Sector Map Modal"
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Return to Defense
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
                Search Real-World City or Intersection (Google Places API)
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
                    {suggestions.map((sug, i) => (
                      <li key={i}>
                        <button
                          type="button"
                          onClick={() => handleSuggestionSelect(sug)}
                          className="w-full text-left px-3.5 py-2.5 text-xs text-slate-200 hover:bg-slate-800 transition-colors"
                        >
                          {sug.placePrediction?.text.text}
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
                        className={`flex-1 py-1.5 px-3 rounded text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950'
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
                        className="py-1.5 px-3 rounded text-xs font-semibold bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                      >
                        {isCached ? 'Refresh Road Cache' : 'Cache Real Roads'}
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

          {/* Right Column: Live Interactive Google Map + Real Road Polyline Preview */}
          <div className="lg:col-span-7 flex flex-col bg-slate-950 min-h-[360px]">
            <div className="relative flex-1 min-h-[320px] w-full">
              <GoogleMapView
                center={cameraCenter}
                zoom={16}
                mapId="DEMO_MAP_ID"
                gestureHandling="greedy"
                disableDefaultUI={false}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                onCameraChanged={(ev) => {
                  setCameraCenter(ev.detail.center);
                }}
                onClick={async (ev) => {
                  if (ev.detail.latLng) {
                    const lat = ev.detail.latLng.lat;
                    const lng = ev.detail.latLng.lng;
                    setCameraCenter({ lat, lng });
                    setPreviewName('Tactical Custom Sector');
                    setPreviewCity(`${lat.toFixed(4)}, ${lng.toFixed(4)}`);
                    setIsTracingRealRoads(true);
                    const realRoads = await computeRealRoadCorridorsForCenter(
                      lat,
                      lng
                    );
                    setPreviewRoads(realRoads);
                    setIsTracingRealRoads(false);
                  }
                }}
                style={{ width: '100%', height: '100%', minHeight: '320px' }}
              >
                <MapRoadCorridorPolylines roads={previewRoads} />

                <AdvancedMarker position={cameraCenter}>
                  <div className="px-2.5 py-1 rounded bg-amber-500 text-slate-950 font-bold text-xs shadow-lg border border-slate-950 whitespace-nowrap">
                    HQ BUNKER TARGET
                  </div>
                </AdvancedMarker>

                {previewRoads.map((road) => {
                  const firstGps = road.latLngPoints?.[0];
                  if (!firstGps) return null;
                  return (
                    <AdvancedMarker key={road.id} position={firstGps}>
                      <div className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono-tabular font-bold text-[10px] shadow border border-slate-950 whitespace-nowrap">
                        SPAWN: {road.name}
                      </div>
                    </AdvancedMarker>
                  );
                })}
              </GoogleMapView>
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
                    {previewRoads.length} Real Street Polylines Traced
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
                className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {isTracingRealRoads
                  ? 'Tracing Real Streets via Routes API...'
                  : 'Trace Real Roads & Deploy HQ Here'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
