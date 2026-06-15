import React, { useEffect, useState } from 'react';
import { Compass, Sparkles } from 'lucide-react';
import { PresetData } from '../data/presets';

interface AestheticPrintFrameProps {
  preset: PresetData;
  customTitle: string;
  customSubtitle: string;
  cameraAzimuth?: number; // Optional camera angle from OrbitControls to rotate compass
  children: React.ReactNode;
}

export const AestheticPrintFrame: React.FC<AestheticPrintFrameProps> = ({
  preset,
  customTitle,
  customSubtitle,
  cameraAzimuth = 0,
  children,
}) => {
  const [compassAngle, setCompassAngle] = useState(0);

  // In standard three controls, azimuthal angle describes rotation around Y.
  // We can convert this to degrees to rotate our compass rose needle!
  useEffect(() => {
    // Convert azimuth angle to degrees
    const deg = (cameraAzimuth * 180) / Math.PI;
    setCompassAngle(deg);
  }, [cameraAzimuth]);

  // Distinct Devnagari text styling to replicate the exact look of New Tehri
  const getDevnagariSpaced = (text: string) => {
    return text.split('').join('  ');
  };

  // Vibe coordinates based on selected preset
  const getCoordinatesString = () => {
    if (preset.id === 'new-tehri') {
      return `30°22'39.4"N   78°26'14.5"E`;
    } else if (preset.id === 'jakarta-center') {
      return `6°12'52.6"S   106°49'06.2"E`;
    } else if (preset.id === 'manhattan-cp') {
      return `40°45'51.8"N   73°58'27.8"W`;
    } else if (preset.id === 'paris-radial') {
      return `48°52'25.7"N   2°17'42.0"E`;
    }
    return `${Math.abs(preset.center[0]).toFixed(4)}°${preset.center[0] >= 0 ? 'N' : 'S'}   ${Math.abs(preset.center[1]).toFixed(4)}°${preset.center[1] >= 0 ? 'E' : 'W'}`;
  };

  const getSerifTitleSpaced = () => {
    if (customTitle) return getDevnagariSpaced(customTitle);
    
    // Default Devnagari translation mappings for preset aesthetics
    if (preset.id === 'new-tehri') return 'न ई   टि ह री';
    if (preset.id === 'jakarta-center') return 'ज का र् ता';
    if (preset.id === 'manhattan-cp') return 'मैनहट्टन दक्षिण';
    if (preset.id === 'paris-radial') return 'पे रि स';
    return getDevnagariSpaced(preset.name.split(' (')[0]);
  };

  const getEnglishSubtitle = () => {
    if (customSubtitle) return customSubtitle;
    return preset.englishName;
  };

  return (
    <div
      className="bg-[#0f172a] border border-[#1e293b] p-4 sm:p-8 rounded-2xl shadow-2xl w-full flex flex-col gap-6"
      id="museum-aesthetic-frame"
    >
      {/* Top Header Card */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#1e293b] pb-4 gap-3">
        <div>
          <span className="text-[10px] font-mono tracking-wider text-slate-400 uppercase font-semibold flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-400 animate-pulse" />
            Museum Diorama Plate
          </span>
          <h2 className="text-xl font-sans font-bold text-white tracking-tight mt-0.5">
            {preset.englishName}
          </h2>
        </div>
        <div className="flex flex-col text-left sm:text-right font-mono text-[10px] text-slate-400 leading-normal">
          <span>TIPE MEDAN: <strong className="text-sky-400 uppercase font-semibold">{preset.terrainType.replace('-', ' ')}</strong></span>
          <span>PERSPEKTIF: <strong className="text-indigo-400 uppercase font-semibold">3D PROYEKSI EKSTRUSI</strong></span>
        </div>
      </div>

      {/* Main Interactive Map Canvas Slot (Framed like a lithograph print) */}
      <div className="relative border-4 border-[#1e293b] bg-[#020617] rounded-lg shadow-inner overflow-hidden aspect-[4/3] md:aspect-[16/11] w-full flex items-center justify-center">
        {/* Fine double lined inset frame line */}
        <div className="absolute inset-2 border border-dashed border-[#1e293b]/40 pointer-events-none z-10" />
        
        {/* Render child interactive Map / Diorama */}
        <div className="w-full h-full">
          {children}
        </div>
      </div>

      {/* Print Plate Footer - matches the exact graphic form on the image */}
      <div className="grid grid-cols-1 md:grid-cols-3 items-center justify-between pt-4 border-t border-[#1e293b] gap-6">
        
        {/* Left column: Compass Rose */}
        <div className="flex items-center gap-4 justify-center md:justify-start">
          <div className="relative w-16 h-16 rounded-full border border-slate-800 flex items-center justify-center bg-[#020617] shadow-sm shrink-0">
            {/* Compass Rings */}
            <div className="absolute inset-1 border border-slate-900/40 rounded-full" />
            <div className="absolute inset-2 border border-slate-900/80 rounded-full" />
            
            {/* Static direction indices */}
            <span className="absolute top-1 text-[9px] font-mono font-bold text-slate-400">N</span>
            <span className="absolute bottom-1 text-[9px] font-mono font-bold text-slate-500">S</span>
            <span className="absolute left-1 text-[9px] font-mono font-bold text-slate-500">W</span>
            <span className="absolute right-1 text-[9px] font-mono font-bold text-slate-500">E</span>
            
            {/* Dynamic Needle, rotating based on camera look angle */}
            <div
              className="relative w-full h-full transition-transform duration-100 ease-out flex items-center justify-center"
              style={{ transform: `rotate(${compassAngle}deg)` }}
            >
              {/* North Arrow Needle (Colored red) */}
              <div 
                className="absolute w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[24px] border-b-sky-400"
                style={{ top: '8px' }}
              />
              {/* South Arrow Needle (Colored grey) */}
              <div 
                className="absolute w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-t-[24px] border-t-slate-700"
                style={{ bottom: '8px' }}
              />
              {/* Center Glow Pivot */}
              <div className="w-1.5 h-1.5 bg-sky-400 rounded-full shadow-[0_0_8px_#38bdf8] z-10" />
            </div>
          </div>
          
          <div className="flex flex-col text-left">
            <span className="text-[10px] font-mono text-slate-500 leading-none">KOMPAS</span>
            <span className="text-[11px] font-sans font-semibold text-slate-300 mt-1 leading-tight uppercase flex items-center gap-1">
              <Compass className="w-3.5 h-3.5 animate-pulse text-sky-400" />
              UTARA {compassAngle !== 0 ? `${Math.round((360 - (compassAngle % 360)) % 360)}°` : '0°'}
            </span>
          </div>
        </div>

        {/* Center column: Aesthetic Serif Typography Titles & Coordinate Spread */}
        <div className="flex flex-col text-center justify-center">
          {/* Main grand Serif Title spaced out */}
          <h1 className="font-serif text-2xl sm:text-3xl font-normal text-white tracking-wider">
            {getSerifTitleSpaced()}
          </h1>
          
          {/* Subtitle location text */}
          <p className="text-[10px] sm:text-[11px] font-sans font-medium text-sky-400 tracking-wide mt-1 uppercase">
            {getEnglishSubtitle()}
          </p>

          {/* Precise coordinate string (Aesthetically spaced) */}
          <span className="text-[10px] font-mono text-slate-500 font-semibold tracking-widest mt-1.5">
            {getCoordinatesString()}
          </span>
        </div>

        {/* Right column: Graphic scale bar */}
        <div className="flex flex-col items-center md:items-end justify-center md:justify-end gap-1.5">
          <span className="text-[10.5px] font-mono text-slate-400 uppercase font-semibold">Skala Grafis</span>
          
          {/* Scale Bar SVG Line Drawing */}
          <div className="flex flex-col items-center">
            {/* The scale notches bar */}
            <div className="relative w-44 h-1.5 border-b border-l border-r border-slate-700 flex justify-between">
              <div className="absolute left-1/2 bottom-0 w-[1px] h-1 bg-slate-700" />
            </div>
            
            {/* Labels beneath */}
            <div className="flex justify-between w-44 text-[9px] font-mono font-bold text-slate-500 mt-1 pl-1 pr-1">
              <span>0 m</span>
              <span>1 km</span>
              <span>2 km</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
