import { useState } from "react";
import type { MapLayerMouseEvent } from "react-map-gl/maplibre";

export interface SelectedTrecho {
  id: string;
  lng: number;
  lat: number;
}

export function useTrechoInteraction() {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedTrecho | null>(null);

  function onMouseMove(e: MapLayerMouseEvent) {
    setHoveredId(e.features?.[0]?.properties.id ?? null);
  }

  function onMouseLeave() {
    setHoveredId(null);
  }

  function onClick(e: MapLayerMouseEvent) {
    const feature = e.features?.[0];
    setSelected(
      feature
        ? {
            id: String(feature.properties.id),
            lng: e.lngLat.lng,
            lat: e.lngLat.lat,
          }
        : null,
    );
  }

  function closePopup() {
    setSelected(null);
  }

  return {
    hoveredId,
    selected,
    onMouseMove,
    onMouseLeave,
    onClick,
    closePopup,
  };
}
