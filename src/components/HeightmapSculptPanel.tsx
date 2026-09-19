import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  PlanetData,
  TerrainModification,
  MapOverlayType,
  MapStyleType,
} from '../types';
import { PlanetTerrainEngine, getPixelColor, SamplePoint } from '../utils/proceduralTerrain';
import {
  Mountain,
  Waves,
  Disc,
  Eraser,
  RotateCcw,
  Download,
  Crosshair,
  Sliders,
  Layers,
  Sparkles,
  Info,
  Maximize2,
  Trash2,
  Check,
} from 'lucide-react';

interface HeightmapSculptPanelProps {
  planet: PlanetData;
  onUpdatePlanet: (updater: (prev: PlanetData) => PlanetData) => void;
  onSelectCoord?: (lat: number, lon: number) => void;
}

type SculptBrushType = 'raise' | 'lower' | 'crater' | 'smooth';

export const HeightmapSculptPanel: React.FC<HeightmapSculptPanelProps> = ({
  planet,
  onUpdatePlanet,
  onSelectCoord,
}) => {
  // Sculpt Brush Settings
  const [activeBrush, setActiveBrush] = useState<SculptBrushType>('raise');
  const [brushRadiusDeg, setBrushRadiusDeg] = useState<number>(12);
  const [brushIntensity, setBrushIntensity] = useState<number>(0.4);
  const [isDraggingSculpt, setIsDraggingSculpt] = useState<boolean>(false);

  // Heightmap View Mode
  const [colorMode, setColorMode] = useState<'hypsometric' | 'greyscale_dem' | 'contours'>('hypsometric');
  const [transectLatDeg, setTransectLatDeg] = useState<number>(0);
  const [hoveredPoint, setHoveredPoint] = useState<{ lat: number; lon: number; elevM: number; isWater: boolean } | null>(null);

  // Canvas Refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlanetTerrainEngine>(new PlanetTerrainEngine(planet));

  useEffect(() => {
    engineRef.current.updatePlanet(planet);
  }, [planet]);

  // Render 2D Heightmap Canvas
  const renderHeightmap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const engine = engineRef.current;
    const step = 2; // High-performance resolution step

    for (let y = 0; y < height; y += step) {
      const lat = 90 - (y / height) * 180;

      for (let x = 0; x < width; x += step) {
        const lon = (x / width) * 360 - 180;
        const sample = engine.sample(lat, lon);

        let r = 0, g = 0, b = 0;

        if (colorMode === 'greyscale_dem') {
          // Raw normalized DEM (0 - 255)
          const norm = Math.max(0, Math.min(1, (sample.rawElevation + 1.0) / 2.0));
          const val = Math.round(norm * 255);
          r = val;
          g = val;
          b = val;
        } else if (colorMode === 'contours') {
          // Topographic contours
          const isWater = sample.isWater;
          const altM = Math.abs(sample.depthOrHeightM);
          const isContourLine = altM % 400 < 35;
          if (isWater) {
            r = isContourLine ? 40 : 12;
            g = isContourLine ? 140 : 50;
            b = isContourLine ? 220 : 110;
          } else {
            r = isContourLine ? 255 : 45;
            g = isContourLine ? 255 : 95;
            b = isContourLine ? 255 : 55;
          }
        } else {
          // Hypsometric digital elevation model
          const [cr, cg, cb] = getPixelColor(sample, 'heightmap', 'satellite', planet);
          r = cr;
          g = cg;
          b = cb;
        }

        for (let by = 0; by < step && y + by < height; by++) {
          for (let bx = 0; bx < step && x + bx < width; bx++) {
            const idx = ((y + by) * width + (x + bx)) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Overlay Transect line on canvas
    const transectY = ((90 - transectLatDeg) / 180) * height;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, transectY);
    ctx.lineTo(width, transectY);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [colorMode, transectLatDeg, planet]);

  useEffect(() => {
    renderHeightmap();
  }, [renderHeightmap]);

  // Handle Canvas Click or Drag Sculpting
  const applySculpt = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const lat = 90 - (y / rect.height) * 180;
    const lon = (x / rect.width) * 360 - 180;

    const clampedLat = Math.max(-88, Math.min(88, Math.round(lat * 10) / 10));
    const clampedLon = Math.max(-180, Math.min(180, Math.round(lon * 10) / 10));

    const newMod: TerrainModification = {
      id: `mod-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      lat: clampedLat,
      lon: clampedLon,
      radiusDeg: brushRadiusDeg,
      intensity: brushIntensity,
      type: activeBrush,
      timestamp: Date.now(),
    };

    onUpdatePlanet((prev) => ({
      ...prev,
      terrainModifications: [...(prev.terrainModifications || []), newMod],
    }));

    if (onSelectCoord) {
      onSelectCoord(clampedLat, clampedLon);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDraggingSculpt(true);
    applySculpt(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const lat = 90 - (y / rect.height) * 180;
    const lon = (x / rect.width) * 360 - 180;

    const sample = engineRef.current.sample(lat, lon);
    setHoveredPoint({
      lat: Math.round(lat * 10) / 10,
      lon: Math.round(lon * 10) / 10,
      elevM: sample.depthOrHeightM,
      isWater: sample.isWater,
    });

    if (isDraggingSculpt && e.buttons === 1) {
      // Throttle continuous drag sculpt
      applySculpt(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    setIsDraggingSculpt(false);
  };

  const handleMouseLeave = () => {
    setIsDraggingSculpt(false);
    setHoveredPoint(null);
  };

  // Undo Last Sculpt Modification
  const handleUndoModification = () => {
    onUpdatePlanet((prev) => {
      const mods = prev.terrainModifications || [];
      if (mods.length === 0) return prev;
      return {
        ...prev,
        terrainModifications: mods.slice(0, -1),
      };
    });
  };

  // Clear All Sculpt Modifications
  const handleClearAllModifications = () => {
    onUpdatePlanet((prev) => ({
      ...prev,
      terrainModifications: [],
    }));
  };

  // Calculate Elevation Transect Profile along chosen latitude
  const transectData = useMemo(() => {
    const samplesCount = 120;
    const points: Array<{ lon: number; heightM: number; isWater: boolean }> = [];
    const engine = engineRef.current;

    for (let i = 0; i <= samplesCount; i++) {
      const lon = -180 + (i / samplesCount) * 360;
      const sample = engine.sample(transectLatDeg, lon);
      points.push({
        lon,
        heightM: sample.depthOrHeightM,
        isWater: sample.isWater,
      });
    }
    return points;
  }, [transectLatDeg, planet]);

  // Hypsometric Statistics
  const hypsometryStats = useMemo(() => {
    const maxM = Math.round(
      (8848 * Math.pow(planet.radiusEarth, 0.8)) / Math.max(0.5, planet.surfaceGravityG)
    );
    const deepM = -Math.round(11000 * Math.pow(planet.radiusEarth, 0.5));
    const seaLevelM = 0;

    return {
      peakElevationM: maxM,
      deepestTrenchM: deepM,
      seaLevelM,
      shelfWidthKm: planet.continentalShelfWidthKm ?? 80,
      modCount: planet.terrainModifications?.length ?? 0,
    };
  }, [planet]);

  // Export Heightmap DEM as JSON or PNG
  const handleExportDEM = () => {
    const demGrid: number[][] = [];
    const engine = engineRef.current;
    const rows = 90;
    const cols = 180;

    for (let r = 0; r < rows; r++) {
      const lat = 90 - (r / rows) * 180;
      const row: number[] = [];
      for (let c = 0; c < cols; c++) {
        const lon = (c / cols) * 360 - 180;
        const sample = engine.sample(lat, lon);
        row.push(sample.depthOrHeightM);
      }
      demGrid.push(row);
    }

    const jsonStr = JSON.stringify(
      {
        planetName: planet.name,
        resolution: `${cols}x${rows}`,
        seaLevelPercent: planet.seaLevelPercent,
        demMatrixMeters: demGrid,
      },
      null,
      2
    );

    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${planet.name.toLowerCase().replace(/\s+/g, '_')}_dem_matrix.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl backdrop-blur-md">
        <div>
          <div className="flex items-center gap-2">
            <Mountain className="w-5 h-5 text-cyan-400" />
            <h2 className="text-base font-bold tracking-wide font-sans text-slate-100 flex items-center gap-2">
              <span>HEIGHTMAP & GEOSCULPT STUDIO</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                DEM 32-BIT
              </span>
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Procedural hypsometry, real-time sea level flooding, and interactive brush sculpting.
          </p>
        </div>

        {/* View Palette Modes */}
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-0.5">
            <button
              onClick={() => setColorMode('hypsometric')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                colorMode === 'hypsometric'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Hypsometric
            </button>
            <button
              onClick={() => setColorMode('greyscale_dem')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                colorMode === 'greyscale_dem'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Raw DEM
            </button>
            <button
              onClick={() => setColorMode('contours')}
              className={`px-3 py-1 text-xs font-mono font-bold rounded-lg transition-all ${
                colorMode === 'contours'
                  ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Contours
            </button>
          </div>

          <button
            onClick={handleExportDEM}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono text-xs rounded-xl border border-slate-700 transition-colors"
            title="Download Digital Elevation Model Matrix"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Export DEM</span>
          </button>
        </div>
      </div>

      {/* 2. Main Workspace: Heightmap Canvas & Interactive Sculpt Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Column: Interactive Heightmap Canvas */}
        <div className="lg:col-span-3 space-y-4">
          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
            <canvas
              ref={canvasRef}
              width={720}
              height={360}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              className="w-full h-auto cursor-crosshair block select-none"
            />

            {/* Live Hover Readout Pill */}
            {hoveredPoint && (
              <div className="absolute top-3 left-3 px-3 py-1.5 rounded-xl bg-slate-950/90 border border-slate-700/80 backdrop-blur-md font-mono text-xs text-slate-200 shadow-lg flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
                  <span>
                    {hoveredPoint.lat > 0 ? `${hoveredPoint.lat}°N` : `${Math.abs(hoveredPoint.lat)}°S`},{' '}
                    {hoveredPoint.lon > 0 ? `${hoveredPoint.lon}°E` : `${Math.abs(hoveredPoint.lon)}°W`}
                  </span>
                </div>
                <div className="h-3 w-px bg-slate-700" />
                <span className={hoveredPoint.isWater ? 'text-cyan-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {hoveredPoint.isWater ? `Depth: ${hoveredPoint.elevM}m` : `Altitude: +${hoveredPoint.elevM}m`}
                </span>
              </div>
            )}

            {/* Interactive Drag & Sculpt Hint */}
            <div className="absolute bottom-3 right-3 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 backdrop-blur-md font-mono text-[10px] text-slate-400 pointer-events-none flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>Click & Drag map to sculpt terrain ({activeBrush.toUpperCase()})</span>
            </div>
          </div>

          {/* Interactive Dynamic Elevation Transect Cross-Section */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-200 font-mono">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>TOPOGRAPHIC TRANSECT PROFILE ACROSS LATITUDE</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-cyan-400 font-bold">
                  {transectLatDeg >= 0 ? `+${transectLatDeg}° N` : `${transectLatDeg}° S`}
                </span>
                <input
                  type="range"
                  min="-85"
                  max="85"
                  step="1"
                  value={transectLatDeg}
                  onChange={(e) => setTransectLatDeg(parseInt(e.target.value, 10))}
                  className="w-32 accent-cyan-400 cursor-pointer"
                />
              </div>
            </div>

            {/* Responsive SVG Cross Section */}
            <div className="h-28 w-full relative bg-slate-950 rounded-xl p-2 border border-slate-800/80 overflow-hidden">
              <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="w-full h-full">
                <defs>
                  <linearGradient id="landProfile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#064e3b" stopOpacity="0.3" />
                  </linearGradient>
                  <linearGradient id="waterProfile" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.6" />
                    <stop offset="100%" stopColor="#082f49" stopOpacity="0.9" />
                  </linearGradient>
                </defs>

                {/* Sea Level Line (0m) */}
                <line x1="0" y1="60" x2="1000" y2="60" stroke="#0ea5e9" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />

                {/* Area under terrain */}
                {transectData.length > 1 && (
                  <path
                    d={`M 0 120 ${transectData
                      .map((p, idx) => {
                        const x = (idx / (transectData.length - 1)) * 1000;
                        // Map -9000m to 9000m into SVG Y (0 to 120, 60 is sea level)
                        const y = Math.max(8, Math.min(115, 60 - (p.heightM / 8000) * 50));
                        return `L ${x.toFixed(1)} ${y.toFixed(1)}`;
                      })
                      .join(' ')} L 1000 120 Z`}
                    fill="url(#landProfile)"
                    stroke="#34d399"
                    strokeWidth="1.5"
                  />
                )}

                {/* Water Body Overlay where heightM < 0 */}
                <rect x="0" y="60" width="1000" height="60" fill="url(#waterProfile)" opacity="0.4" />
              </svg>

              {/* Transect Labels */}
              <div className="absolute top-2 left-3 text-[10px] font-mono text-emerald-400">Peak +8,000m</div>
              <div className="absolute top-[48%] left-3 text-[9px] font-mono text-sky-400">Sea Level (0m)</div>
              <div className="absolute bottom-2 left-3 text-[10px] font-mono text-cyan-400">Trench -10,000m</div>
            </div>
          </div>
        </div>

        {/* Right Column: Sculpt Brush Tools & Sea Level Flooding */}
        <div className="space-y-4">
          {/* Sea Level Flooding Threshold Slider */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
                <Waves className="w-4 h-4 text-cyan-400" />
                <span>SEA LEVEL FLOODING</span>
              </div>
              <span className="text-xs font-mono font-bold text-cyan-300">
                {planet.seaLevelPercent}% Submerged
              </span>
            </div>

            <p className="text-[11px] text-slate-400">
              Drag to simulate real-time marine flooding or glaciation regression.
            </p>

            <input
              type="range"
              min="0"
              max="95"
              step="1"
              value={planet.seaLevelPercent}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  seaLevelPercent: val,
                }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />

            {/* Preset Sea Level Quick Toggles */}
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px]">
              <button
                onClick={() => onUpdatePlanet((p) => ({ ...p, seaLevelPercent: 0 }))}
                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Dry (0%)
              </button>
              <button
                onClick={() => onUpdatePlanet((p) => ({ ...p, seaLevelPercent: 45 }))}
                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Low (45%)
              </button>
              <button
                onClick={() => onUpdatePlanet((p) => ({ ...p, seaLevelPercent: 71 }))}
                className="py-1 px-2 rounded-lg bg-cyan-950/60 border border-cyan-500/30 text-cyan-300 transition-colors font-bold"
              >
                Earth (71%)
              </button>
              <button
                onClick={() => onUpdatePlanet((p) => ({ ...p, seaLevelPercent: 92 }))}
                className="py-1 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                Oceanic (92%)
              </button>
            </div>
          </div>

          {/* Sculpt Brush Tool Selector */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-4 shadow-lg">
            <div className="flex items-center gap-1.5 font-bold text-xs text-slate-200">
              <Mountain className="w-4 h-4 text-emerald-400" />
              <span>TERRAIN SCULPT BRUSH</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setActiveBrush('raise')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-mono transition-all ${
                  activeBrush === 'raise'
                    ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Mountain className="w-4 h-4 text-emerald-400" />
                <span>Raise Peak</span>
              </button>

              <button
                onClick={() => setActiveBrush('lower')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-mono transition-all ${
                  activeBrush === 'lower'
                    ? 'bg-cyan-500/20 border-cyan-500 text-cyan-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Waves className="w-4 h-4 text-cyan-400" />
                <span>Carve Trench</span>
              </button>

              <button
                onClick={() => setActiveBrush('crater')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-mono transition-all ${
                  activeBrush === 'crater'
                    ? 'bg-amber-500/20 border-amber-500 text-amber-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Disc className="w-4 h-4 text-amber-400" />
                <span>Stamp Crater</span>
              </button>

              <button
                onClick={() => setActiveBrush('smooth')}
                className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-xs font-mono transition-all ${
                  activeBrush === 'smooth'
                    ? 'bg-purple-500/20 border-purple-500 text-purple-300 font-bold'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                }`}
              >
                <Eraser className="w-4 h-4 text-purple-400" />
                <span>Smooth Plain</span>
              </button>
            </div>

            {/* Brush Radius Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>BRUSH RADIUS</span>
                <span className="text-cyan-400 font-bold">{brushRadiusDeg}° (~{Math.round(brushRadiusDeg * 111 * planet.radiusEarth)} km)</span>
              </div>
              <input
                type="range"
                min="3"
                max="35"
                step="1"
                value={brushRadiusDeg}
                onChange={(e) => setBrushRadiusDeg(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Brush Intensity Slider */}
            <div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                <span>BRUSH INTENSITY</span>
                <span className="text-cyan-400 font-bold">{Math.round(brushIntensity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={brushIntensity}
                onChange={(e) => setBrushIntensity(parseFloat(e.target.value))}
                className="w-full accent-cyan-400 cursor-pointer"
              />
            </div>

            {/* Sculpt History & Action Controls */}
            <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400">
                Applied: <strong className="text-cyan-400">{hypsometryStats.modCount}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleUndoModification}
                  disabled={hypsometryStats.modCount === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Undo</span>
                </button>
                <button
                  onClick={handleClearAllModifications}
                  disabled={hypsometryStats.modCount === 0}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-950/50 border border-red-800/40 hover:bg-red-900/60 disabled:opacity-40 text-red-300 transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              </div>
            </div>
          </div>

          {/* Hypsometric Elevation Metrics */}
          <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-2 font-mono text-xs shadow-lg">
            <div className="text-slate-300 font-bold mb-2">GEOMORPHOLOGY METRICS</div>
            <div className="flex justify-between text-slate-400">
              <span>Apex Summit Altitude:</span>
              <span className="text-emerald-400 font-bold">+{hypsometryStats.peakElevationM.toLocaleString()} m</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Hadal Deepest Abyss:</span>
              <span className="text-cyan-400 font-bold">{hypsometryStats.deepestTrenchM.toLocaleString()} m</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Continental Shelf Width:</span>
              <span className="text-slate-200">{hypsometryStats.shelfWidthKm} km</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mean Global Sea Level:</span>
              <span className="text-sky-400">0 m Datum</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
