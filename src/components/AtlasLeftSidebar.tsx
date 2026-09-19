import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { PlanetData, MapOverlayType, MapStyleType } from '../types';
import { PlanetTerrainEngine, getPixelColor } from '../utils/proceduralTerrain';
import {
  RefreshCw,
  Sliders,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Sun,
  RotateCw,
  Compass,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface AtlasLeftSidebarProps {
  planet: PlanetData;
  overlay: MapOverlayType;
  style: MapStyleType;
  onOpenEditor: () => void;
  onSelectCoord?: (coord: { lat: number; lon: number }) => void;
  onUpdatePlanetName?: (newName: string) => void;
}

export const AtlasLeftSidebar: React.FC<AtlasLeftSidebarProps> = ({
  planet,
  overlay,
  style,
  onOpenEditor,
  onSelectCoord,
  onUpdatePlanetName,
}) => {
  const [solarHour, setSolarHour] = useState<number>(14.2);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotY, setRotY] = useState<number>(145.2);
  const [rotX, setRotX] = useState<number>(planet.axialTiltDeg * 0.4);
  const [isEditingName, setIsEditingName] = useState<boolean>(false);
  const [tempName, setTempName] = useState<string>(planet.name);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlanetTerrainEngine>(new PlanetTerrainEngine(planet));

  useEffect(() => {
    engineRef.current.updatePlanet(planet);
    setTempName(planet.name);
  }, [planet]);

  // Handle continuous rotation if active
  useEffect(() => {
    if (!isRotating) return;
    const interval = setInterval(() => {
      setRotY((prev) => (prev + 0.6) % 360);
      setSolarHour((prev) => (prev + 0.05) % 24);
    }, 60);
    return () => clearInterval(interval);
  }, [isRotating]);

  // Mini globe canvas render
  const renderMiniGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 180;
    canvas.width = size;
    canvas.height = size;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.44;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, size, size);

    // Atmosphere Glow
    if (planet.atmosphere.surfacePressureAtm > 0.05) {
      const glow = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, radius * 1.15);
      glow.addColorStop(0, 'transparent');
      glow.addColorStop(0.75, `${planet.atmosphere.skyColorHex}30`);
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.15, 0, Math.PI * 2);
      ctx.fill();
    }

    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    const tiltRad = (planet.axialTiltDeg * Math.PI) / 180;
    const seasonRad = (65 * Math.PI) / 180;
    const declinationRad = Math.asin(Math.sin(tiltRad) * Math.sin(seasonRad));
    const sinDec = Math.sin(declinationRad);
    const cosDec = Math.cos(declinationRad);
    const subsolarLonRad = (((solarHour / 24) * 360 - 180) * Math.PI) / 180;

    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const r2 = radius * radius;
    const rInt = Math.ceil(radius);
    const minX = Math.max(0, Math.floor(cx - rInt));
    const maxX = Math.min(size - 1, Math.ceil(cx + rInt));
    const minY = Math.max(0, Math.floor(cy - rInt));
    const maxY = Math.min(size - 1, Math.ceil(cy + rInt));

    const step = 2;

    for (let y = minY; y <= maxY; y += step) {
      const dy = y - cy;
      const dy2 = dy * dy;

      for (let x = minX; x <= maxX; x += step) {
        const dx = x - cx;
        const dist2 = dx * dx + dy2;

        if (dist2 <= r2) {
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

          const y1 = ny * cosX - nz * sinX;
          const z1 = ny * sinX + nz * cosX;
          const x2 = nx * cosY + z1 * sinY;
          const z2 = -nx * sinY + z1 * cosY;

          const lat = (Math.asin(Math.max(-1, Math.min(1, -y1))) * 180) / Math.PI;
          const lon = (Math.atan2(z2, x2) * 180) / Math.PI;

          const sample = engineRef.current.sample(lat, lon);
          const [br, bg, bb] = getPixelColor(sample, overlay, style, planet);

          const latRad = (lat * Math.PI) / 180;
          const lonRad = (lon * Math.PI) / 180;
          const cosZenith =
            Math.sin(latRad) * sinDec + Math.cos(latRad) * cosDec * Math.cos(lonRad - subsolarLonRad);

          let light = 1.0;
          let twilightR = 0;
          let twilightG = 0;
          let twilightB = 0;

          if (cosZenith > 0.04) {
            light = Math.min(1.15, 0.12 + cosZenith * 0.95);
          } else if (cosZenith >= -0.09) {
            const t = (cosZenith - (-0.09)) / 0.13;
            light = Math.max(0.06, t * 0.35);
            const glowStrength = Math.sin(t * Math.PI);
            twilightR = Math.round(230 * glowStrength * 0.6);
            twilightG = Math.round(110 * glowStrength * 0.45);
            twilightB = Math.round(30 * glowStrength * 0.35);
          } else {
            light = 0.08;
          }

          const finalR = Math.min(255, Math.round(br * light + twilightR));
          const finalG = Math.min(255, Math.round(bg * light + twilightG));
          const finalB = Math.min(255, Math.round(bb * light + twilightB));

          for (let by = 0; by < step && y + by < size; by++) {
            for (let bx = 0; bx < step && x + bx < size; bx++) {
              const idx = ((y + by) * size + (x + bx)) * 4;
              data[idx] = finalR;
              data[idx + 1] = finalG;
              data[idx + 2] = finalB;
              data[idx + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Rim circle
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, [planet, overlay, style, rotX, rotY, solarHour]);

  useEffect(() => {
    renderMiniGlobe();
  }, [renderMiniGlobe]);

  const handleSaveName = () => {
    if (tempName.trim() && onUpdatePlanetName) {
      onUpdatePlanetName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const oceanFraction = Math.max(0, Math.min(100, planet.seaLevelPercent));

  return (
    <aside className="w-full lg:w-80 shrink-0 bg-black border-r border-slate-800/90 text-slate-200 font-mono flex flex-col h-full overflow-y-auto select-none p-4 text-xs space-y-4">
      {/* Top Tag & Title */}
      <div className="space-y-1.5 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-400 font-bold tracking-wider text-[10px]">
            ACTIVE R0001
          </span>
          <span className="text-slate-400 text-[10px] uppercase">
            {planet.archetype.replace('_', ' ')}
          </span>
        </div>

        {isEditingName ? (
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={tempName}
              onChange={(e) => setTempName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="bg-slate-900 border border-amber-500 text-white font-bold text-lg px-2 py-0.5 rounded focus:outline-none w-full"
              autoFocus
            />
            <button
              onClick={handleSaveName}
              className="px-2 py-1 bg-amber-500 text-slate-950 font-bold rounded text-[10px]"
            >
              SAVE
            </button>
          </div>
        ) : (
          <h1
            onClick={() => setIsEditingName(true)}
            className="text-xl font-bold tracking-wider text-white hover:text-amber-300 cursor-pointer transition-colors"
            title="Click to rename world"
          >
            {planet.name.toUpperCase()}
          </h1>
        )}

        <p className="text-[11px] text-slate-400 leading-relaxed">
          No author thesis yet. Add one in Create to guide future variations.
        </p>

        {/* 3 Sim Bullet Points */}
        <ul className="text-[11px] text-slate-400 space-y-1 pt-1 list-disc list-inside">
          <li>6 major continents shape the known world.</li>
          <li>28 named polities occupy the simulated frontiers.</li>
          <li>664 important names are tracked by stable identity.</li>
        </ul>

        {/* High conflict notice */}
        <div className="pt-2 text-[10px] text-amber-400/90 tracking-tight">
          NAME REVIEW: 24 MAJOR AND 54 LOCAL HIGH-CONFLICT NAMES.
        </div>
      </div>

      {/* Simulation Health Card */}
      <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
        <div className="space-y-0.5">
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">
            Simulation Health
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-amber-300">82/100</span>
            <span className="px-1.5 py-0.2 rounded text-[9px] bg-amber-950 text-amber-400 border border-amber-500/30">
              Needs attention
            </span>
          </div>
        </div>
        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
      </div>

      {/* Seed & Revision Actions */}
      <div className="space-y-2 border-b border-slate-800 pb-3">
        <div className="text-[10px] text-slate-400">
          Seed <strong className="text-slate-200">{planet.seed}</strong> · 1 revision
        </div>
        <button
          onClick={() => alert(`Checkpoint created for ${planet.name} (Seed: ${planet.seed})`)}
          className="w-full py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-700 text-slate-200 text-center font-semibold text-[11px] transition-colors"
        >
          Create named checkpoint
        </button>
        <button
          onClick={() => setShowHistory(!showHistory)}
          className="w-full text-left text-slate-400 hover:text-slate-200 text-[11px] flex items-center gap-1.5"
        >
          {showHistory ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          <span>Revision history</span>
        </button>
        {showHistory && (
          <div className="p-2 bg-slate-950 rounded border border-slate-850 text-[10px] text-slate-400 space-y-1">
            <div className="text-amber-300 font-bold">r0001 (Current)</div>
            <div>• Initialized procedural terrain heightmap</div>
            <div>• Real-time day/night terminator shadow computed</div>
          </div>
        )}
      </div>

      {/* Planet Globe Visualizer Section */}
      <div className="space-y-2 border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 tracking-wider">Planet</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className={`p-1 rounded border ${
                isRotating
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle continuous rotation"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={onOpenEditor}
              className="p-1 rounded bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
              title="Open Planet Parameters"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Circular Globe Viewport */}
        <div className="relative w-full aspect-square max-w-[200px] mx-auto rounded-full overflow-hidden border border-slate-800 shadow-2xl bg-black flex items-center justify-center">
          <canvas ref={canvasRef} className="block cursor-grab active:cursor-grabbing" />

          {/* Coordinate Tag Overlay */}
          <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded border border-slate-800 text-[9px] text-slate-300 font-mono">
            0.0°N {rotY.toFixed(1)}°E
          </div>

          {/* Solar Hour tag */}
          <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-md px-1.5 py-0.5 rounded border border-slate-800 text-[9px] text-amber-300 font-mono flex items-center gap-1">
            <Sun className="w-2.5 h-2.5 text-amber-400" />
            <span>{solarHour.toFixed(1)}h</span>
          </div>
        </div>

        {/* Solar time scrubber */}
        <div className="pt-1 space-y-1">
          <div className="flex justify-between text-[10px] text-slate-400">
            <span>Solar Hour</span>
            <span className="text-amber-300">{solarHour.toFixed(1)} / 24.0h</span>
          </div>
          <input
            type="range"
            min="0"
            max="24"
            step="0.1"
            value={solarHour}
            onChange={(e) => setSolarHour(parseFloat(e.target.value))}
            className="w-full accent-amber-500 h-1 bg-slate-800 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* MEASURED Physical Properties Section */}
      <div className="space-y-2">
        <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
          MEASURED
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Continents</div>
            <div className="text-white font-bold">6</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Largest Landmass</div>
            <div className="text-white font-bold">42.8%</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Ocean Fraction</div>
            <div className="text-cyan-400 font-bold">{oceanFraction.toFixed(1)}%</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Radius</div>
            <div className="text-white font-bold">
              {(planet.radiusEarth * 6371).toLocaleString()} km
            </div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Gravity</div>
            <div className="text-white font-bold">{planet.surfaceGravityG.toFixed(2)} g</div>
          </div>
          <div className="p-2 rounded bg-slate-950 border border-slate-850">
            <div className="text-[9px] text-slate-500 uppercase">Axial Tilt</div>
            <div className="text-amber-400 font-bold">{planet.axialTiltDeg.toFixed(1)}°</div>
          </div>
        </div>
      </div>
    </aside>
  );
};
