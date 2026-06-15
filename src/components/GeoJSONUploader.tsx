import React, { useRef, useState } from 'react';
import { Upload, FileCode, CheckCircle2, AlertCircle } from 'lucide-react';

interface GeoJSONUploaderProps {
  onUploadSuccess: (geoJSON: any, name: string) => void;
  onClearUpload: () => void;
  activeFileName: string | null;
}

export const GeoJSONUploader: React.FC<GeoJSONUploaderProps> = ({
  onUploadSuccess,
  onClearUpload,
  activeFileName,
}) => {
  const [isDragActive, setIsDragActive] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const parseAndValidateFile = (file: File) => {
    setErrorText(null);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        let jsonContent = JSON.parse(e.target?.result as string);
        
        // 1. Resiliency: Auto-correct direct arrays of features
        if (Array.isArray(jsonContent)) {
          jsonContent = {
            type: 'FeatureCollection',
            features: jsonContent.map((item: any, idx: number) => {
              if (item && item.type === 'Feature') return item;
              return {
                type: 'Feature',
                properties: item?.properties || {},
                geometry: item?.geometry || (item?.coordinates ? item : null)
              };
            })
          };
        }

        // 2. Normalise type casing
        if (jsonContent && typeof jsonContent.type === 'string') {
          const typeLower = jsonContent.type.toLowerCase();
          if (typeLower === 'featurecollection') {
            jsonContent.type = 'FeatureCollection';
          } else if (typeLower === 'feature') {
            jsonContent.type = 'Feature';
          } else if (['polygon', 'multipolygon', 'point', 'multipoint', 'linestring', 'multilinestring', 'geometrycollection'].includes(typeLower)) {
            // Auto wrap raw geometry into a standard FeatureCollection!
            const rawType = jsonContent.type;
            const normalizedGeometryType = rawType.charAt(0).toUpperCase() + rawType.slice(1);
            jsonContent.type = normalizedGeometryType;
            jsonContent = {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { name: file.name.split('.')[0] },
                  geometry: jsonContent
                }
              ]
            };
          }
        }

        // 3. Fallback: if features array exists but type is omitted
        if (jsonContent && !jsonContent.type && Array.isArray(jsonContent.features)) {
          jsonContent.type = 'FeatureCollection';
        }

        // Basic GeoJSON structural validation
        if (!jsonContent || !jsonContent.type) {
          throw new Error('Format berkas tidak valid: Tidak memiliki tipe GeoJSON.');
        }

        if (jsonContent.type !== 'FeatureCollection' && jsonContent.type !== 'Feature') {
          throw new Error("Tipe GeoJSON harus 'FeatureCollection' atau 'Feature'.");
        }

        if (jsonContent.type === 'FeatureCollection' && !Array.isArray(jsonContent.features)) {
          throw new Error("FeatureCollection harus memiliki array 'features'.");
        }

        // Clean name and pass details
        onUploadSuccess(jsonContent, file.name);
      } catch (err: any) {
        setErrorText(err.message || 'Gagal memparsing file. Pastikan berkas adalah GeoJSON valid.');
      }
    };

    reader.onerror = () => {
      setErrorText('Error membaca file dari memori.');
    };

    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      parseAndValidateFile(e.dataTransfer.files[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      parseAndValidateFile(e.target.files[0]);
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-3 w-full" id="geojson-uploader-panel">
      <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-wider block">Muat Berkas Mandiri</span>
      
      {activeFileName ? (
        // File Loaded State
        <div className="bg-[#020617] border border-sky-500/20 rounded-xl p-4 flex flex-col gap-3 shadow-sm anim-fade-in">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-sky-500/10 rounded-lg text-sky-400">
              <FileCode className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="block text-xs text-slate-500 font-mono tracking-wider font-semibold">BERKAS GEOJSON AKTIF</span>
              <h4 className="text-sm font-semibold text-white truncate mt-0.5" title={activeFileName}>
                {activeFileName}
              </h4>
              <div className="flex items-center gap-1.5 text-xs text-sky-450 font-medium mt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>GeoJSON berhasil dimuat</span>
              </div>
            </div>
          </div>
          <button
            onClick={onClearUpload}
            className="w-full text-center bg-[#1e293b] hover:bg-slate-800 text-sky-450 hover:text-white rounded-lg py-1.5 text-xs font-semibold cursor-pointer border border-slate-800 transition-colors"
          >
            Kembali ke Preset
          </button>
        </div>
      ) : (
        // Dropzone Uploader State
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={onButtonClick}
          className={`border-2 border-dashed rounded-xl p-6 text-center flex flex-col items-center justify-center cursor-pointer transition-all ${
            isDragActive
              ? 'border-sky-400 bg-slate-950 scale-[0.98]'
              : 'border-slate-700 hover:border-sky-400 hover:bg-[#020617]'
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".geojson,.json"
            onChange={handleChange}
          />
          <div className={`p-3 rounded-full mb-3 transition-colors ${isDragActive ? 'bg-sky-500/10 text-sky-400' : 'bg-slate-800 text-slate-400'}`}>
            <Upload className="w-5 h-5" />
          </div>
          <h5 className="text-xs font-semibold text-slate-200">
            Tarik & Lepaskan Berkas GeoJSON di Sini
          </h5>
          <p className="text-[10px] text-slate-500 mt-1">
            Mendukung .geojson atau .json • Maksimal 15MB
          </p>
          <button
            type="button"
            className="mt-3.5 px-3 py-1.5 bg-sky-400 hover:bg-sky-500 text-[#020617] hover:scale-[1.02] rounded-lg text-xs font-semibold transition-all shadow"
          >
            Pilih Berkas
          </button>
        </div>
      )}

      {/* Error message card */}
      {errorText && (
        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3 flex items-start gap-2.5 shadow-sm text-red-400 animate-fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <h5 className="text-xs font-bold leading-none">Format Salah</h5>
            <p className="text-[10px] text-red-500 leading-normal mt-1">{errorText}</p>
          </div>
        </div>
      )}
    </div>
  );
};
