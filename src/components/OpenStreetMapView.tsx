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
 * 1. Immediately renders a high-visibility cartographic urban street map (avenues, blocks,
 *    parks, waterways, and grid coordinates) so the map is never blank even offline.
 * 2. Asynchronously loads real OpenStreetMap / CARTO Voyager street tiles and composites them
 *    onto the tile canvas with crisp tactical contrast so streets, labels, and blocks are
 *    unmistakably visible under the game overlay.
 */
class OpenStreetMapCanvasGridLayer extends L.GridLayer {
  protected createTile(coords: L.Coords): HTMLElement {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const ctx = tile.getContext('2d');
    if (ctx) {
      // 1. Immediate high-contrast cartographic street map base
      ctx.fillStyle = '#162032';
      ctx.fillRect(0, 0, 256, 256);

      const seed = Math.abs(
        Math.sin(coords.x * 12.9898 + coords.y * 78.233 + coords.z * 37.719) *
          43758.5453
      );
      const frac = (n: number) => ((seed * n) % 1 + 1) % 1;

      // Green urban park block on some tiles
      if (frac(3.7) > 0.55) {
        ctx.fillStyle = '#14332b';
        ctx.fillRect(12, 12, 104, 104);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.strokeRect(12, 12, 104, 104);
      }

      // Detailed urban city blocks & rooftops
      for (let bx = 10; bx < 246; bx += 64) {
        for (let by = 10; by < 246; by += 64) {
          if (frac(3.7) > 0.55 && bx < 110 && by < 110) continue;
          const w = 42 + Math.floor(frac(bx + by) * 8);
          const h = 42 + Math.floor(frac(bx * 2 + by) * 8);
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(bx, by, w, h);
          ctx.strokeStyle = '#334155';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(bx, by, w, h);

          // Inner courtyard / rooftop detail
          ctx.fillStyle = '#263449';
          ctx.fillRect(bx + 6, by + 6, w - 12, h - 12);
        }
      }

      // Secondary local streets
      ctx.strokeStyle = '#334155';
      ctx.lineWidth = 5;
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

      // Primary arterial avenues (bright slate/amber road casing)
      ctx.strokeStyle = '#475569';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(248, 250, 252, 0.22)';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(128, 0);
      ctx.lineTo(128, 256);
      ctx.moveTo(0, 128);
      ctx.lineTo(256, 128);
      ctx.stroke();
      ctx.setLineDash([]);

      // Street name & OSM tile watermark
      ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.fillText(`SECTOR AVE ${Math.abs(coords.x % 99)}`, 134, 122);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.32)';
      ctx.fillText(`OSM ${coords.z}/${coords.x}/${coords.y}`, 8, 248);

      // 2. Load real OpenStreetMap / CARTO street tile and composite with high legibility
      const subdomains = ['a', 'b', 'c', 'd'];
      const sub = subdomains[Math.abs(coords.x + coords.y) % subdomains.length];
      const voyagerUrl = `https://${sub}.basemaps.cartocdn.com/rastertiles/voyager/${coords.z}/${coords.x}/${coords.y}.png`;
      const osmFallbackUrl = `https://tile.openstreetmap.org/${coords.z}/${coords.x}/${coords.y}.png`;

      const paintLoadedTile = (img: HTMLImageElement) => {
        ctx.save();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 256, 256);
        ctx.filter = 'invert(92%) hue-rotate(185deg) saturate(130%) contrast(108%) brightness(95%)';
        ctx.drawImage(img, 0, 0, 256, 256);
        ctx.restore();
      };

      const img = new Image();
      img.onload = () => paintLoadedTile(img);
      img.onerror = () => {
        const fallbackImg = new Image();
        fallbackImg.onload = () => paintLoadedTile(fallbackImg);
        fallbackImg.src = osmFallbackUrl;
      };
      img.src = voyagerUrl;
    }
    return tile;
  }
}

function createOpenStreetMapCanvasLayer(): L.GridLayer {
  return new OpenStreetMapCanvasGridLayer({
    tileSize: 256,
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
  });
}

/**
 * 100% Free OpenStreetMap Tactical Map Component powered by Leaflet.
 * Renders real-world OpenStreetMap streets, avenues, parks, and building blocks
 * with automatic ResizeObserver sizing so the map always loads cleanly in preview.
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

    createOpenStreetMapCanvasLayer().addTo(map);

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

  // Render real-road zombie approach polylines and optional HQ / Spawn markers
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
          color: '#ef4444',
          weight: interactive ? 5 : 3.5,
          opacity: interactive ? 0.88 : 0.65,
          dashArray: interactive ? undefined : '8 6',
        }).addTo(group);

        if (showSpawnMarkers) {
          const first = coords[0];
          const spawnIcon = L.divIcon({
            className: 'osm-spawn-pin',
            html: `<div style="padding:2px 6px;border-radius:4px;background:#e11d48;color:#fff;font-family:monospace;font-weight:700;font-size:10px;white-space:nowrap;border:1px solid #090d16;box-shadow:0 2px 6px rgba(0,0,0,0.6);">SPAWN: ${road.name}</div>`,
            iconSize: [120, 20],
            iconAnchor: [60, 10],
          });
          L.marker(first, { icon: spawnIcon, interactive: false }).addTo(group);
        }
      }
    }

    if (showSpawnMarkers) {
      const hqIcon = L.divIcon({
        className: 'osm-hq-pin',
        html: `<div style="padding:4px 8px;border-radius:4px;background:#f59e0b;color:#090d16;font-weight:800;font-size:11px;white-space:nowrap;border:1px solid #090d16;box-shadow:0 2px 8px rgba(0,0,0,0.75);">PRIMARY HQ BASE</div>`,
        iconSize: [140, 24],
        iconAnchor: [70, 12],
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
