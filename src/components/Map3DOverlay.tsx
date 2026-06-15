import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

interface Map3DOverlayProps {
  map: L.Map | null;
  features: any[];
  tiltAngle: number; // in degrees, e.g. 135
  tiltFactor: number; // multiplier for height extrusion
  buildingColor: string; // solid color or 'dynamic' or 'height-ramp'
  lightAngle: number; // light direction in degrees, e.g. 45
  opacity: number;
  hoveredBuilding: any | null;
  onHoverBuilding: (building: any | null) => void;
  heightProperty: string; // key of property containing height, e.g. 'height'
  defaultHeight: number; // in meters if no property is found
}

interface ProjectedBuilding {
  feature: any;
  basePoints: { x: number; y: number }[];
  roofPoints: { x: number; y: number }[];
  centroid: { x: number; y: number };
  depth: number; // painter's algorithm sorting depth
  height: number;
  color: string;
}

export const Map3DOverlay: React.FC<Map3DOverlayProps> = ({
  map,
  features,
  tiltAngle,
  tiltFactor,
  buildingColor,
  lightAngle,
  opacity,
  hoveredBuilding,
  onHoverBuilding,
  heightProperty,
  defaultHeight,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [projectedBuildings, setProjectedBuildings] = useState<ProjectedBuilding[]>([]);

  // Refs for tracking drag coordinates and state
  const isDraggingRef = useRef(false);
  const lastMousePosRef = useRef({ x: 0, y: 0 });

  // Convert poly coordinates to projected screen pixels
  const updateProjections = () => {
    if (!map) return;

    const zoom = map.getZoom();
    // Exponential scale factor for height based on zoom level
    // Normalizing base zoom around 14
    const zoomScale = Math.pow(1.2, zoom - 14) * tiltFactor * 0.4;
    const angleRad = (tiltAngle * Math.PI) / 180;
    const projDir = { x: Math.cos(angleRad), y: -Math.sin(angleRad) };

    const list: ProjectedBuilding[] = [];

    features.forEach((feature) => {
      if (!feature.geometry || feature.properties.type === 'water' || feature.properties.type === 'park') {
        return; // skip non-buildings (or flat shapes)
      }

      // Check coordinates type
      const isPolygon = feature.geometry.type === 'Polygon';
      const isMultiPolygon = feature.geometry.type === 'MultiPolygon';

      if (!isPolygon && !isMultiPolygon) return;

      const rings = isPolygon ? [feature.geometry.coordinates] : feature.geometry.coordinates;

      rings.forEach((ringSet: any) => {
        // We only render outer ring (first ring) for simplicity and performance
        const ring = ringSet[0];
        if (!ring || ring.length < 3) return;

        // Convert base coords to map container pixels
        const basePoints: { x: number; y: number }[] = [];
        let sumX = 0;
        let sumY = 0;

        for (let i = 0; i < ring.length; i++) {
          const coord = ring[i];
          const latLng = L.latLng(coord[1], coord[0]);
          const point = map.latLngToContainerPoint(latLng);
          basePoints.push({ x: point.x, y: point.y });
          sumX += point.x;
          sumY += point.y;
        }

        const l = basePoints.length;
        const centroid = { x: sumX / l, y: sumY / l };

        // Determine building height
        let height = defaultHeight;
        if (feature.properties && feature.properties[heightProperty] !== undefined) {
          height = Number(feature.properties[heightProperty]);
        } else if (feature.properties && feature.properties.levels !== undefined) {
          height = Number(feature.properties.levels) * 3; // 3m per level
        }

        // Extrusion displacement offset in pixels
        const dx = projDir.x * height * zoomScale;
        const dy = projDir.y * height * zoomScale;

        // Compute project roof
        const roofPoints = basePoints.map((p) => ({
          x: p.x + dx,
          y: p.y + dy,
        }));

        // Compute depth sorting key (Painter's algorithm)
        // Dot product of building centroid with the projection vector
        // Buildings that are further backward (in projection direction) render first
        const depth = centroid.x * projDir.x + centroid.y * projDir.y;

        // Resolve building style colors
        let bColor = feature.properties.color || '#4ea3e2';
        if (buildingColor !== 'default') {
          if (buildingColor === 'height-ramp') {
            // Color ramp based on heights (yellow for short, orange for mid, red for tall)
            if (height < 25) bColor = '#34d399'; // Green/Teal
            else if (height < 60) bColor = '#fb923c'; // Orange
            else if (height < 150) bColor = '#f87171'; // Red
            else bColor = '#c084fc'; // Purple for supertall
          } else {
            bColor = buildingColor; // Solid hex overrides
          }
        }

        list.push({
          feature,
          basePoints,
          roofPoints,
          centroid,
          depth,
          height,
          color: bColor,
        });
      });
    });

    // Sort: furthest away first (lowest depth value if moving positive in projection direction)
    // Actually, sorting from lowest depth to highest depth gives perfect back-to-front layering!
    list.sort((a, b) => a.depth - b.depth);
    setProjectedBuildings(list);
  };

  // Redraw loop
  const draw3DBuildings = () => {
    const canvas = canvasRef.current;
    if (!canvas || !map) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = map.getSize();
    if (canvas.width !== size.x || canvas.height !== size.y) {
      canvas.width = size.x;
      canvas.height = size.y;
    }

    const lightAngleRad = (lightAngle * Math.PI) / 180;
    const lightDir = { x: Math.cos(lightAngleRad), y: Math.sin(lightAngleRad) };

    const hoveredId = hoveredBuilding?.properties?.id || hoveredBuilding?.id;

    projectedBuildings.forEach((b) => {
      const isHovered = hoveredId === (b.feature.properties?.id || b.feature.id);
      
      // Render base (optional, can draft soft drop shadow or floor outline)
      ctx.beginPath();
      b.basePoints.forEach((p, idx) => {
        if (idx === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.fill();

      // Render walls
      const numPoints = b.basePoints.length;
      for (let i = 0; i < numPoints - 1; i++) {
        const p1 = b.basePoints[i];
        const p2 = b.basePoints[i + 1];
        const r1 = b.roofPoints[i];
        const r2 = b.roofPoints[i + 1];

        // Draw quad wall
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(r2.x, r2.y);
        ctx.lineTo(r1.x, r1.y);
        ctx.closePath();

        // Shading calculation based on wall orientation relative to light source
        const wallDx = p2.x - p1.x;
        const wallDy = p2.y - p1.y;
        const wallAngle = Math.atan2(wallDy, wallDx);
        
        // Face normal (90 degrees to the wall)
        const nx = -Math.sin(wallAngle);
        const ny = Math.cos(wallAngle);

        // Dot product with light: ranges from -1 to 1
        const dot = nx * lightDir.x + ny * lightDir.y;
        
        // Multiplier from 0.4 (shadow) to 1.0 (bright sunlit)
        const shadingIntensity = 0.65 + 0.35 * dot;

        // Apply shade to building color
        ctx.fillStyle = shadeColor(b.color, shadingIntensity, isHovered);
        ctx.fill();
        
        // Subtle wall edge border
        ctx.strokeStyle = isHovered ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.1)';
        ctx.lineWidth = isHovered ? 1.5 : 0.5;
        ctx.stroke();
      }

      // Render roof (highlighted face on top)
      ctx.beginPath();
      b.roofPoints.forEach((r, idx) => {
        if (idx === 0) ctx.moveTo(r.x, r.y);
        else ctx.lineTo(r.x, r.y);
      });
      ctx.closePath();
      
      // Roof receives direct light, so make it a bit brighter
      ctx.fillStyle = shadeColor(b.color, 1.15, isHovered);
      ctx.fill();
      
      // Roof border
      ctx.strokeStyle = isHovered ? '#ffffff' : 'rgba(0, 0, 0, 0.18)';
      ctx.lineWidth = isHovered ? 2.0 : 0.8;
      ctx.stroke();
    });
  };

  // Utility to tint/shade colors in hex
  const shadeColor = (hex: string, percent: number, isHovered: boolean = false): string => {
    // If hovered, combine warm high-contrast aura
    if (isHovered) {
      percent = Math.min(percent * 1.3, 1.5);
    }
    
    let R = parseInt(hex.substring(1, 3), 16);
    let G = parseInt(hex.substring(3, 5), 16);
    let B = parseInt(hex.substring(5, 7), 16);

    R = Math.max(0, Math.min(255, Math.round(R * percent)));
    G = Math.max(0, Math.min(255, Math.round(G * percent)));
    B = Math.max(0, Math.min(255, Math.round(B * percent)));

    if (isHovered) {
      // Add a slight yellow-white shine overlay for hover feedback
      R = Math.min(R + 40, 255);
      G = Math.min(G + 30, 255);
      B = Math.min(B + 10, 255);
    }

    const rHex = R.toString(16).padStart(2, '0');
    const gHex = G.toString(16).padStart(2, '0');
    const bHex = B.toString(16).padStart(2, '0');

    return `#${rHex}${gHex}${bHex}`;
  };

  // Check if a point is inside a polygon (ray-casting method)
  const isPointInPolygon = (point: { x: number; y: number }, polygon: { x: number; y: number }[]): boolean => {
    let isInside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].x, yi = polygon[i].y;
      const xj = polygon[j].x, yj = polygon[j].y;
      
      const intersect = ((yi > point.y) !== (yj > point.y))
          && (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi);
      if (intersect) isInside = !isInside;
    }
    return isInside;
  };

  // Handle dragging initialization
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Only drag with left mouse button click
    if (e.button !== 0) return;
    
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
    if (canvasRef.current) {
      canvasRef.current.style.cursor = 'grabbing';
    }
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
    if (canvasRef.current) {
      canvasRef.current.style.cursor = hoveredBuilding ? 'pointer' : 'grab';
    }
  };

  // Handle hover and drag interactions on canvas
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!canvasRef.current) return;

    // Handle dragging/panning the map
    if (isDraggingRef.current && map) {
      const deltaX = lastMousePosRef.current.x - e.clientX;
      const deltaY = lastMousePosRef.current.y - e.clientY;
      
      map.panBy([deltaX, deltaY], { animate: false });
      
      lastMousePosRef.current = { x: e.clientX, y: e.clientY };
      return; // Skip hovered building detection while dragging
    }

    if (projectedBuildings.length === 0) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const mousePt = { x: mouseX, y: mouseY };

    // Detect high collision back-to-front (top-most building hover first, so we scan backwards)
    let foundHovered: any | null = null;
    
    for (let i = projectedBuildings.length - 1; i >= 0; i--) {
      const b = projectedBuildings[i];
      // Test roof first
      let inside = isPointInPolygon(mousePt, b.roofPoints);
      
      // If of interest, test wall polygons as well
      if (!inside) {
        const numPoints = b.basePoints.length;
        for (let j = 0; j < numPoints - 1; j++) {
          const wallQuad = [
            b.basePoints[j],
            b.basePoints[j + 1],
            b.roofPoints[j + 1],
            b.roofPoints[j],
          ];
          if (isPointInPolygon(mousePt, wallQuad)) {
            inside = true;
            break;
          }
        }
      }

      if (inside) {
        foundHovered = b.feature;
        break;
      }
    }

    if (foundHovered !== hoveredBuilding) {
      onHoverBuilding(foundHovered);
    }
  };

  const handleMouseLeave = () => {
    isDraggingRef.current = false;
    onHoverBuilding(null);
  };

  // Handle scroll mouse wheel to trigger zoom action
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    if (!map) return;
    if (e.deltaY < 0) {
      map.zoomIn();
    } else {
      map.zoomOut();
    }
  };

  // Register global mouse up to stop drag securely
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      isDraggingRef.current = false;
      if (canvasRef.current) {
        canvasRef.current.style.cursor = hoveredBuilding ? 'pointer' : 'grab';
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [hoveredBuilding]);

  // Re-calculate projections when map viewpoint or props change
  useEffect(() => {
    if (!map) return;

    updateProjections();

    const onMapEvent = () => {
      updateProjections();
    };

    map.on('move viewreset drag zoom', onMapEvent);
    
    return () => {
      map.off('move viewreset drag zoom', onMapEvent);
    };
  }, [map, features, tiltAngle, tiltFactor, buildingColor, heightProperty, defaultHeight]);

  // Redraw when projected buildings or variables change
  useEffect(() => {
    animationFrameRef.current = requestAnimationFrame(draw3DBuildings);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [projectedBuildings, lightAngle, opacity, hoveredBuilding]);

  return (
    <canvas
      className="absolute top-0 left-0 w-full h-full pointer-events-auto"
      style={{
        zIndex: 500, // Stays above map tile, below controls menu
        opacity: opacity,
        cursor: hoveredBuilding ? 'pointer' : 'grab',
      }}
      ref={canvasRef}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onWheel={handleWheel}
    />
  );
};
