import { CachedSectorRoad } from './types';
import {
  buildProceduralSectorFromCoords,
  convertLatLngPathToSectorRoad,
  getPerimeterRoadSpawnOrigins,
} from './rules';

export interface OsmPlaceSuggestion {
  placeId: string;
  displayName: string;
  shortName: string;
  cityOrAddress: string;
  lat: number;
  lng: number;
}

const INSTANT_FREE_CITY_INDEX: OsmPlaceSuggestion[] = [
  {
    placeId: 'osm_paris_eiffel',
    displayName: 'Champ de Mars & Pont d’Iéna, Paris, France',
    shortName: 'Champ de Mars Bastion',
    cityOrAddress: 'Paris, France',
    lat: 48.8584,
    lng: 2.2945,
  },
  {
    placeId: 'osm_sf_market',
    displayName: 'Market St & Montgomery St, San Francisco, CA, USA',
    shortName: 'Market St Financial Grid',
    cityOrAddress: 'San Francisco, USA',
    lat: 37.7891,
    lng: -122.4014,
  },
  {
    placeId: 'osm_seoul_gangnam',
    displayName: 'Gangnam-daero & Teheran-ro, Seoul, South Korea',
    shortName: 'Gangnam Station Hub',
    cityOrAddress: 'Seoul, South Korea',
    lat: 37.4979,
    lng: 127.0276,
  },
  {
    placeId: 'osm_berlin_alex',
    displayName: 'Alexanderplatz, Mitte, Berlin, Germany',
    shortName: 'Alexanderplatz Citadel',
    cityOrAddress: 'Berlin, Germany',
    lat: 52.5219,
    lng: 13.4132,
  },
  {
    placeId: 'osm_chicago_loop',
    displayName: 'State St & Madison St, The Loop, Chicago, IL, USA',
    shortName: 'Chicago Loop Sector',
    cityOrAddress: 'Chicago, USA',
    lat: 41.882,
    lng: -87.6278,
  },
];

/**
 * Searches real-world cities, streets, and intersections using the 100% free
 * OpenStreetMap Nominatim Geocoding API (no API key required).
 */
export async function searchOpenStreetMapPlaces(
  query: string
): Promise<OsmPlaceSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const lower = trimmed.toLowerCase();
  const localMatches = INSTANT_FREE_CITY_INDEX.filter(
    (item) =>
      item.displayName.toLowerCase().includes(lower) ||
      item.shortName.toLowerCase().includes(lower)
  );

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(
      trimmed
    )}&limit=5&addressdetails=1`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      return localMatches;
    }
    const data = (await response.json()) as Array<{
      place_id: number | string;
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
      address?: {
        road?: string;
        suburb?: string;
        city?: string;
        town?: string;
        country?: string;
      };
    }>;

    const results: OsmPlaceSuggestion[] = data
      .map((item) => {
        const lat = parseFloat(item.lat);
        const lng = parseFloat(item.lon);
        if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
        const primary =
          item.name ||
          item.address?.road ||
          item.address?.suburb ||
          item.display_name.split(',')[0] ||
          'Urban Sector';
        const cityPart =
          item.address?.city ||
          item.address?.town ||
          item.display_name.split(',').slice(1, 3).join(',').trim() ||
          `${lat.toFixed(4)}, ${lng.toFixed(4)}`;

        return {
          placeId: String(item.place_id),
          displayName: item.display_name,
          shortName: `${primary} Defense Grid`,
          cityOrAddress: cityPart,
          lat,
          lng,
        };
      })
      .filter((x): x is OsmPlaceSuggestion => x !== null);

    return results.length > 0 ? results : localMatches;
  } catch {
    return localMatches;
  }
}

/**
 * Traces real-world street geometry from 4 perimeter spawn origins into the HQ center
 * using the 100% free Open Source Routing Machine (OSRM) API backed by OpenStreetMap data.
 */
export async function traceRealRoadsWithOSRM(
  centerLat: number,
  centerLng: number,
  fallbackName = 'Custom Tactical Sector',
  fallbackCity = 'OpenStreetMap Grid'
): Promise<CachedSectorRoad[]> {
  const origins = getPerimeterRoadSpawnOrigins(centerLat, centerLng);
  const tracedRoads: CachedSectorRoad[] = [];

  await Promise.all(
    origins.map(async (item) => {
      try {
        const url = `https://router.project-osrm.org/route/v1/foot/${item.origin.lng},${item.origin.lat};${centerLng},${centerLat}?overview=full&geometries=geojson&steps=true`;
        const response = await fetch(url);
        if (!response.ok) return;

        const data = (await response.json()) as {
          code?: string;
          routes?: Array<{
            distance?: number;
            geometry?: {
              coordinates?: [number, number][];
            };
            legs?: Array<{
              steps?: Array<{
                name?: string;
              }>;
            }>;
          }>;
        };

        const route = data?.routes?.[0];
        const coords = route?.geometry?.coordinates;
        if (!coords || coords.length < 2) return;

        const latLngPath = coords.map(([lng, lat]) => ({ lat, lng }));

        // Extract real street names from OpenStreetMap OSRM steps
        const stepNames = (route.legs?.[0]?.steps || [])
          .map((s) => (s.name || '').trim())
          .filter((n) => n.length >= 3 && n.length <= 28);
        const uniqueStreetNames = Array.from(new Set(stepNames));
        const roadName =
          uniqueStreetNames.length > 0
            ? `${uniqueStreetNames.slice(0, 2).join(' -> ')} (OSM)`
            : item.name;

        tracedRoads.push(
          convertLatLngPathToSectorRoad(
            item.id,
            roadName,
            latLngPath,
            centerLat,
            centerLng,
            route.distance ? Math.round(route.distance) : undefined
          )
        );
      } catch {
        // Ignore individual network failures; fallback handled below
      }
    })
  );

  if (tracedRoads.length > 0) {
    return tracedRoads;
  }

  return buildProceduralSectorFromCoords(
    fallbackName,
    fallbackCity,
    centerLat,
    centerLng
  ).roads;
}
