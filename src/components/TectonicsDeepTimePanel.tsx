import React from 'react';
import { PlanetData, TectonicPlate } from '../types';
import { Mountain, Flame, History, Compass, ArrowUpRight, Clock } from 'lucide-react';

interface TectonicsDeepTimePanelProps {
  planet: PlanetData;
  onUpdateDeepTime: (ma: number) => void;
}

export const TectonicsDeepTimePanel: React.FC<TectonicsDeepTimePanelProps> = ({
  planet,
  onUpdateDeepTime,
}) => {
  const deepTime = planet.deepTimeMa || 0;

  return (
    <div className="flex flex-col gap-6 font-mono text-xs text-slate-300">
      {/* 1. Deep-Time Geodynamic Slider */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <History className="w-4 h-4 text-cyan-400" />
            <span>DEEP-TIME TECTONIC DRIFT SIMULATOR</span>
          </div>
          <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5 text-cyan-400" />
            <span className="text-cyan-300 font-bold">
              {deepTime === 0 ? 'PRESENT DAY (0 Ma)' : deepTime < 0 ? `${Math.abs(deepTime)} Ma Past (Ancient)` : `+${deepTime} Ma Future (Drift)`}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
          Slide across geological deep-time (Mega-annum) to simulate lithospheric continental drift, Wilson cycles, and supercontinent agglomeration or breakup.
        </p>

        <div className="space-y-2">
          <input
            type="range"
            min="-250"
            max="250"
            step="10"
            value={deepTime}
            onChange={(e) => onUpdateDeepTime(parseInt(e.target.value, 10))}
            className="w-full accent-cyan-400 cursor-pointer h-2 bg-slate-800 rounded-lg"
          />
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>-250 Ma (Supercontinent Pangea Assembly)</span>
            <button
              onClick={() => onUpdateDeepTime(0)}
              className="hover:text-cyan-400 transition-colors underline cursor-pointer"
            >
              Reset to 0 Ma
            </button>
            <span>+250 Ma (Future Supercontinent Amasia)</span>
          </div>
        </div>
      </div>

      {/* 2. Lithospheric Plates & Geodynamic Monitoring */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Mountain className="w-4 h-4 text-emerald-400" />
            <span>ACTIVE LITHOSPHERIC PLATES ({planet.plates.length} PLATES DETECTED)</span>
          </div>
          <span className="text-[11px] text-slate-400">Volcanic & Seismic Arc Telemetry</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {planet.plates.map((p) => (
            <div key={p.id} className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-slate-200 truncate">
                  <div style={{ backgroundColor: p.color }} className="w-2.5 h-2.5 rounded-full" />
                  <span className="truncate">{p.name}</span>
                </div>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                  p.isOceanic ? 'bg-blue-500/20 text-blue-300' : 'bg-emerald-500/20 text-emerald-300'
                }`}>
                  {p.isOceanic ? 'OCEANIC' : 'CONTINENTAL'}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-400">
                <div className="flex justify-between">
                  <span>Drift Velocity:</span>
                  <span className="text-cyan-400 font-bold">{p.velocityMmYr} mm/yr</span>
                </div>
                <div className="flex justify-between">
                  <span>Azimuth Heading:</span>
                  <span>{p.headingDeg}°</span>
                </div>
                <div className="flex justify-between">
                  <span>Center Lat/Lon:</span>
                  <span>{p.centerLat >= 0 ? '+' : ''}{p.centerLat}°, {p.centerLon >= 0 ? '+' : ''}{p.centerLon}°</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
