import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { PresetData, PresetMarker } from '../data/presets';
import { Map3DOverlay } from './Map3DOverlay';

// Fix for default Leaflet icon paths in React compile outputs
// Standard Leaflet markers can look broken without resetting asset paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface InteractiveLeafletMapProps {
  preset: PresetData;
  customGeoJSON: any | null; // loaded GeoJSON file if any
  mapStyle: 'satellite' | 'terrain' | 'dark' | 'light';
  tiltAngle: number;
  tiltFactor: number;
  buildingColor: string;
  lightAngle: number;
  heightProperty: string;
  defaultHeight: number;
  hoveredBuilding: any | null;
  onHoverBuilding: (b: any | null) => void;
}

export const InteractiveLeafletMap: React.FC<InteractiveLeafletMapProps> = ({
  preset,
  customGeoJSON,
  mapStyle,
  tiltAngle,
  tiltFactor,
  buildingColor,
  lightAngle,
  heightProperty,
  defaultHeight,
  hoveredBuilding,
  onHoverBuilding,
}) => {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const [map, setMap] = useState<L.Map | null>(null);
  
  // Keep track of layers to clean up correctly
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const geoJSONLayerRef = useRef<L.GeoJSON | null>(null);
  const markersRef = useRef<L.Marker[]>([]);

  // Resolve active GeoJSON features
  const activeGeoJSON = customGeoJSON || preset.geojson;

  // 1. Initialise Map Instance
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Create a fresh Leaflet map
    const mapInstance = L.map(container, {
      center: preset.center,
      zoom: preset.zoom,
      zoomControl: false, // Custom position
      attributionControl: false, // clean workspace
    });

    // Custom crisp navigation controls
    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    setMap(mapInstance);

    return () => {
      mapInstance.remove();
      setMap(null);
    };
  }, []); // Only run once on mount

  // 2. Adjust Map View when Preset center changes
  useEffect(() => {
    if (!map) return;
    
    if (customGeoJSON) {
      // Find bounding box and fit bounds automatically for custom files!
      try {
        const tempGeoJSONLayer = L.geoJSON(customGeoJSON);
        const bounds = tempGeoJSONLayer.getBounds();
        if (bounds.isValid()) {
          map.fitBounds(bounds, { padding: [40, 40] });
        }
      } catch (err) {
        console.error('Error fitting bounds of custom GeoJSON:', err);
        map.setView(preset.center, preset.zoom);
      }
    } else {
      map.setView(preset.center, preset.zoom);
    }
  }, [map, preset, customGeoJSON]);

  // 3. Update Tile Base Layers
  useEffect(() => {
    if (!map) return;

    // Clear old base tile if exists
    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    let url = '';
    
    // Choose high-quality base satellite, topographic, or minimalist maps
    if (mapStyle === 'satellite') {
      // ESRI World Imagery
      url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
    } else if (mapStyle === 'terrain') {
      // OpenTopoMap
      url = 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png';
    } else if (mapStyle === 'dark') {
      // CartoDB Dark Matter
      url = 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';
    } else {
      // CartoDB Positron Light Minimalist
      url = 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';
    }

    const newTile = L.tileLayer(url, {
      maxZoom: 18,
    });
    newTile.addTo(map);
    tileLayerRef.current = newTile;
  }, [map, mapStyle]);

  // 4. Render Flat Layers (Water, Parks) under 3D Structures
  useEffect(() => {
    if (!map) return;

    // Clean up old overlay vector layers
    if (geoJSONLayerRef.current) {
      map.removeLayer(geoJSONLayerRef.current);
    }

    // Filter only flat features (Water body, park polygons) to render on Leaflet baseline
    const flatFeatures = activeGeoJSON.features.filter((f: any) => {
      const type = f.properties?.type;
      return type === 'water' || type === 'park' || type === 'dam';
    });

    const flatCollection: any = {
      type: 'FeatureCollection',
      features: flatFeatures,
    };

    const newGeoJSONLayer = L.geoJSON(flatCollection, {
      style: (feature: any) => {
        const type = feature.properties?.type;
        if (type === 'water') {
          return {
            fillColor: '#2b8df4',
            fillOpacity: 0.6,
            color: '#1d5ca3',
            weight: 1.5,
          };
        }
        if (type === 'park') {
          return {
            fillColor: '#2ecc71',
            fillOpacity: 0.45,
            color: '#27ae60',
            weight: 1.2,
          };
        }
        if (type === 'dam') {
          return {
            fillColor: '#95a5a6',
            fillOpacity: 0.8,
            color: '#7f8c8d',
            weight: 2.0,
          };
        }
        return {
          fillColor: '#bdc3c7',
          fillOpacity: 0.3,
          color: '#7f8c8d',
          weight: 1.0,
        };
      },
    });

    newGeoJSONLayer.addTo(map);
    geoJSONLayerRef.current = newGeoJSONLayer;
  }, [map, activeGeoJSON]);

  // 5. Place Landmark Native Pins & High-End Label cards
  useEffect(() => {
    if (!map) return;

    // Wipe old markers
    markersRef.current.forEach((m) => map.removeLayer(m));
    markersRef.current = [];

    // Only render pins if we are using the preset and haven't loaded custom GeoJSON
    if (customGeoJSON) return;

    preset.markers.forEach((marker: PresetMarker) => {
      // Create elegant div icons representing the beautiful diorama markers
      const customHtmlIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `
          <div class="flex flex-col items-center select-none" style="filter: drop-shadow(0px 3px 6px rgba(0,0,0,0.25)); pointer-events: auto;">
            <!-- Floating label card -->
            <div class="bg-slate-900 text-white border border-slate-700/80 rounded px-1.5 py-0.5 whitespace-nowrap text-[10px] font-semibold text-center transition-transform hover:scale-105">
              <div>${marker.name}</div>
            </div>
            <!-- Drawing vertical needle stem line -->
            <div class="bg-white w-[1.5px] h-3.5 opacity-80 shadow-sm"></div>
            <!-- Colored anchor node bulb -->
            <div class="w-2.5 h-2.5 rounded-full border border-white shrink-0 shadow-inner" style="background-color: ${marker.color}; transform: translateY(-3px);"></div>
          </div>
        `,
        iconSize: [120, 50],
        iconAnchor: [60, 47], // Center and offset vertical heights
      });

      const pinMarker = L.marker([marker.lat, marker.lng], { icon: customHtmlIcon });
      pinMarker.addTo(map);
      markersRef.current.push(pinMarker);
    });
  }, [map, preset, customGeoJSON]);

  return (
    <div className="relative w-full h-full" id="leaflet-map-wrapper">
      {/* Target leaflet mounting node */}
      <div className="w-full h-full bg-[#020617] relative" ref={mapContainerRef} id="leaflet-map-target" />

      {/* High-Performance Canvas 3D Building Extruter Layer */}
      {map && (
        <Map3DOverlay
          map={map}
          features={activeGeoJSON.features}
          tiltAngle={tiltAngle}
          tiltFactor={tiltFactor}
          buildingColor={buildingColor}
          lightAngle={lightAngle}
          opacity={0.92}
          hoveredBuilding={hoveredBuilding}
          onHoverBuilding={onHoverBuilding}
          heightProperty={heightProperty}
          defaultHeight={defaultHeight}
        />
      )}
    </div>
  );
};
