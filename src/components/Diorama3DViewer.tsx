import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PresetData, PresetMarker } from '../data/presets';

interface Diorama3DViewerProps {
  preset: PresetData;
  customGeoJSON?: any | null;
  elevationScale: number; // multiplier for terrain heights
  buildingScale: number; // multiplier for building heights
  baseType: 'wood' | 'marble' | 'clay' | 'slate';
  buildingColor: string;
  showWater: boolean;
  waterLevel: number; // relative water height
}

export const Diorama3DViewer: React.FC<Diorama3DViewerProps> = ({
  preset,
  customGeoJSON = null,
  elevationScale,
  buildingScale,
  baseType,
  buildingColor,
  showWater,
  waterLevel,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // State to hold projected 2D coordinates of 3D pins for rendering crisp HTML label tags
  const [projectedLabels, setProjectedLabels] = useState<
    {
      marker: PresetMarker;
      x: number;
      y: number;
      visible: boolean;
      worldPos: THREE.Vector3;
    }[]
  >([]);

  // Refs for animation loop & cleanup
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const frameRequestRef = useRef<number | null>(null);

  // Re-generate scene objects when preset or parameters change
  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    // --- 1. INITIALIZE THREE.JS ---
    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Subtle atmospheric Fog matching premium diorama display
    scene.background = new THREE.Color('#020617');
    scene.fog = new THREE.FogExp2('#020617', 0.08);

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 3.8, 4.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2.1; // Prevent viewing from underneath the table
    controls.minDistance = 2.0;
    controls.maxDistance = 10.0;
    controlsRef.current = controls;

    // --- 2. LIGHTING SETUP ---
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.55);
    scene.add(ambientLight);

    // Warm sun light with shadows
    const dirLight = new THREE.DirectionalLight('#ffffff', 0.85);
    dirLight.position.set(2.5, 4.5, 1.5);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 12;
    const d = 3.2;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.shadow.bias = -0.0003;
    scene.add(dirLight);

    // Cool rim light for highlighting forms
    const rimLight = new THREE.DirectionalLight('#a3c2f0', 0.45);
    rimLight.position.set(-3, 2, -2);
    scene.add(rimLight);

    // --- 3. PLATFORM TABLE TOP ---
    // Let's create a gorgeous ground base representing the exhibition room table.
    let tableMaterial: THREE.Material;
    if (baseType === 'wood') {
      tableMaterial = new THREE.MeshStandardMaterial({
        color: '#d4c5b9',
        roughness: 0.4,
        metalness: 0.1,
      });
    } else if (baseType === 'marble') {
      tableMaterial = new THREE.MeshStandardMaterial({
        color: '#f8f9fa',
        roughness: 0.12,
        metalness: 0.05,
      });
    } else if (baseType === 'slate') {
      tableMaterial = new THREE.MeshStandardMaterial({
        color: '#262d35',
        roughness: 0.7,
        metalness: 0.1,
      });
    } else {
      tableMaterial = new THREE.MeshStandardMaterial({
        color: '#be9c7b', // earthy base clay
        roughness: 0.8,
      });
    }

    const tableGeo = new THREE.PlaneGeometry(15, 15);
    const table = new THREE.Mesh(tableGeo, tableMaterial);
    table.rotation.x = -Math.PI / 2;
    table.position.y = -0.75;
    table.receiveShadow = true;
    scene.add(table);

    // --- 4. PROCEDURAL GEOLOGICAL DIORAMA BLOCK ---
    const blockSize = 3.0; // 3.0 x 3.0 units size
    const segments = 79;
    const terrainGeo = new THREE.PlaneGeometry(blockSize, blockSize, segments, segments);
    
    // Choose active GeoJSON data (custom uploaded vs preset)
    const activeData = customGeoJSON || preset.geojson;

    // Bounds for mapping lat/lng
    // We map preset points inside these coordinate spreads:
    let minLat = 999, maxLat = -999, minLng = 999, maxLng = -999;
    if (activeData && activeData.features) {
      activeData.features.forEach((f: any) => {
        if (!f.geometry || !f.geometry.coordinates) return;
        const getCoords = (c: any) => {
          if (typeof c[0] === 'number') {
            minLng = Math.min(minLng, c[0]);
            maxLng = Math.max(maxLng, c[0]);
            minLat = Math.min(minLat, c[1]);
            maxLat = Math.max(maxLat, c[1]);
          } else {
            if (Array.isArray(c)) {
              c.forEach(getCoords);
            }
          }
        };
        getCoords(f.geometry.coordinates);
      });
    }

    // Fallbacks if bounds could not be resolved
    if (minLat === 999) {
      minLat = preset.center[0] - 0.015;
      maxLat = preset.center[0] + 0.015;
      minLng = preset.center[1] - 0.02;
      maxLng = preset.center[1] + 0.02;
    } else {
      // Add generous margin
      const latMargin = (maxLat - minLat) * 0.15 || 0.005;
      const lngMargin = (maxLng - minLng) * 0.15 || 0.005;
      minLat -= latMargin;
      maxLat += latMargin;
      minLng -= lngMargin;
      maxLng += lngMargin;
    }

    // Cache polygon shapes for boundary clipping and elevation distance-fields
    interface CachedPolygon {
      bbox: { minX: number; minY: number; maxX: number; maxY: number };
      ring: [number, number][];
    }
    const cachedPolygons: CachedPolygon[] = [];
    if (activeData && activeData.features) {
      activeData.features.forEach((feature: any) => {
        if (!feature.geometry) return;
        const geomType = feature.geometry.type;
        if (geomType !== 'Polygon' && geomType !== 'MultiPolygon') return;
        
        // Skip small auxiliary polygons if they are buildings to focus on boundaries
        if (feature.properties?.type === 'building') return;

        const rings = geomType === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
        rings.forEach((ringSet: any) => {
          const ring = ringSet[0];
          if (!ring || ring.length < 3) return;
          
          let minX = 999, minY = 999, maxX = -999, maxY = -999;
          const coords: [number, number][] = [];
          ring.forEach((pt: any) => {
            const lng = pt[0];
            const lat = pt[1];
            if (typeof lng === 'number' && typeof lat === 'number') {
              minX = Math.min(minX, lng);
              maxX = Math.max(maxX, lng);
              minY = Math.min(minY, lat);
              maxY = Math.max(maxY, lat);
              coords.push([lng, lat]);
            }
          });
          
          if (coords.length >= 3) {
            cachedPolygons.push({
              bbox: { minX, minY, maxX, maxY },
              ring: coords
            });
          }
        });
      });
    }

    const checkInsidePolygons = (lng: number, lat: number): boolean => {
      if (cachedPolygons.length === 0) return true;
      for (let idx = 0; idx < cachedPolygons.length; idx++) {
        const poly = cachedPolygons[idx];
        const { bbox, ring } = poly;
        if (lng < bbox.minX || lng > bbox.maxX || lat < bbox.minY || lat > bbox.maxY) {
          continue;
        }
        let inside = false;
        for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
          const xi = ring[i][0], yi = ring[i][1];
          const xj = ring[j][0], yj = ring[j][1];
          const intersect = ((yi > lat) !== (yj > lat))
              && (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        if (inside) return true;
      }
      return false;
    };

    const getDistanceToBoundary = (lng: number, lat: number): number => {
      if (cachedPolygons.length === 0) return 0;
      let minDistSq = 999999;
      cachedPolygons.forEach(poly => {
        const { ring } = poly;
        for (let i = 0; i < ring.length; i++) {
          const dx = ring[i][0] - lng;
          const dy = ring[i][1] - lat;
          const distSq = dx * dx + dy * dy;
          if (distSq < minDistSq) {
            minDistSq = distSq;
          }
        }
      });
      return Math.sqrt(minDistSq);
    };

    // Helper to map lat/lng coordinate to Local 3D Diorama Coordinates:
    const mapToDiorama = (lat: number, lng: number): { x: number; y: number } => {
      // x is mapped to longitude (West-East)
      // y is mapped to latitude (South-North)
      const u = (lng - minLng) / (maxLng - minLng);
      const v = (lat - minLat) / (maxLat - minLat);
      return {
        x: (u - 0.5) * blockSize,
        y: (v - 0.5) * blockSize,
      };
    };

    // Calculate terrain elevation data and vertices mapping
    const vertex = new THREE.Vector3();
    const position = terrainGeo.attributes.position;
    
    // Grid storing generated heights for sit-on-terrain calculation
    const heightGrid: number[][] = Array(segments + 1).fill(0).map(() => Array(segments + 1).fill(0));

    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i);
      
      // Map vertex x,y in [-blockSize/2, blockSize/2] to normalized [-1, 1]
      const nx = (vertex.x / (blockSize / 2));
      const ny = (vertex.y / (blockSize / 2));

      // Translate local normalized to geographic lng, lat
      const u = (nx + 1) / 2;
      const v = (ny + 1) / 2;
      const lng = minLng + u * (maxLng - minLng);
      const lat = minLat + v * (maxLat - minLat);

      const isInside = checkInsidePolygons(lng, lat);
      
      let elevation = 0;
      if (isInside || cachedPolygons.length === 0) {
        if (customGeoJSON) {
          // Generate an beautiful geographic custom contour terrain relief
          const maxSpan = Math.max(maxLng - minLng, maxLat - minLat) || 1;
          const boundDist = getDistanceToBoundary(lng, lat) / maxSpan;
          
          // Elevate terrain beautifully toward the interior of the country/region
          let baseRise = Math.sin(Math.min(0.5, boundDist) * Math.PI) * 0.45;
          if (cachedPolygons.length === 0) {
            baseRise = 0.2; // Default starting height if point-only data
          }
          
          // Layer fractal mountain noise
          const mount1 = Math.sin(nx * 3.5 + 0.3) * Math.cos(ny * 2.8 - 0.4);
          const mount2 = Math.cos(nx * 8.0 - 1.2) * Math.sin(ny * 7.0 + 0.6) * 0.38;
          const mountRough = Math.sin(nx * 18.0) * Math.cos(ny * 16.0) * 0.1;
          const mountDetail = Math.sin(nx * 42.0 + ny * 32.0) * 0.03;

          let h = baseRise + (mount1 + mount2 + mountRough + mountDetail) * 0.4;
          h = Math.pow(Math.max(0.01, h), 1.15); // Shape valleys

          elevation = Math.max(0.01, Math.min(0.95, h));
        } else {
          elevation = preset.elevationFunc(nx, ny);
        }
      } else {
        // Outside of the polygon country boundaries, stay flat like table!
        elevation = 0;
      }
      
      // Calculate index positions in height grid
      const gridX = Math.round(((vertex.x + blockSize/2) / blockSize) * segments);
      const gridY = Math.round(((vertex.y + blockSize/2) / blockSize) * segments);
      if (gridX >= 0 && gridX <= segments && gridY >= 0 && gridY <= segments) {
        heightGrid[gridX][gridY] = elevation;
      }

      // Perturb coordinate vertical height Z
      // Multiplied by elevationScale
      position.setZ(i, elevation * elevationScale);
    }

    // Apply geographic/physical relief multi-level color maps using Vertex Colors if customGeoJSON is active
    if (customGeoJSON) {
      const colorsAttr = [];
      const col = new THREE.Color();
      for (let i = 0; i < position.count; i++) {
        vertex.fromBufferAttribute(position, i);
        const gridX = Math.round(((vertex.x + blockSize/2) / blockSize) * segments);
        const gridY = Math.round(((vertex.y + blockSize/2) / blockSize) * segments);
        let h = 0;
        if (gridX >= 0 && gridX <= segments && gridY >= 0 && gridY <= segments) {
          h = heightGrid[gridX][gridY];
        }

        if (h === 0 && cachedPolygons.length > 0) {
          // Flatten outside: Elegant deep base board color matching current base style
          if (baseType === 'wood') col.setHex(0x281912);
          else if (baseType === 'marble') col.setHex(0xd1d5db);
          else if (baseType === 'clay') col.setHex(0x57534e);
          else col.setHex(0x1e293b); // Slate
        } else if (h < 0.15) {
          // Valleys: Rich verdant green vegetation
          const t = h / 0.15;
          col.lerpColors(new THREE.Color('#2d5a27'), new THREE.Color('#4c8a34'), t);
        } else if (h < 0.42) {
          // Midlands / Plateaus: golden yellow and sandy warmth
          const t = (h - 0.15) / 0.27;
          col.lerpColors(new THREE.Color('#9ca343'), new THREE.Color('#cca01a'), t);
        } else if (h < 0.72) {
          // Elevated mountain clay / rich terracotta earth
          const t = (h - 0.42) / 0.3;
          col.lerpColors(new THREE.Color('#bc6c25'), new THREE.Color('#8c4c12'), t);
        } else {
          // Highest rugged peaks and snowy caps!
          const t = (h - 0.72) / 0.28;
          col.lerpColors(new THREE.Color('#a18e7e'), new THREE.Color('#faf5ef'), t);
        }
        colorsAttr.push(col.r, col.g, col.b);
      }
      terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colorsAttr, 3));
    }

    terrainGeo.computeVertexNormals();

    // Query height at a specific local 2D coordinate x, y inside block:
    const getTerrainHeight = (lx: number, ly: number): number => {
      const gx = ((lx + blockSize/2) / blockSize) * segments;
      const gy = ((ly + blockSize/2) / blockSize) * segments;
      
      const x0 = Math.floor(gx);
      const x1 = Math.min(segments, x0 + 1);
      const y0 = Math.floor(gy);
      const y1 = Math.min(segments, y0 + 1);
      
      const tx = gx - x0;
      const ty = gy - y0;
      
      if (x0 < 0 || x0 > segments || y0 < 0 || y0 > segments) return 0;
      
      // Bilinear interpolation
      const h00 = heightGrid[x0][y0];
      const h10 = heightGrid[x1][y0];
      const h01 = heightGrid[x0][y1];
      const h11 = heightGrid[x1][y1];
      
      const h0 = h00 * (1 - tx) + h10 * tx;
      const h1 = h01 * (1 - tx) + h11 * tx;
      
      return (h0 * (1 - ty) + h1 * ty) * elevationScale;
    };

    // Terrain material: satellite-ish premium green or actual earth texture
    const terrainMat = new THREE.MeshStandardMaterial({
      color: customGeoJSON ? '#ffffff' : (preset.terrainType === 'mountain-reservoir' ? '#5a7846' : '#696e73'),
      vertexColors: customGeoJSON ? true : false,
      roughness: 0.85,
      metalness: 0.05,
      flatShading: true, // Gives lovely low-poly faceted block look!
    });
    
    // Add green grassy top highlight vertex shader or vertex colors to simulate geological beauty!
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2; // Lie flat
    terrain.receiveShadow = true;
    terrain.castShadow = true;
    scene.add(terrain);

    // --- 5. BLOCK SIDE WALLS (SOIL STRATIGRAPHY LAMINATION) ---
    // Beautiful geological sediment texture generated procedurally via Canvas!
    const canvasTex = document.createElement('canvas');
    canvasTex.width = 128;
    canvasTex.height = 512;
    const texCtx = canvasTex.getContext('2d')!;
    
    // Draw 30 elegant sediment layers
    const numLayers = 40;
    const bandHeight = 512 / numLayers;
    const colors = [
      '#bf8c60', '#ab7043', '#8e5831', '#784321', // terracotta earths
      '#e0c3a5', '#cca37c', '#b3845b', '#e2c69e', // sandstone buffs
      '#a6a29e', '#888481', '#726f6d', '#5b5957', // granite clays
    ];
    
    for (let l_idx = 0; l_idx < numLayers; l_idx++) {
      const col = colors[Math.floor(Math.sin(l_idx * 0.72) * 5 + 6) % colors.length];
      texCtx.fillStyle = col;
      
      // Add tiny noise wiggle to layers to make them look naturally deposits
      const wiggle = Math.sin(l_idx * 1.5) * 4;
      texCtx.fillRect(0, l_idx * bandHeight + wiggle, 128, bandHeight + 3);
    }
    
    const sedimentTex = new THREE.CanvasTexture(canvasTex);
    sedimentTex.wrapS = THREE.RepeatWrapping;
    sedimentTex.wrapT = THREE.ClampToEdgeWrapping;
    sedimentTex.repeat.set(5, 1);

    const sideMat = new THREE.MeshStandardMaterial({
      map: sedimentTex,
      roughness: 0.9,
      metalness: 0.1,
    });

    // Construct the solid base block bounding skirt
    const baselineY = -0.55; // diorama base thickness
    const borderGeom = new THREE.BufferGeometry();
    const borderPositions: number[] = [];
    const borderNormals: number[] = [];
    const borderUVs: number[] = [];

    // Form horizontal border segments around the 4 sides of planar geometry coordinate edges
    const getBorderPoint = (edgeIdx: number, step: number): { x: number; y: number } => {
      // edgeIdx: 0=Bottom (+X), 1=Right (+Y), 2=Top (-X), 3=Left (-Y)
      // step in [0, 1]
      const hHalf = blockSize / 2;
      let lx = 0, ly = 0;
      if (edgeIdx === 0) {
        lx = -hHalf + step * blockSize;
        ly = -hHalf;
      } else if (edgeIdx === 1) {
        lx = hHalf;
        ly = -hHalf + step * blockSize;
      } else if (edgeIdx === 2) {
        lx = hHalf - step * blockSize;
        ly = hHalf;
      } else {
        lx = -hHalf;
        ly = hHalf - step * blockSize;
      }
      return { x: lx, y: ly };
    };

    const skirtSegments = 60;
    for (let side = 0; side < 4; side++) {
      for (let s = 0; s < skirtSegments; s++) {
        const t0 = s / skirtSegments;
        const t1 = (s + 1) / skirtSegments;
        
        const pt0 = getBorderPoint(side, t0);
        const pt1 = getBorderPoint(side, t1);
        
        const h0 = getTerrainHeight(pt0.x, pt0.y);
        const h1 = getTerrainHeight(pt1.x, pt1.y);

        // 3D coords for vertices: (X, Y, Z) (In three, top view was rotated, so local terrain.Y is world.-Z, terrain.Z is world.Y)
        // Vertex 1: Top-Left
        const xA = pt0.x, yA = h0, zA = pt0.y;
        // Vertex 2: Bottom-Left
        const xB = pt0.x, yB = baselineY, zB = pt0.y;
        // Vertex 3: Top-Right
        const xC = pt1.x, yC = h1, zC = pt1.y;
        // Vertex 4: Bottom-Right
        const xD = pt1.x, yD = baselineY, zD = pt1.y;

        // Triangle 1: ADB
        borderPositions.push(xA, yA, -zA);
        borderPositions.push(xD, yD, -zD);
        borderPositions.push(xB, yB, -zB);

        // Triangle 2: ADC
        borderPositions.push(xA, yA, -zA);
        borderPositions.push(xC, yC, -zC);
        borderPositions.push(xD, yD, -zD);

        // Standard UV matching sediment strip repeat
        const uvX0 = (side + t0) / 4;
        const uvX1 = (side + t1) / 4;
        borderUVs.push(uvX0, (h0 - baselineY) / (elevationScale + 0.5));
        borderUVs.push(uvX1, 0);
        borderUVs.push(uvX0, 0);

        borderUVs.push(uvX0, (h0 - baselineY) / (elevationScale + 0.5));
        borderUVs.push(uvX1, (h1 - baselineY) / (elevationScale + 0.5));
        borderUVs.push(uvX1, 0);
      }
    }

    borderGeom.setAttribute('position', new THREE.Float32BufferAttribute(borderPositions, 3));
    borderGeom.setAttribute('uv', new THREE.Float32BufferAttribute(borderUVs, 2));
    borderGeom.computeVertexNormals();

    const skirtMesh = new THREE.Mesh(borderGeom, sideMat);
    skirtMesh.castShadow = true;
    skirtMesh.receiveShadow = true;
    // scene.add(skirtMesh); // Disabled to remove 3D diorama bounding block

    // Solid wooden bottom plate base of diorama
    const woodenFrameMat = new THREE.MeshStandardMaterial({
      color: '#42281a',
      roughness: 0.35,
      metalness: 0.2,
    });
    const bottomGeo = new THREE.BoxGeometry(blockSize + 0.08, 0.08, blockSize + 0.08);
    const bottomBase = new THREE.Mesh(bottomGeo, woodenFrameMat);
    bottomBase.position.y = baselineY - 0.04;
    bottomBase.receiveShadow = true;
    bottomBase.castShadow = true;
    // scene.add(bottomBase); // Disabled to remove 3D diorama base frame

    // --- 6. FLAT WATER PLANE ---
    let waterMesh: THREE.Mesh | null = null;
    if (showWater) {
      // Create a gorgeous tinted glass transparent water body sheet
      const waterY = waterLevel * elevationScale;
      
      const waterGeo = new THREE.BoxGeometry(blockSize, 0.012, blockSize);
      const waterMat = new THREE.MeshPhysicalMaterial({
        color: '#1c688c',
        roughness: 0.15,
        transmission: 0.65, // glass transmission refraction
        opacity: 0.85,
        transparent: true,
        metalness: 0.1,
        ior: 1.333, // refractive index of real water!
      });
      
      waterMesh = new THREE.Mesh(waterGeo, waterMat);
      waterMesh.position.y = waterY;
      waterMesh.receiveShadow = true;
      scene.add(waterMesh);
    }

    // --- 7. EXTRUDED 3D BUILDINGS FOOTPRINTS ---
    // Let's iterate over GeoJSON polygons and extrude them in 3D!
    const buildingsGroup = new THREE.Group();
    
    if (activeData && activeData.features) {
      activeData.features.forEach((feature: any) => {
        if (!feature.geometry) return;
        const geomType = feature.geometry.type;
        if ((geomType !== 'Polygon' && geomType !== 'MultiPolygon') || feature.properties?.type === 'water' || feature.properties?.type === 'park') return;
      
      const rings = geomType === 'Polygon' ? [feature.geometry.coordinates] : feature.geometry.coordinates;
      rings.forEach((ringSet: any) => {
        const ring = ringSet[0];
        if (!ring || ring.length < 3) return;

        // Convert polygon coordinates to 2D shape path in local diorama coords
        const points2D: THREE.Vector2[] = [];
        let centerL = { x: 0, y: 0 };
        let coordsCount = 0;

        for (let idx = 0; idx < ring.length - 1; idx++) {
          const dPos = mapToDiorama(ring[idx][1], ring[idx][0]);
          points2D.push(new THREE.Vector2(dPos.x, dPos.y));
          centerL.x += dPos.x;
          centerL.y += dPos.y;
          coordsCount++;
        }

        if (coordsCount === 0) return;
        centerL.x /= coordsCount;
        centerL.y /= coordsCount;

        // Ensure this coordinate falls inside our boundaries to avoid overflow building clipping
        const halfSize = blockSize / 2;
        if (Math.abs(centerL.x) > halfSize || Math.abs(centerL.y) > halfSize) return;

        // Get local ground Y at centroid path to place building exactly on mountains!
        // Rotated plane coordinates conversion: (lx = X, ly = -Z)
        const groundElevation = getTerrainHeight(centerL.x, -centerL.y);

        // Building height
        let rawHeight = 12;
        if (feature.properties && feature.properties.height !== undefined) {
          rawHeight = feature.properties.height;
        } else if (feature.properties && feature.properties.levels !== undefined) {
          rawHeight = feature.properties.levels * 3;
        }
        
        // Multiply height by scale slider and normalize units
        // 1m in diorama is roughly 0.002 units
        const realHeightUnit = rawHeight * 0.0022 * buildingScale;

        // Check if building is submerged underwater
        if (showWater) {
          const wLevelY = waterLevel * elevationScale;
          if (groundElevation + realHeightUnit < wLevelY) {
            return; // Submerged building is not drawn / skip to look realistic
          }
        }

        // Draw Extruded Mesh
        const shape = new THREE.Shape(points2D);
        const extrudeSettings = {
          steps: 1,
          depth: realHeightUnit,
          bevelEnabled: true,
          bevelThickness: 0.001,
          bevelSize: 0.0015,
          bevelSegments: 1,
        };

        // Determine building category color
        let hexCol = feature.properties.color || '#ebd2b8';
        if (buildingColor !== 'default') {
          if (buildingColor === 'height-ramp') {
            if (rawHeight < 25) hexCol = '#34d399';
            else if (rawHeight < 60) hexCol = '#fb923c';
            else if (rawHeight < 150) hexCol = '#f87171';
            else hexCol = '#c084fc';
          } else {
            hexCol = buildingColor;
          }
        }

        const bMat = new THREE.MeshStandardMaterial({
          color: hexCol,
          roughness: 0.5,
          metalness: 0.1,
        });

        const bGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        const bMesh = new THREE.Mesh(bGeom, bMat);
        
        // Extrusion flows along the shape's normal (local coordinate system).
        // Since we created our Shape in 2D Plane, custom extruded shapes extend down local Z.
        // We rotate and offset to match Terrain Ground plane perfectly:
        bMesh.rotation.x = -Math.PI / 2;
        // Position offset at ground heights
        bMesh.position.y = groundElevation;
        
        bMesh.castShadow = true;
        bMesh.receiveShadow = true;
        buildingsGroup.add(bMesh);
      });
    });
    }
    scene.add(buildingsGroup);

    // --- 8. LANDMARK NEEDLE PINS ---
    const pinsGroup = new THREE.Group();
    const markersWith3dPos: { marker: PresetMarker; worldPos: THREE.Vector3 }[] = [];

    const activeMarkers: PresetMarker[] = [];
    if (customGeoJSON && customGeoJSON.features) {
      customGeoJSON.features.forEach((f: any, idx: number) => {
        if (f.geometry && f.geometry.type === 'Point' && f.geometry.coordinates) {
          const coords = f.geometry.coordinates;
          activeMarkers.push({
            id: f.id || `custom-marker-${idx}`,
            name: f.properties?.name || f.properties?.nama || `Titik ${idx + 1}`,
            englishName: f.properties?.englishName || f.properties?.type || 'Point Landmark',
            lng: coords[0],
            lat: coords[1],
            color: f.properties?.color || '#38bdf8',
            type: 'pin',
            heightOffset: 0.15
          });
        }
      });
    } else {
      activeMarkers.push(...preset.markers);
    }

    activeMarkers.forEach((marker) => {
      const dPos = mapToDiorama(marker.lat, marker.lng);
      
      const halfSize = blockSize / 2;
      if (Math.abs(dPos.x) > halfSize || Math.abs(dPos.y) > halfSize) return;

      // Vertical elevation alignment
      const groundY = getTerrainHeight(dPos.x, -dPos.y);
      const verticalLift = (marker.heightOffset || 0.1) * elevationScale;
      const targetPinHeight = groundY + verticalLift;

      // Construct a thin 3D needle wire with a colored globe
      const pinGrp = new THREE.Group();
      pinGrp.position.set(dPos.x, groundY, -dPos.y);

      // Line needle pin shaft
      const needleGeo = new THREE.CylinderGeometry(0.006, 0.006, verticalLift, 6);
      needleGeo.translate(0, verticalLift / 2, 0); // anchor at base
      const needleMat = new THREE.MeshStandardMaterial({ color: '#f8f9fa', roughness: 0.2 });
      const needle = new THREE.Mesh(needleGeo, needleMat);
      needle.castShadow = true;
      pinGrp.add(needle);

      // Spherical tip
      const sphereGeo = new THREE.SphereGeometry(0.038, 16, 16);
      sphereGeo.translate(0, verticalLift, 0);
      const tipMat = new THREE.MeshStandardMaterial({
        color: marker.color,
        roughness: 0.1,
        emissive: marker.color,
        emissiveIntensity: 0.15,
      });
      const tip = new THREE.Mesh(sphereGeo, tipMat);
      tip.castShadow = true;
      pinGrp.add(tip);

      pinsGroup.add(pinGrp);

      // Storing coordinates for screen projections
      const absoluteWorldPos = new THREE.Vector3(dPos.x, targetPinHeight + 0.06, -dPos.y);
      markersWith3dPos.push({
        marker,
        worldPos: absoluteWorldPos,
      });
    });
    scene.add(pinsGroup);

    // --- 9. RENDER LOOP & PROJECTING 2D HTML TAG BINDINGS ---
    const updateHTMLProjectedLabels = () => {
      if (!cameraRef.current || !rendererRef.current) return;
      const cam = cameraRef.current;
      
      const labelsUpdate = markersWith3dPos.map(({ marker, worldPos }) => {
        // Project 3D vector to 2D NDC Coordinates [-1, 1]
        const tempV = worldPos.clone();
        tempV.project(cam);
        
        // Check if marker is behind camera view plane
        const isVisible = tempV.z <= 1.0;

        // Map NDC back to screen pixel offsets
        const sx = (tempV.x * 0.5 + 0.5) * width;
        const sy = (-tempV.y * 0.5 + 0.5) * height;

        return {
          marker,
          x: sx,
          y: sy,
          visible: isVisible,
          worldPos,
        };
      });

      setProjectedLabels(labelsUpdate);
    };

    const animate = () => {
      if (!renderer || !scene || !camera || !controls) return;
      
      controls.update();
      renderer.render(scene, camera);
      
      // Update our projected floaters on every frame tick!
      updateHTMLProjectedLabels();

      frameRequestRef.current = requestAnimationFrame(animate);
    };

    // Begin looping
    animate();

    // Resize listener inside container bounding frame
    const handleResize = () => {
      const activeWidth = container.clientWidth;
      const activeHeight = container.clientHeight;
      camera.aspect = activeWidth / activeHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(activeWidth, activeHeight);
    };
    
    // Add resize monitor helper
    const resizeObserver = new ResizeObserver(() => {
      handleResize();
    });
    resizeObserver.observe(container);

    // Cleanups
    return () => {
      resizeObserver.disconnect();
      if (frameRequestRef.current) cancelAnimationFrame(frameRequestRef.current);
      if (controlsRef.current) controlsRef.current.dispose();
      
      // Dipose geometries & materials to avoid GPU RAM memory leaks!
      terrainGeo.dispose();
      terrainMat.dispose();
      canvasTex.remove();
      sedimentTex.dispose();
      sideMat.dispose();
      woodenFrameMat.dispose();
      bottomGeo.dispose();
      tableGeo.dispose();
      tableMaterial.dispose();
      
      if (waterMesh) {
        waterMesh.geometry.dispose();
        (waterMesh.material as THREE.Material).dispose();
      }
      
      buildingsGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => m.dispose());
          } else {
            obj.material.dispose();
          }
        }
      });

      pinsGroup.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          (obj.material as THREE.Material).dispose();
        }
      });
    };
  }, [preset, customGeoJSON, elevationScale, buildingScale, baseType, buildingColor, showWater, waterLevel]);

  return (
    <div
      className="relative w-full h-full select-none overflow-hidden"
      ref={containerRef}
      id="diorama-container"
    >
      {/* Threejs Canvas Rendering Window */}
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
        id="diorama-webgl-canvas"
      />

      {/* Floating crisp elegant HTML indicator label tag overlay */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-10 overflow-hidden">
        {projectedLabels.map(({ marker, x, y, visible }) => {
          if (!visible) return null;

          // Prevent tags rendering off-screen and visual jumping
          if (x < 10 || x > (containerRef.current?.clientWidth || 2000) - 10) return null;
          if (y < 10 || y > (containerRef.current?.clientHeight || 2000) - 10) return null;

          return (
            <div
              key={marker.id}
              className="absolute pointer-events-auto group"
              style={{
                left: `${x}px`,
                top: `${y}px`,
                transform: 'translate(-50%, -100%)',
                willChange: 'transform, left, top',
              }}
            >
              {/* Delicate thin pointing line */}
              <div className="h-6 w-[1.5px] bg-slate-400 mx-auto opacity-50 shadow-sm" />

              {/* Tag body box */}
              <div
                className="bg-white/95 backdrop-blur-sm border border-slate-200/80 rounded-md px-2 py-1 shadow-lg text-center transition-all duration-300 transform scale-95 group-hover:scale-100 ring-2 ring-transparent group-hover:ring-orange-200/50"
                style={{
                  minWidth: '90px',
                  maxWidth: '180px',
                }}
              >
                {/* Devnagari or Native Name (Bilingual rendering) */}
                <span className="block font-sans text-xs font-semibold text-slate-800 tracking-wide">
                  {marker.name}
                </span>
                
                {/* English support */}
                <span className="block text-[9px] text-slate-400 font-medium tracking-normal mt-0.5 uppercase leading-none">
                  {marker.englishName}
                </span>

                {/* Aesthetic pin colored accent bubble */}
                <div
                  className="w-2 h-2 rounded-full mx-auto mt-1 border-white border shrink-0 shadow-sm animate-pulse"
                  style={{ backgroundColor: marker.color }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Aesthetic User Interface instruction box */}
      <div className="absolute bottom-6 right-6 bg-slate-900/85 backdrop-blur-md px-3 py-1.5 rounded-lg text-white pointer-events-none text-[11px] font-mono border border-slate-700/50 flex items-center gap-2 shadow-xl animate-fade-in z-20">
        <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-ping shrink-0" />
        <span>Gunakan MOUSE untuk Klik & Tarik untuk Melakukan Rotasi • SCROLL untuk Zoom</span>
      </div>
    </div>
  );
};
