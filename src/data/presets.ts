export interface PresetMarker {
  id: string;
  name: string; // Devnagari / Native name
  englishName: string;
  lat: number;
  lng: number;
  color: string;
  type: 'pin' | 'label' | 'peak';
  heightOffset?: number; // Visual lift in 3D
}

export interface PresetData {
  id: string;
  name: string;
  englishName: string;
  description: string;
  center: [number, number]; // [lat, lng]
  zoom: number;
  geojson: any;
  markers: PresetMarker[];
  terrainType: 'mountain-reservoir' | 'city-flat' | 'island-volcano' | 'historical-radial';
  elevationFunc: (x: number, y: number) => number; // Normalised x, y in [-1, 1], returns normalized height [0, 1]
  waterFunc?: (x: number, y: number) => boolean; // Determines if coordinates are underwater
}

// Visual elevation shapes for various presets
const jayapuraElevation = (nx: number, ny: number): number => {
  // High mountain range in the North/West (Cycloop mountains direction)
  const mountNW = Math.max(0, -nx * 0.5 + ny * 0.5 + 0.4);
  const noise = 0.18 * Math.sin(nx * 5.0) * Math.cos(ny * 6.0) +
                0.08 * Math.sin(nx * 12.0 + ny * 10.0);
  
  let h = 0.25 + mountNW * 0.5 + noise;
  
  // Let's create Youtefa bay at Southeast
  // If nx > 0.1 and ny < 0.0
  const distToBayCenter = Math.sqrt(Math.pow(nx - 0.4, 2) + Math.pow(ny + 0.3, 2));
  if (distToBayCenter < 0.4) {
    const factor = Math.pow(distToBayCenter / 0.4, 1.8);
    h = Math.max(0.01, h * factor);
  }
  
  return Math.max(0.01, Math.min(0.95, h));
};

const jayapuraWater = (nx: number, ny: number): boolean => {
  const distToBayCenter = Math.sqrt(Math.pow(nx - 0.4, 2) + Math.pow(ny + 0.3, 2));
  return distToBayCenter < 0.32; // Beautiful circular/oval bay
};

// Generate procedural buildings for Jayapura town
const generateJayapuraBuildings = () => {
  const features: any[] = [];
  let idCounter = 1;

  // Let's add the iconic Jembatan Merah Youtefa (Red Youtefa Bridge) crossing Youtefa Bay
  features.push({
    type: 'Feature',
    id: `youtefa-bridge`,
    properties: {
      name: 'Jembatan Youtefa (Merah)',
      englishName: 'Youtefa Bridges (Red Icon)',
      type: 'bridge',
      height: 22,
      levels: 3,
      color: '#ef4444' // Beautiful red
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [140.7150, -2.5990],
        [140.7180, -2.6020],
        [140.7190, -2.6010],
        [140.7160, -2.5980],
        [140.7150, -2.5990]
      ]]
    }
  });

  // Kantor Gubernur Papua
  features.push({
    type: 'Feature',
    id: `kantor-gubernur`,
    properties: {
      name: 'Kantor Gubernur Papua',
      englishName: 'Governor Office of Papua',
      type: 'building',
      height: 38,
      levels: 8,
      color: '#3b82f6' // Blue glass
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [140.7008, -2.5327],
        [140.7018, -2.5327],
        [140.7018, -2.5319],
        [140.7008, -2.5319],
        [140.7008, -2.5327]
      ]]
    }
  });

  // Stadion Mandala
  features.push({
    type: 'Feature',
    id: `stadion-mandala`,
    properties: {
      name: 'Stadion Mandala',
      englishName: 'Mandala Stadium',
      type: 'building',
      height: 20,
      levels: 4,
      color: '#84cc16' // Lush green field ring
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        // Outer oval-ish ring
        [140.7035, -2.5282],
        [140.7049, -2.5282],
        [140.7049, -2.5270],
        [140.7035, -2.5270],
        [140.7035, -2.5282]
      ]]
    }
  });

  // Jayapura City Giant Text Landmark (like Hollywood sign) on the hill
  features.push({
    type: 'Feature',
    id: `jayapura-city-sign`,
    properties: {
      name: 'Markah JAYAPURA CITY',
      englishName: 'JAYAPURA CITY Landmark Sign',
      type: 'monument',
      height: 15,
      levels: 2,
      color: '#f8fafc' // Crisp clean white letters
    },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [140.7082, -2.5390],
        [140.7092, -2.5390],
        [140.7092, -2.5383],
        [140.7082, -2.5383],
        [140.7082, -2.5390]
      ]]
    }
  });

  // Generate generic residential coastal shop-houses (ruko) and buildings clustering around Jayapura center
  const centerLat = -2.5337;
  const centerLng = 140.7100;
  for (let r = 0; r < 5; r++) {
    const latOffset = r * 0.0015 - 0.003;
    for (let c = 0; c < 5; c++) {
      const lngOffset = c * 0.002 - 0.004;
      const bLat = centerLat + latOffset + (Math.random() - 0.5) * 0.0003;
      const bLng = centerLng + lngOffset + (Math.random() - 0.5) * 0.0003;

      const width = 0.0005;
      const height = 0.0004;
      const bHeight = 8 + Math.floor(Math.random() * 16); // 8m to 24m low-medium rise coastal buildings

      features.push({
        type: 'Feature',
        id: `building-jpr-${idCounter++}`,
        properties: {
          name: `Ruko Jayapura ${idCounter}`,
          type: 'building',
          height: bHeight,
          levels: Math.floor(bHeight / 3),
          color: r % 2 === 0 ? '#fbbf24' : '#f59e0b'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [bLng - width/2, bLat - height/2],
            [bLng + width/2, bLat - height/2],
            [bLng + width/2, bLat + height/2],
            [bLng - width/2, bLat + height/2],
            [bLng - width/2, bLat - height/2]
          ]]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
};

// Generate procedural skyscrapers for Jakarta
const generateJakartaBuildings = () => {
  const features: any[] = [];
  const centerLat = -6.2146;
  const centerLng = 106.8184; // Sudirman Area
  
  let idCounter = 1;

  // Add Monas Park (greenery)
  features.push({
    type: 'Feature',
    properties: { name: 'Lapangan Merdeka (Monas)', type: 'park', height: 0, color: '#31702d' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [106.8220, -6.1790],
        [106.8320, -6.1790],
        [106.8320, -6.1690],
        [106.8220, -6.1690],
        [106.8220, -6.1790]
      ]]
    }
  });

  // Monas Monument in the center (National Monument 132m)
  const mLat = -6.1754;
  const mLng = 106.8271;
  features.push({
    type: 'Feature',
    properties: { name: 'Monumen Nasional (Monas)', type: 'monument', height: 132, color: '#d4af37' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [mLng - 0.0003, mLat - 0.0003],
        [mLng + 0.0003, mLat - 0.0003],
        [mLng + 0.0003, mLat + 0.0003],
        [mLng - 0.0003, mLat + 0.0003],
        [mLng - 0.0003, mLat - 0.0003]
      ]]
    }
  });

  // Skyscraper grid around SCBD / Sudirman
  for (let r = -4; r <= 4; r++) {
    for (let c = -4; c <= 4; c++) {
      if (Math.abs(r) <= 1 && Math.abs(c) <= 1) continue; // Skip immediate center
      
      const bLat = centerLat + r * 0.0025 + (Math.random() - 0.5) * 0.0005;
      const bLng = centerLng + c * 0.0025 + (Math.random() - 0.5) * 0.0005;
      
      const bHeight = 80 + Math.floor(Math.random() * 240); // 80m to 320m
      const size = 0.0005 + Math.random() * 0.0004;
      
      // Let's create some complex tower shapes
      const shapeType = Math.floor(Math.random() * 3);
      let coords: number[][][] = [[]];
      
      if (shapeType === 0) { // Square
        coords[0] = [
          [bLng - size/2, bLat - size/2],
          [bLng + size/2, bLat - size/2],
          [bLng + size/2, bLat + size/2],
          [bLng - size/2, bLat + size/2],
          [bLng - size/2, bLat - size/2]
        ];
      } else if (shapeType === 1) { // Cross shape (L-shape/H-shape style)
        const s = size/2;
        const h = size/6;
        coords[0] = [
          [bLng - s, bLat - h],
          [bLng - h, bLat - h],
          [bLng - h, bLat - s],
          [bLng + h, bLat - s],
          [bLng + h, bLat - h],
          [bLng + s, bLat - h],
          [bLng + s, bLat + h],
          [bLng + h, bLat + h],
          [bLng + h, bLat + s],
          [bLng - h, bLat + s],
          [bLng - h, bLat + h],
          [bLng - s, bLat + h],
          [bLng - s, bLat - h]
        ];
      } else { // Octagon-ish
        const s = size/2;
        const h = size/3;
        coords[0] = [
          [bLng - s, bLat - h],
          [bLng - h, bLat - s],
          [bLng + h, bLat - s],
          [bLng + s, bLat - h],
          [bLng + s, bLat + h],
          [bLng + h, bLat + s],
          [bLng - h, bLat + s],
          [bLng - s, bLat + h],
          [bLng - s, bLat - h]
        ];
      }
      
      // Categorize tower colors
      let color = '#4a90e2'; // glass blue
      if (bHeight > 250) color = '#c86f6f'; // gold-ish red supertall
      else if (bHeight > 180) color = '#46ada1'; // teal tower
      else if (Math.random() > 0.5) color = '#99aab8'; // concrete grey

      features.push({
        type: 'Feature',
        id: `building-jkt-${idCounter++}`,
        properties: {
          name: `Tower Sudirman ${idCounter}`,
          type: 'building',
          height: bHeight,
          levels: Math.floor(bHeight / 4),
          color: color
        },
        geometry: {
          type: 'Polygon',
          coordinates: coords
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
};

// Generate Manhattan Billionaire's Row & Central Park
const generateManhattanBuildings = () => {
  const features: any[] = [];
  const startLat = 40.7644; // Central Park South
  const startLng = -73.9744;
  let idCounter = 1;

  // Add Central Park polygon
  features.push({
    type: 'Feature',
    properties: { name: 'Central Park', type: 'park', height: 0, color: '#2d6d3d' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [-73.9818, 40.7644],
        [-73.9582, 40.7715],
        [-73.9730, 40.8068],
        [-73.9967, 40.7997],
        [-73.9818, 40.7644]
      ]]
    }
  });

  // Skyscraper alignments on the block grids
  for (let b = 1; b <= 4; b++) { // Blocks south of park
    const rowLat = startLat - b * 0.0022;
    for (let c = -5; c <= 5; c++) {
      const colLng = startLng + c * 0.0025;
      
      const isBillionaireRow = b === 1 && Math.abs(c) <= 2;
      const bHeight = isBillionaireRow 
        ? 350 + Math.floor(Math.random() * 120) // Extreme towers: 350m to 470m
        : 60 + Math.floor(Math.random() * 140);  // Regular skyscrapers: 60m to 200m
      
      const width = 0.0006;
      const height = 0.0005;

      features.push({
        type: 'Feature',
        id: `building-mnh-${idCounter++}`,
        properties: {
          name: isBillionaireRow ? `Billionaires Tower ${c}` : `Manhattan Block ${idCounter}`,
          type: 'building',
          height: bHeight,
          levels: Math.round(bHeight / 3.8),
          color: isBillionaireRow ? '#f0a500' : '#4d606f'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [colLng - width, rowLat - height],
            [colLng + width, rowLat - height],
            [colLng + width, rowLat + height],
            [colLng - width, rowLat + height],
            [colLng - width, rowLat - height]
          ]]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
};

// Radial Paris Layout around Arc de Triomphe
const generateParisBuildings = () => {
  const features: any[] = [];
  const arcLat = 48.8738;
  const arcLng = 2.2950;
  let idCounter = 1;

  // Render original Arc de Triomphe monument
  features.push({
    type: 'Feature',
    properties: { name: 'Arc de Triomphe', type: 'monument', height: 50, color: '#ebd0bc' },
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [2.2946, 48.8735],
        [2.2954, 48.8735],
        [2.2954, 48.8741],
        [2.2946, 48.8741],
        [2.2946, 48.8735]
      ]]
    }
  });

  // Surrounding radial structures in blocks
  const rays = 12; // 12 standard radiating avenues
  const rings = 3;
  for (let ring = 1; ring <= rings; ring++) {
    const radius = ring * 0.0022;
    for (let r = 0; r < rays; r++) {
      const angle = (r * Math.PI * 2) / rays + (ring * 0.15); // Staggered radial blocks
      const flat = arcLat + Math.sin(angle) * radius;
      const flng = arcLng + Math.cos(angle) * radius * 1.5; // Compensate aspect ratio
      
      const bHeight = 18 + Math.floor(Math.random() * 12); // standard 18m - 30m Parisian blocks
      const width = 0.0006;
      const height = 0.0005;

      features.push({
        type: 'Feature',
        id: `building-prs-${idCounter++}`,
        properties: {
          name: `Paris Block ${idCounter}`,
          type: 'building',
          height: bHeight,
          levels: Math.round(bHeight / 3.2),
          color: '#e2d3c2'
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [flng - width, flat - height],
            [flng + width, flat - height],
            [flng + width, flat + height],
            [flng - width, flat + height],
            [flng - width, flat - height]
          ]]
        }
      });
    }
  }

  return { type: 'FeatureCollection', features };
};

export const presets: PresetData[] = [
  {
    id: 'jayapura-papua',
    name: 'Jayapura, Papua',
    englishName: 'Jayapura City, Papua',
    description: 'Diorama kota pesisir Jayapura yang membentang di antara Teluk Youtefa yang indah, Jembatan Merah Youtefa yang ikonik, dan Perbukitan Cycloop yang megah.',
    center: [-2.5337, 140.7181],
    zoom: 13,
    geojson: generateJayapuraBuildings(),
    markers: [
      {
        id: 'youtefa-bridge-pin',
        name: 'Jembatan Merah Youtefa',
        englishName: 'Youtefa Red Bridge',
        lat: -2.6000,
        lng: 140.7165,
        color: '#ef4444',
        type: 'pin',
        heightOffset: 0.15
      },
      {
        id: 'jayapura-city-sign-peak',
        name: 'Puncak Markah Jayapura City',
        englishName: 'Jayapura City Sign Peak',
        lat: -2.5385,
        lng: 140.7085,
        color: '#ffffff',
        type: 'peak',
        heightOffset: 0.4
      },
      {
        id: 'kantor-gubernur-label',
        name: 'Kantor Gubernur Papua',
        englishName: 'Papua Governor Office',
        lat: -2.5323,
        lng: 140.7012,
        color: '#3b82f6',
        type: 'pin',
        heightOffset: 0.12
      },
      {
        id: 'teluk-youtefa-label',
        name: 'Teluk Youtefa',
        englishName: 'Youtefa Bay Waterway',
        lat: -2.6080,
        lng: 140.7200,
        color: '#0ea5e9',
        type: 'label',
        heightOffset: 0.02
      }
    ],
    terrainType: 'mountain-reservoir',
    elevationFunc: jayapuraElevation,
    waterFunc: jayapuraWater
  },
  {
    id: 'jakarta-center',
    name: 'Jakarta Jantung Sudirman',
    englishName: 'Sudirman Center, Jakarta',
    description: 'Ekstrusi gedung pencakar langit megah di sepanjang kawasan Sudirman-Thamrin dengan monumen Monas bersinar di utara.',
    center: [-6.2146, 106.8184],
    zoom: 14,
    geojson: generateJakartaBuildings(),
    markers: [
      {
        id: 'monas-marker',
        name: 'Monumen Nasional (Monas)',
        englishName: 'National Monument',
        lat: -6.1754,
        lng: 106.8271,
        color: '#e74c3c',
        type: 'pin',
        heightOffset: 0.1
      },
      {
        id: 'sudirman',
        name: 'Kawasan Bisnis Sudirman (SCBD)',
        englishName: 'Sudirman Central Business District',
        lat: -6.2146,
        lng: 106.8184,
        color: '#9b59b6',
        type: 'label',
        heightOffset: 0.25
      }
    ],
    terrainType: 'city-flat',
    elevationFunc: (nx, ny) => 0.05 + 0.02 * Math.sin(nx * 4) * Math.cos(ny * 4) // Hampir rata dengan sungai kecil
  },
  {
    id: 'manhattan-cp',
    name: 'Manhattan Central Park South',
    englishName: 'Billionaires Row, New York, USA',
    description: 'Pemandangan super ekstrusi 3D pencakar langit modern tertinggi di dunia berbatasan langsung dengan hamparan luas Central Park.',
    center: [40.7644, -73.9744],
    zoom: 14,
    geojson: generateManhattanBuildings(),
    markers: [
      {
        id: 'central-park-lbl',
        name: 'Taman Kota Central Park',
        englishName: 'Central Park Oasis',
        lat: 40.7820,
        lng: -73.9660,
        color: '#27ae60',
        type: 'label',
        heightOffset: 0.02
      },
      {
        id: 'billionaires-row',
        name: 'Billionaires Row Towers',
        englishName: 'Billionaires Row',
        lat: 40.7644,
        lng: -73.9744,
        color: '#f1c40f',
        type: 'pin',
        heightOffset: 0.4
      }
    ],
    terrainType: 'city-flat',
    elevationFunc: () => 0.02 // Rata
  },
  {
    id: 'paris-radial',
    name: 'Paris Arc de Triomphe',
    englishName: 'Place Charles de Gaulle, Paris, France',
    description: 'Desain radius arsitektur abad ke-19 Paris Klasik yang menawan. Garis simetris jalan memancar seperti matahari di sekitar busur kemenangan.',
    center: [48.8738, 2.2950],
    zoom: 15,
    geojson: generateParisBuildings(),
    markers: [
      {
        id: 'arc',
        name: 'Arc de Triomphe',
        englishName: 'Arc de Triomphe Monument',
        lat: 48.8738,
        lng: 2.2950,
        color: '#e67e22',
        type: 'pin',
        heightOffset: 0.05
      }
    ],
    terrainType: 'historical-radial',
    elevationFunc: () => 0.04 // Flat
  }
];
