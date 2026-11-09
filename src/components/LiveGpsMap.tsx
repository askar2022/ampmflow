"use client";

import { useEffect, useId, useRef } from "react";
import type { LatLngExpression, Map as LeafletMap, Marker } from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapMarker = {
  id: string;
  label: string;
  lat: number;
  lng: number;
  kind: "bus" | "school";
};

function busIconHtml(label: string) {
  return `<div style="background:#f5c518;color:#0b2942;font:700 11px/1.1 system-ui,sans-serif;padding:6px 8px;border-radius:12px;border:2px solid #fff;box-shadow:0 6px 14px rgba(11,41,66,.22);white-space:nowrap;">${label}</div>`;
}

function schoolIconHtml() {
  return `<div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-4px);">
    <div style="background:#dc2626;color:#fff;font:700 11px/1 system-ui,sans-serif;padding:5px 8px;border-radius:8px;box-shadow:0 4px 10px rgba(0,0,0,.25);">School</div>
    <div style="width:0;height:0;border-left:7px solid transparent;border-right:7px solid transparent;border-top:8px solid #dc2626;"></div>
  </div>`;
}

export function LiveGpsMap({
  markers,
  className = "",
}: {
  markers: MapMarker[];
  className?: string;
}) {
  const mapId = useId().replace(/:/g, "");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRefs = useRef<Marker[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function setup() {
      if (!containerRef.current || mapRef.current) return;
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      mapRef.current = map;
      // Force size after layout.
      window.setTimeout(() => map.invalidateSize(), 50);
    }

    void setup();
    return () => {
      cancelled = true;
      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function syncMarkers() {
      const map = mapRef.current;
      if (!map) {
        // Map may still be initializing.
        window.setTimeout(() => {
          if (!cancelled) void syncMarkers();
        }, 80);
        return;
      }
      const L = await import("leaflet");
      if (cancelled) return;

      markerRefs.current.forEach((marker) => marker.remove());
      markerRefs.current = [];

      const points: LatLngExpression[] = [];
      for (const item of markers) {
        if (!Number.isFinite(item.lat) || !Number.isFinite(item.lng)) continue;
        const latLng: LatLngExpression = [item.lat, item.lng];
        points.push(latLng);
        const icon = L.divIcon({
          className: "",
          html:
            item.kind === "school"
              ? schoolIconHtml()
              : busIconHtml(item.label),
          iconSize: item.kind === "school" ? [64, 36] : [72, 28],
          iconAnchor: item.kind === "school" ? [32, 36] : [36, 14],
        });
        const marker = L.marker(latLng, { icon }).addTo(map);
        marker.bindTooltip(item.label, { direction: "top", opacity: 0.95 });
        markerRefs.current.push(marker);
      }

      if (points.length === 1) {
        map.setView(points[0], 13);
      } else if (points.length > 1) {
        map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 14 });
      } else {
        map.setView([44.950661, -93.257431], 12);
      }
      map.invalidateSize();
    }

    void syncMarkers();
    return () => {
      cancelled = true;
    };
  }, [markers]);

  return (
    <div className={`relative min-h-[320px] lg:min-h-[420px] ${className}`}>
      <div
        id={`live-gps-map-${mapId}`}
        ref={containerRef}
        className="absolute inset-0 z-0 h-full w-full"
      />
    </div>
  );
}
