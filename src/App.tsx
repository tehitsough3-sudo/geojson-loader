import React, { useState, useEffect } from 'react';
import { 
  Map as MapIcon, 
  Layers, 
  Sliders, 
  HelpCircle, 
  Building2, 
  Coins, 
  Compass, 
  Settings2, 
  FileJson, 
  Sparkles,
  Info,
  Layers3,
  Waves,
  Palette,
  Rotate3d
} from 'lucide-react';
import { presets, PresetData } from './data/presets';
import { InteractiveLeafletMap } from './components/InteractiveLeafletMap';
import { Diorama3DViewer } from './components/Diorama3DViewer';
import { AestheticPrintFrame } from './components/AestheticPrintFrame';
import { GeoJSONUploader } from './components/GeoJSONUploader';

export default function App() {
  // --- 1. STATES ---
  const [activePreset, setActivePreset] = useState<PresetData>(presets[0]);
  const [customGeoJSON, setCustomGeoJSON] = useState<any | null>(null);
  const [customFileName, setCustomFileName] = useState<string | null>(null);

  // General Viz parameters
  const [viewMode, setViewMode] = useState<'map' | 'diorama'>('map');
  const [mapStyle, setMapStyle] = useState<'satellite' | 'terrain' | 'dark' | 'light'>('satellite');
  
  // Height Extrusion controls
  const [tiltAngle, setTiltAngle] = useState<number>(135); // Degrees for projection shift in map mode
  const [tiltFactor, setTiltFactor] = useState<number>(0.8); // Displacement multiplier
  const [elevationScale, setElevationScale] = useState<number>(0.75); // Terrain displacement inside Threejs
  const [buildingScale, setBuildingScale] = useState<number>(1.2); // Threejs building height
  
  // Styling adjustments
  const [buildingColor, setBuildingColor] = useState<string>('default'); // 'default' preset colors, hex value or color ramp
  const [lightAngle, setLightAngle] = useState<number>(65); // Ambient occlusion face shading direction
  const [dioramaBaseStyle, setDioramaBaseStyle] = useState<'wood' | 'marble' | 'slate' | 'clay'>('wood');
  const [showWater, setShowWater] = useState<boolean>(true);
  const [waterLevel, setWaterLevel] = useState<number>(0.15); // normalized height boundary
  
  // Scan GeoJSON key properties for height extrusion
  const [heightProperty, setHeightProperty] = useState<string>('height');
  const [discoveredProperties, setDiscoveredProperties] = useState<string[]>([]);
  const [defaultHeight, setDefaultHeight] = useState<number>(20); // Fallback height

  // Interactive hover details from map/diorama hover checking
  const [hoveredBuilding, setHoveredBuilding] = useState<any | null>(null);
  
  // Manual Label overrides for Aesthetic Print Frame
  const [customPrintTitle, setCustomPrintTitle] = useState<string>('');
  const [customPrintSubtitle, setCustomPrintSubtitle] = useState<string>('');

  // Dynamically rotate compass rose on OrbitControls camera updates
  // For simplicity, we simulate a small azimuth drift or track interactive azimuth inputs
  const [cameraAzimuth, setCameraAzimuth] = useState<number>(0.3);

  // --- 2. DYNAMIC LINK LOADER FOR LEAFLET CSS ---
  useEffect(() => {
    const LEAFLET_CSS_ID = 'leaflet-css-bundle';
    if (!document.getElementById(LEAFLET_CSS_ID)) {
      const link = document.createElement('link');
      link.id = LEAFLET_CSS_ID;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
  }, []);

  // --- 3. AUTO-DISCOVER GEOJSON PROPERTY KEYS FOR HEIGHT ---
  useEffect(() => {
    const activeData = customGeoJSON || activePreset.geojson;
    if (activeData && activeData.features && activeData.features.length > 0) {
      // Collect all unique keys from features properties block
      const keysSet = new Set<string>();
      activeData.features.forEach((feature: any) => {
        if (feature.properties) {
          Object.keys(feature.properties).forEach((k) => keysSet.add(k));
        }
      });
      const keysArray = Array.from(keysSet);
      setDiscoveredProperties(keysArray);

      // Auto select first candidate that resembles height/level definitions
      const candidates = ['height', 'levels', 'ketinggian', 'altitude', 'elevation', 'elevasi', 'floor', 'lantai'];
      const foundCandidate = candidates.find((cand) => keysArray.includes(cand));
      if (foundCandidate) {
        setHeightProperty(foundCandidate);
      } else {
        // Fallback to highest likelihood
        if (keysArray.includes('height')) setHeightProperty('height');
        else if (keysArray.length > 0) setHeightProperty(keysArray[0]);
      }
    }
  }, [activePreset, customGeoJSON]);

  // Clean custom overlay and return to presets
  const handleClearUpload = () => {
    setCustomGeoJSON(null);
    setCustomFileName(null);
    setCustomPrintTitle('');
    setCustomPrintSubtitle('');
  };

  const handleUploadSuccess = (content: any, fileName: string) => {
    setCustomGeoJSON(content);
    setCustomFileName(fileName);
    setCustomPrintTitle(fileName.replace('.geojson', '').replace('.json', '').replace(/[-_]/g, ' '));
    setCustomPrintSubtitle('Berkas GeoJSON Mandiri');
    setViewMode('map'); // Switch back to map first to see bounds
  };

  // Counting buildings
  const getBuildingsCount = () => {
    const data = customGeoJSON || activePreset.geojson;
    if (!data || !data.features) return 0;
    return data.features.filter((f: any) => f.properties?.type !== 'water' && f.properties?.type !== 'park').length;
  };

  // Compass rotation emulator
  const handleAnimateAzimuth = () => {
    // Adds a stylish rotation increment when diorama gets loaded/panned
    if (viewMode === 'diorama') {
      const interval = setInterval(() => {
        // Just general small sway to show compass responsiveness
        setCameraAzimuth(prev => prev + 0.003);
      }, 50);
      return () => clearInterval(interval);
    }
  };
  useEffect(handleAnimateAzimuth, [viewMode]);

  return (
    <div className="min-h-screen bg-[#020617] text-[#f8fafc] flex flex-col font-sans selection:bg-[#38bdf8] selection:text-slate-950">
      
      {/* 1. APP TOP TITLE BAR */}
      <header className="border-b border-[#1e293b] bg-[#0f172a]/80 backdrop-blur px-6 py-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shrink-0 z-40">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-[#38bdf8] to-[#818cf8] rounded-xl shadow-lg shadow-[#38bdf8]/15">
            <Layers3 className="w-6 h-6 text-[#020617]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-sky-500/10 text-sky-400 font-mono font-bold tracking-widest px-2 py-0.5 rounded-full uppercase">VERSION 3D PRO</span>
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 font-mono font-bold tracking-widest px-2 py-0.5 rounded-full uppercase">LATENCY CLEAR</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white mt-1">
              GeoJSON 3D Map & Terrain Diorama Builder
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-[#1e293b]/40 py-1.5 px-3 rounded-lg border border-[#1e293b]">
          <span className="w-2 h-2 bg-sky-400 rounded-full animate-pulse shadow-[0_0_8px_#38bdf8]" />
          <span>Sistem Siap • Presisi Tinggi</span>
        </div>
      </header>

      {/* 2. MAIN APPLICATION CONTENT GRID */}
      <main className="flex-1 w-full max-w-[1900px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-0 overflow-auto">
        
        {/* LEFT COLUMN: INTERACTIVE SETTINGS CABINET (4 COLS) */}
        <section className="lg:col-span-4 flex flex-col gap-6 overflow-y-auto max-h-none lg:max-h-[calc(100vh-140px)] pr-0 lg:pr-1 min-h-0">
          
          {/* STEP A: MODAL / MODE VISUAL SELECTION */}
          <div className="bg-[#0f172a]/70 border border-[#1e293b] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">MODE VISUALISASI</span>
            <div className="grid grid-cols-2 gap-3.5">
              
              {/* Map Mode Tab */}
              <button
                onClick={() => setViewMode('map')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  viewMode === 'map'
                    ? 'border-sky-400 bg-sky-500/10 text-white shadow-lg shadow-sky-400/5'
                    : 'border-[#1e293b] bg-[#020617]/50 text-slate-400 hover:border-sky-400 hover:text-slate-200'
                }`}
              >
                <MapIcon className={`w-5 h-5 mb-2 ${viewMode === 'map' ? 'text-sky-400' : ''}`} />
                <span className="text-xs font-bold leading-none">Peta Leaflet 3D</span>
                <span className="text-[9px] text-slate-500 mt-1">Ekstrusi Pseudo-3D</span>
              </button>

              {/* Diorama Mode Tab */}
              <button
                onClick={() => setViewMode('diorama')}
                className={`flex flex-col items-center justify-center p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                  viewMode === 'diorama'
                    ? 'border-sky-400 bg-sky-500/10 text-white shadow-lg shadow-sky-400/5'
                    : 'border-[#1e293b] bg-[#020617]/50 text-slate-400 hover:border-sky-400 hover:text-slate-200'
                }`}
              >
                <Rotate3d className={`w-5 h-5 mb-2 ${viewMode === 'diorama' ? 'text-sky-400' : ''}`} />
                <span className="text-xs font-bold leading-none">Blok Diorama 3D</span>
                <span className="text-[9px] text-slate-500 mt-1">Model Geologi WebGL</span>
              </button>

            </div>
          </div>

          {/* STEP C: INPUT FILE UPLOADER */}
          <div className="bg-[#0f172a]/70 border border-[#1e293b] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <GeoJSONUploader
              onUploadSuccess={handleUploadSuccess}
              onClearUpload={handleClearUpload}
              activeFileName={customFileName}
            />
          </div>          {/* STEP D: EXTRUSION & GEOPROCESSING PROPERTY BINDINGS */}
          <div className="bg-[#0f172a]/70 border border-[#1e293b] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2">
              <Settings2 className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Pemetaan Data & 3D Extrude</span>
            </div>

            {/* Height Column Binding Select dropdown */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium">Properti Data Ketinggian (GeoJSON Key)</label>
              {discoveredProperties.length > 0 ? (
                <div className="relative">
                  <select
                    value={heightProperty}
                    onChange={(e) => setHeightProperty(e.target.value)}
                    className="w-full bg-[#020617]/80 border border-[#1e293b] hover:border-[#38bdf8] focus:border-[#38bdf8] rounded-lg py-2 px-3 text-xs text-[#f8fafc] outline-none cursor-pointer appearance-none transition-colors"
                  >
                    {discoveredProperties.map((prop) => (
                      <option key={prop} value={prop}>
                        {prop === 'height' ? 'height (Ketinggian)' : prop === 'levels' ? 'levels (Tingkat Lantai)' : prop}
                      </option>
                    ))}
                    <option value="none">Tanpa Properti (Uniform)</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 text-[10px]">▼</div>
                </div>
              ) : (
                <div className="bg-[#020617]/60 border border-[#1e293b] rounded-lg p-2.5 text-center text-[10.5px] text-slate-500 font-medium italic">
                  Tidak ada kunci properti ditemukan
                </div>
              )}
            </div>

            {/* Uniform height fallback input slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-slate-400 font-medium">Tinggi Default Tanpa Properti</label>
                <span className="font-mono text-sky-400 font-bold">{defaultHeight} meter</span>
              </div>
              <input
                type="range"
                min="5"
                max="100"
                step="5"
                value={defaultHeight}
                onChange={(e) => setDefaultHeight(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            {/* General Height extrusion multiplier */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-slate-400 font-medium">Skala Ekstrusi Bangunan</label>
                <span className="font-mono text-sky-400 font-bold">
                  {viewMode === 'map' ? tiltFactor.toFixed(2) : buildingScale.toFixed(2)}x
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.5"
                step="0.1"
                value={viewMode === 'map' ? tiltFactor : buildingScale}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  if (viewMode === 'map') setTiltFactor(val);
                  else setBuildingScale(val);
                }}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            {/* Map Mode Exclusive: Axiomatic projection tilt angle slider */}
            {viewMode === 'map' && (
              <div className="flex flex-col gap-1.5 border-t border-[#1e293b] pt-3">
                <div className="flex justify-between items-center text-xs">
                  <label className="text-slate-400 font-medium font-mono">SUDUT PROYEKSI AXONOMETRIC</label>
                  <span className="font-mono text-sky-400 font-bold">{tiltAngle}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="360"
                  value={tiltAngle}
                  onChange={(e) => setTiltAngle(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                />
              </div>
            )}

            {/* Diorama exclusive: Terrain elevation height displacement multiplier */}
            {viewMode === 'diorama' && (
              <div className="flex flex-col gap-3 border-t border-[#1e293b] pt-3">
                <div className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <label className="text-slate-400 font-medium">Skala Kecuraman Medan Hill</label>
                    <span className="font-mono text-sky-400 font-bold">{elevationScale.toFixed(2)}x</span>
                  </div>
                  <input
                    type="range"
                    min="0.1"
                    max="2.0"
                    step="0.05"
                    value={elevationScale}
                    onChange={(e) => setElevationScale(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                  />
                </div>

                <div className="flex flex-col gap-2.5">
                  <div className="flex items-center justify-between border-t border-[#1e293b] pt-2.5">
                    <span className="text-xs text-slate-400 font-medium flex items-center gap-1.5">
                      <Waves className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
                      Visualisasi Air Danau
                    </span>
                    <input
                      type="checkbox"
                      checked={showWater}
                      onChange={(e) => setShowWater(e.target.checked)}
                      className="w-4 h-4 accent-sky-400 cursor-pointer rounded"
                    />
                  </div>
                  
                  {showWater && (
                    <div className="flex flex-col gap-1.5 pl-5 border-l border-[#1e293b]">
                      <div className="flex justify-between items-center text-xs">
                        <label className="text-slate-500 text-[11px]">Pasang Surut Air (Tinggi Permukaan)</label>
                        <span className="font-mono text-sky-400 font-semibold">{waterLevel.toFixed(2)}m</span>
                      </div>
                      <input
                        type="range"
                        min="0.0"
                        max="0.4"
                        step="0.02"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(Number(e.target.value))}
                        className="w-full h-1 bg-slate-700 rounded appearance-none cursor-pointer accent-sky-400"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* STEP E: STYLING & MATERIAL CONFIGURATION */}
          <div className="bg-[#0f172a]/70 border border-[#1e293b] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2">
              <Palette className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Arah Pencahayaan & Gaya</span>
            </div>

            {/* Sun light orientation angle shadow direction */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="text-slate-400 font-medium flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-sky-400 rounded-full shadow shadow-sky-400/85 animate-ping" />
                  Derajat Cahaya Matahari (Bayangan)
                </label>
                <span className="font-mono text-sky-400 font-bold">{lightAngle}°</span>
              </div>
              <input
                type="range"
                min="0"
                max="360"
                value={lightAngle}
                onChange={(e) => setLightAngle(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
              />
            </div>

            {/* Coloring selection map */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium">Palet Warna Bangunan 3D</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'default', name: 'Warna Berkas' },
                  { id: '#e2ad71', name: 'Terracotta' },
                  { id: '#4a90e2', name: 'Glass Blue' },
                  { id: '#99adab', name: 'Concrete Grey' },
                  { id: 'height-ramp', name: 'Ramp Tinggi' },
                ].map((col) => (
                  <button
                    key={col.id}
                    onClick={() => setBuildingColor(col.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all border ${
                      buildingColor === col.id
                        ? 'bg-[#1e293b] border-sky-400 text-white shadow font-semibold'
                        : 'bg-[#020617]/60 border-[#1e293b] text-slate-400 hover:border-sky-400/50 hover:text-white'
                    }`}
                  >
                    {col.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Diorama base types config (Wood, Marble, Slate) */}
            {viewMode === 'diorama' && (
              <div className="flex flex-col gap-2.5 pt-2.5 border-t border-[#1e293b]">
                <label className="text-xs text-slate-400 font-medium">Bahan Meja Landasan 3D</label>
                <div className="flex gap-2">
                  {[
                    { id: 'wood', name: 'Kayu Pinus' },
                    { id: 'marble', name: 'Marble Putih' },
                    { id: 'slate', name: 'Slate Slate' },
                    { id: 'clay', name: 'Tanah Lempung' },
                  ].map((base) => (
                    <button
                      key={base.id}
                      onClick={() => setDioramaBaseStyle(base.id as any)}
                      className={`flex-1 px-2 py-1 rounded text-[10.5px] cursor-pointer text-center font-medium transition-all border ${
                        dioramaBaseStyle === base.id
                          ? 'bg-[#1e293b] border-sky-400 text-white font-semibold'
                          : 'bg-[#020617]/60 border-[#1e293b] text-slate-400 hover:text-white'
                      }`}
                    >
                      {base.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Map Style (Satellite vs Terrain) - Map mode only */}
            {viewMode === 'map' && (
              <div className="flex flex-col gap-2 pt-2.5 border-t border-[#1e293b]">
                <label className="text-xs text-slate-400 font-medium">Gaya Peta Latar Belakang</label>
                <div className="flex gap-2">
                  {[
                    { id: 'satellite', name: 'Satelit' },
                    { id: 'terrain', name: 'Topografi' },
                    { id: 'light', name: 'Muted Light' },
                    { id: 'dark', name: 'Muted Dark' },
                  ].map((style) => (
                    <button
                      key={style.id}
                      onClick={() => setMapStyle(style.id as any)}
                      className={`flex-1 px-2 py-1 rounded text-[10.5px] cursor-pointer text-center font-medium transition-all border ${
                        mapStyle === style.id
                          ? 'bg-[#1e293b] border-sky-400 text-white font-semibold'
                          : 'bg-[#020617]/60 border-[#1e293b] text-slate-400 hover:text-white'
                      }`}
                    >
                      {style.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* STEP F: CUSTOM EMBOSS PLATE WORDING */}
          <div className="bg-[#0f172a]/70 border border-[#1e293b] p-5 rounded-2xl flex flex-col gap-4 shadow-xl">
            <div className="flex items-center gap-2 border-b border-[#1e293b] pb-2">
              <FileJson className="w-4 h-4 text-sky-400" />
              <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">Kustom Teks Plat Cetak</span>
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium">Judul Plat Utama (Phonetic / Devnagari)</label>
              <input
                type="text"
                value={customPrintTitle}
                onChange={(e) => setCustomPrintTitle(e.target.value)}
                placeholder={activePreset.name.split(' (')[0]}
                className="w-full bg-[#020617]/80 border border-[#1e293b] rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-[#38bdf8] font-semibold transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-slate-400 font-medium">Subtitle Bahasa Inggris</label>
              <input
                type="text"
                value={customPrintSubtitle}
                onChange={(e) => setCustomPrintSubtitle(e.target.value)}
                placeholder={activePreset.englishName}
                className="w-full bg-[#020617]/80 border border-[#1e293b] rounded-lg py-1.5 px-3 text-xs text-white outline-none focus:border-[#38bdf8] font-semibold transition-all"
              />
            </div>
            <p className="text-[10px] text-slate-500 leading-normal">
              Ubah teks di atas untuk menulis nama atau lokasi kustom Anda langsung di plat album museum!
            </p>
          </div>

          {/* STEP G: METRIC SUMMARY */}
          <div className="bg-[#0f172a]/90 border border-[#1e293b] p-4 rounded-xl flex flex-col gap-2 text-xs text-slate-450 shadow-xl">
            <span className="text-[10px] font-semibold text-sky-450 tracking-wider">RINGKASAN GEO-SPASIAL</span>
            <div className="flex justify-between border-b border-[#1e293b] pb-1 mt-1 text-[11px]">
              <span>Gedung Terdektesi:</span>
              <span className="font-mono text-white font-bold">{getBuildingsCount()} buah</span>
            </div>
            <div className="flex justify-between border-b border-[#1e293b] pb-1 text-[11px]">
              <span>Tinggi Maksimal Proyektor:</span>
              <span className="font-mono text-sky-400 font-bold">
                {discoveredProperties.length > 0 && heightProperty !== 'none'
                  ? 'Metrik Dinamis (Variable)'
                  : `${defaultHeight} meter (Seragam)`}
              </span>
            </div>
            {customFileName && (
              <div className="flex justify-between text-[11px]">
                <span>Nama Berkas:</span>
                <span className="text-sky-400 font-semibold truncate max-w-[170px]" title={customFileName}>
                  {customFileName}
                </span>
              </div>
            )}
          </div>

        </section>

        {/* RIGHT COLUMN: GRAND LITHOGRAPH PRINT FRAME STAGING (8 COLS) */}
        <section className="lg:col-span-8 flex flex-col gap-6 items-center min-h-0">
          
          <AestheticPrintFrame
            preset={activePreset}
            customTitle={customPrintTitle}
            customSubtitle={customPrintSubtitle}
            cameraAzimuth={cameraAzimuth}
          >
            {viewMode === 'map' ? (
              <InteractiveLeafletMap
                preset={activePreset}
                customGeoJSON={customGeoJSON}
                mapStyle={mapStyle}
                tiltAngle={tiltAngle}
                tiltFactor={tiltFactor}
                buildingColor={buildingColor}
                lightAngle={lightAngle}
                heightProperty={heightProperty}
                defaultHeight={defaultHeight}
                hoveredBuilding={hoveredBuilding}
                onHoverBuilding={setHoveredBuilding}
              />
            ) : (
              <Diorama3DViewer
                preset={activePreset}
                customGeoJSON={customGeoJSON}
                elevationScale={elevationScale}
                buildingScale={buildingScale}
                baseType={dioramaBaseStyle}
                buildingColor={buildingColor}
                showWater={showWater}
                waterLevel={waterLevel}
              />
            )}
          </AestheticPrintFrame>

          {/* DYNAMIC HOVER HIGHLIGHT INFORMATION BAR */}
          {hoveredBuilding && (
            <div className="w-full bg-[#0f172a]/95 border border-[#1e293b] rounded-2xl p-4 flex gap-4 shadow-2xl animate-fade-in relative z-25 items-start">
              <div className="p-2.5 bg-sky-500/10 border border-sky-450/20 text-sky-400 rounded-xl animate-pulse">
                <Building2 className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-mono text-sky-450 font-bold uppercase tracking-wider block">INFORMASI BANGUNAN AKTIF (HOVERED)</span>
                <h4 className="text-sm font-bold text-white mt-1 truncate">
                  {hoveredBuilding.properties?.name || hoveredBuilding.name || `Gedung ID: ${hoveredBuilding.properties?.id || hoveredBuilding.id || 'N/A'}`}
                </h4>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-350 mt-1.5 font-medium">
                  {hoveredBuilding.properties?.height && (
                    <span>Tinggi: <strong className="text-sky-400 font-semibold font-mono">{hoveredBuilding.properties.height}m</strong></span>
                  )}
                  {hoveredBuilding.properties?.levels && (
                    <span>Lantai: <strong className="text-sky-400 font-semibold font-mono">{hoveredBuilding.properties.levels} lantai</strong></span>
                  )}
                  {hoveredBuilding.properties?.type && (
                    <span>Kategori: <span className="bg-slate-800 text-white px-1.5 py-0.5 rounded text-[10.5px] uppercase font-bold">{hoveredBuilding.properties.type}</span></span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* SYSTEM DESCRIPTION BRIEF FOOTER DISPLAY */}
          <div className="w-full bg-[#0f172a]/40 border border-[#1e293b]/50 p-4 rounded-xl text-slate-400 text-[11px] leading-relaxed flex items-start gap-2">
            <Info className="w-4 h-4 shrink-0 text-sky-400 mt-0.5" />
            <div className="flex-1">
              <strong>Mekanisme Render Proyeksi Geometris 3D:</strong> Mode Map menggunakan HTML5 Canvas performa tinggi untuk mendeformasi data poligon GeoJSON secara instan menggunakan proyeksi koordinat axonometric yang disinkronisasi bersama pergerakan Leaflet. Mode Diorama memproyeksikan data vector poligon secara vertikal ke permukaan model medan berlereng yang dicalculasi secara dinamis menggunakan Three.js WebGL.
            </div>
          </div>

        </section>

      </main>

    </div>
  );
}
