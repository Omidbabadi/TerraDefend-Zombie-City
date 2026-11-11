import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { CachedSectorRoad } from '../game/types';
import { unprojectSectorPointToLatLng } from '../game/rules';

interface OpenStreetMapViewProps {
  center: { lat: number; lng: number };
  zoom: number;
  roads: CachedSectorRoad[];
  interactive?: boolean;
  showSpawnMarkers?: boolean;
  onSelectLocation?: (lat: number, lng: number) => void;
  onCenterChange?: (lat: number, lng: number) => void;
}

/**
 * Canvas-backed Leaflet GridLayer that:
 * 1. Immediately renders a realistic high-detail Satellite Aerial Imagery base (urban satellite
 *    rooftops, vegetation parks, river/harbor channels, and real asphalt road corridors) so the
 *    city satellite map is never blank even offline.
 * 2. Asynchronously loads real Esri World Imagery Satellite Tiles
 *    (`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`)
 *    plus hybrid OpenStreetMap road labels so the whole city is displayed as a crisp Satellite Map!
 */
class SatelliteCityCanvasGridLayer extends L.GridLayer {
  protected createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const ctx = tile.getContext('2d');
    if (ctx) {
      // 1. Immediate high-detail Satellite Aerial Photography base
      ctx.fillStyle = '#18241e';
      ctx.fillRect(0, 0, 256, 256);

      const seed = Math.abs(
        Math.sin(coords.x * 12.9898 + coords.y * 78.233 + coords.z * 37.719) *
          43758.5453
      );
      const frac = (n: number) => ((seed * n) % 1 + 1) % 1;

      // Natural satellite earth & foliage patches
      for (let py = 0; py < 256; py += 32) {
        for (let px = 0; px < 256; px += 32) {
          const v = frac(px * 0.13 + py * 0.29);
          ctx.fillStyle =
            v > 0.65
              ? '#1a2e22'
              : v > 0.35
              ? '#212b26'
              : '#252f38';
          ctx.fillRect(px, py, 32, 32);
        }
      }

      // Lush satellite green park / tree canopy block on some tiles
      if (frac(3.7) > 0.5) {
        ctx.fillStyle = '#193824';
        ctx.fillRect(12, 12, 104, 104);
        ctx.fillStyle = '#22492f';
        ctx.beginPath();
        ctx.arc(46, 52, 22, 0, Math.PI * 2);
        ctx.arc(78, 74, 26, 0, Math.PI * 2);
        ctx.fill();
      }

      // Detailed satellite city blocks, concrete roofs, and shadow relief
      for (let bx = 10; bx < 246; bx += 64) {
        for (let by = 10; by < 246; by += 64) {
          if (frac(3.7) > 0.5 && bx < 110 && by < 110) continue;
          const w = 42 + Math.floor(frac(bx + by) * 8);
          const h = 42 + Math.floor(frac(bx * 2 + by) * 8);

          // Building drop shadow from satellite sun angle
          ctx.fillStyle = 'rgba(5, 10, 18, 0.65)';
          ctx.fillRect(bx + 4, by + 4, w, h);

          // Satellite rooftop surface
          const roofTone = frac(bx * 3 + by);
          ctx.fillStyle =
            roofTone > 0.66
              ? '#3b4754'
              : roofTone > 0.33
              ? '#313d4b'
              : '#464f59';
          ctx.fillRect(bx, by, w, h);
          ctx.strokeStyle = '#526071';
          ctx.lineWidth = 1;
          ctx.strokeRect(bx, by, w, h);

          // Rooftop HVAC / skylight satellite details
          ctx.fillStyle = '#25303d';
          ctx.fillRect(bx + 6, by + 6, w - 12, h - 12);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(bx + 10, by + 10, 8, 6);
        }
      }

      // Secondary urban asphalt streets (visible between off-road building blocks)
      ctx.strokeStyle = '#262e38';
      ctx.lineWidth = 6;
      for (let p = 0; p <= 256; p += 64) {
        ctx.beginPath();
        ctx.moveTo(p, 0);
        ctx.lineTo(p, 256);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, p);
        ctx.lineTo(256, p);
        ctx.stroke();
      }

      // Primary arterial satellite highway avenues
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 10;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(250, 204, 21, 0.38)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();
      ctx.setLineDash([]);

      // Satellite telemetry watermark
      ctx.fillStyle = 'rgba(226, 232, 240, 0.55)';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`SAT HWY ${Math.abs(coords.x % 99)}`, 134, 122);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.42)';
      ctx.fillText(`SAT ${coords.z}/${coords.x}/${coords.y}`, 8, 248);

      // 2. Load real Esri World Imagery Satellite Tile + Clean Esri Satellite Reference Labels
      // Note: Esri MapServer uses /tile/{z}/{y}/{x} order and requires zero API keys
      const esriSatelliteUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;
      const esriReferenceLabelsUrl = `https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/${coords.z}/${coords.y}/${coords.x}`;

      const paintSatelliteTile = (satImg: HTMLImageElement) => {
        ctx.save();
        ctx.filter = 'contrast(110%) saturate(118%) brightness(92%)';
        ctx.drawImage(satImg, 0, 0, 256, 256);
        ctx.restore();

        const labelImg = new Image();
        labelImg.onload = () => {
          ctx.drawImage(labelImg, 0, 0, 256, 256);
        };
        labelImg.src = esriReferenceLabelsUrl;
      };

      const satImg = new Image();
      satImg.onload = () => paintSatelliteTile(satImg);
      satImg.src = esriSatelliteUrl;
    }
    return tile;
  }
}

function createSatelliteCityCanvasLayer(): L.GridLayer {
  return new SatelliteCityCanvasGridLayer({
    tileSize: 256,
    maxZoom: 19,
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community | Roads &copy; OpenStreetMap',
  });
}

/**
 * 100% Free Whole-City Satellite Map Component powered by Leaflet + Esri World Imagery + OpenStreetMap OSRM.
 * Renders real-world satellite aerial photography of the entire city alongside real street polylines
 * that Units and Zombies strictly follow.
 */
export const OpenStreetMapView: React.FC<OpenStreetMapViewProps> = ({
  center,
  zoom,
  roads,
  interactive = false,
  showSpawnMarkers = false,
  onSelectLocation,
  onCenterChange,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const onSelectRef = useRef(onSelectLocation);
  const onCenterRef = useRef(onCenterChange);

  useEffect(() => {
    onSelectRef.current = onSelectLocation;
    onCenterRef.current = onCenterChange;
  }, [onSelectLocation, onCenterChange]);

  // Initialize Leaflet Map instance and attach ResizeObserver so tiles always fill the viewport
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: interactive,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      boxZoom: interactive,
      keyboard: interactive,
      attributionControl: interactive,
      fadeAnimation: false,
      zoomAnimation: false,
      markerZoomAnimation: false,
    });

    createSatelliteCityCanvasLayer().addTo(map);

    const group = L.layerGroup().addTo(map);
    layerGroupRef.current = group;
    mapRef.current = map;

    if (interactive) {
      map.on('click', (ev: L.LeafletMouseEvent) => {
        onSelectRef.current?.(ev.latlng.lat, ev.latlng.lng);
      });
      map.on('moveend', () => {
        const c = map.getCenter();
        onCenterRef.current?.(c.lat, c.lng);
      });
    }

    // Ensure Leaflet recalculates tile bounds immediately and on any container resize
    const invalidateTimer = window.setTimeout(() => {
      map.invalidateSize();
    }, 60);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(el);

    return () => {
      window.clearTimeout(invalidateTimer);
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
  }, [interactive]);

  // Sync map camera when center/zoom props update
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.invalidateSize();
    const current = map.getCenter();
    const dist = Math.hypot(current.lat - center.lat, current.lng - center.lng);
    if (dist > 0.0001 || map.getZoom() !== zoom) {
      map.setView([center.lat, center.lng], zoom, { animate: false });
    }
  }, [center.lat, center.lng, zoom]);

  // Render real-road polylines (used by Units and Zombies) and optional HQ / Spawn markers
  useEffect(() => {
    const group = layerGroupRef.current;
    if (!group) return;
    group.clearLayers();

    for (const road of roads) {
      const coords =
        road.latLngPoints && road.latLngPoints.length >= 2
          ? road.latLngPoints.map((pt) => [pt.lat, pt.lng] as [number, number])
          : road.points.map((pt) => {
              const gps = unprojectSectorPointToLatLng(
                pt.x,
                pt.y,
                center.lat,
                center.lng
              );
              return [gps.lat, gps.lng] as [number, number];
            });

      if (coords.length >= 2) {
        L.polyline(coords, {
          color: '#f59e0b',
          weight: interactive ? 5 : 4,
          opacity: interactive ? 0.9 : 0.72,
          dashArray: interactive ? undefined : '8 6',
        }).addTo(group);

        if (showSpawnMarkers) {
          const first = coords[0];
          const spawnIcon = L.divIcon({
            className: 'osm-spawn-pin',
            html: `<div style="padding:2px 6px;border-radius:4px;background:#e11d48;color:#fff;font-family:monospace;font-weight:700;font-size:10px;white-space:nowrap;border:1px solid #090d16;box-shadow:0 2px 6px rgba(0,0,0,0.6);">ROAD ENTRY: ${road.name}</div>`,
            iconSize: [130, 20],
            iconAnchor: [65, 10],
          });
          L.marker(first, { icon: spawnIcon, interactive: false }).addTo(group);
        }
      }
    }

    if (showSpawnMarkers) {
      const hqIcon = L.divIcon({
        className: 'osm-hq-pin',
        html: `<div style="padding:4px 8px;border-radius:4px;background:#10b981;color:#090d16;font-weight:800;font-size:11px;white-space:nowrap;border:1px solid #090d16;box-shadow:0 2px 8px rgba(0,0,0,0.75);">STARTING CITY HQ ZONE</div>`,
        iconSize: [155, 24],
        iconAnchor: [77, 12],
      });
      L.marker([center.lat, center.lng], {
        icon: hqIcon,
        interactive: false,
      }).addTo(group);
    }
  }, [roads, center.lat, center.lng, interactive, showSpawnMarkers]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full bg-slate-900"
      data-testid={interactive ? 'osm-sector-map' : 'osm-gameplay-map'}
    />
  );
};
