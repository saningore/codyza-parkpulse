"use client";

import { useEffect, useState } from "react";
import type { FeatureCollection, MapPoint } from "@/lib/types";

const KIND_LABEL = { park: "Park point", "visitor-center": "Visitor center", campground: "Campground" } as const;

export default function ParkMap({ boundary, points }: { boundary: FeatureCollection | null; points: MapPoint[] }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let map: import("maplibre-gl").Map | undefined;
    const markers: import("maplibre-gl").Marker[] = [];
    let alive = true;
    (async () => {
      try {
        const lib = await import("maplibre-gl");
        if (!alive) return;
        // Next serves this library from a chunk, so the default sibling worker URL 404s.
        lib.setWorkerUrl("/maplibre-gl-worker.mjs");
        const first = points[0];
        map = new lib.Map({
          container: "park-map",
          style: "https://tiles.openfreemap.org/styles/liberty",
          center: first ? [first.longitude, first.latitude] : [-98.5, 39.8],
          zoom: first ? 8 : 3,
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (!alive || !map) return;
          if (boundary) {
            map.addSource("boundary", { type: "geojson", data: boundary as unknown as import("geojson").FeatureCollection });
            map.addLayer({ id: "boundary-fill", type: "fill", source: "boundary", paint: { "fill-color": "#1e5c3a", "fill-opacity": 0.15 } });
            map.addLayer({ id: "boundary-line", type: "line", source: "boundary", paint: { "line-color": "#143d27", "line-width": 2 } });
          }
          const bounds = new lib.LngLatBounds();
          if (boundary) extendBounds(bounds, boundary);
          for (const point of points) {
            bounds.extend([point.longitude, point.latitude]);
            const button = document.createElement("button");
            button.type = "button";
            button.className = "map-pin";
            button.dataset.kind = point.kind;
            button.textContent = point.kind === "campground" ? "Camp" : point.kind === "visitor-center" ? "Visit" : "Park";
            button.setAttribute("aria-label", `${KIND_LABEL[point.kind]}: ${point.name}`);
            const content = document.createElement("div");
            const title = document.createElement("p");
            title.className = "map-popup-title";
            title.textContent = point.name;
            const kind = document.createElement("p");
            kind.className = "map-popup-kind";
            kind.textContent = KIND_LABEL[point.kind];
            content.append(title, kind);
            if (point.href) {
              const link = document.createElement("a");
              link.className = "map-popup-link";
              link.href = point.href;
              link.target = "_blank";
              link.rel = "noopener noreferrer";
              link.textContent = "Official page";
              content.append(link);
            }
            const marker = new lib.Marker({ element: button }).setLngLat([point.longitude, point.latitude]).setPopup(new lib.Popup({ offset: 16 }).setDOMContent(content)).addTo(map);
            markers.push(marker);
          }
          if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 48, maxZoom: 11, duration: 0 });
          setReady(true);
        });
      } catch {
        if (alive) setFailed(true);
      }
    })();
    return () => {
      alive = false;
      markers.forEach((marker) => marker.remove());
      map?.remove();
    };
  }, [boundary, points]);

  if (failed) return <p>The map could not be loaded. The lists below still include places that have coordinates.</p>;

  return (
    <div>
      <div id="park-map" data-map-ready={ready ? "true" : "false"} className="h-[420px] rounded-3xl border border-line bg-mist" role="region" aria-label="Park map" />
      <ul className="mt-3 flex flex-wrap gap-3 text-sm font-bold" aria-label="Map legend">
        <li>Park point</li>
        <li>Visit — visitor center</li>
        <li>Camp — campground</li>
      </ul>
      <p className="mt-2 text-xs text-ink/70">Map data © OpenStreetMap contributors, via OpenFreeMap. The outline is the National Park Service boundary when it loads.</p>
    </div>
  );
}

function extendBounds(bounds: { extend: (coordinate: [number, number]) => void }, collection: FeatureCollection) {
  for (const feature of collection.features) walk(bounds, feature.geometry.coordinates);
}

function walk(bounds: { extend: (coordinate: [number, number]) => void }, coordinates: unknown) {
  if (!Array.isArray(coordinates)) return;
  if (typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
    bounds.extend([coordinates[0], coordinates[1]]);
    return;
  }
  for (const child of coordinates) walk(bounds, child);
}
