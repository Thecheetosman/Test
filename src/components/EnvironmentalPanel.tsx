import React from 'react';
import { PlanetData, MineralDeposit } from '../types';
import { Gauge, Wind, Shield, Mountain, Activity, Gem, Droplets, Thermometer, Compass } from 'lucide-react';

interface EnvironmentalPanelProps {
  planet: PlanetData;
  onSelectMineralForOverlay?: (mineral: MineralDeposit) => void;
}

export const EnvironmentalPanel: React.FC<EnvironmentalPanelProps> = ({
  planet,
  onSelectMineralForOverlay,
}) => {
  const atmo = planet.atmosphere;

  return (
    <div className="flex flex-col gap-6 font-mono text-xs text-slate-300">
      {/* 1. Core Planetary Geophysics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <span>SURFACE GRAVITY</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-sans">
            {planet.surfaceGravityG.toFixed(2)} <span className="text-xs font-normal text-slate-400">g</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {planet.surfaceGravityG > 1.25 ? 'High Gravity (Structural strain)' : planet.surfaceGravityG < 0.6 ? 'Low Gravity (Bone loss risk)' : 'Standard Terran range'}
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span>SURFACE PRESSURE</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-sans">
            {atmo.surfacePressureAtm.toFixed(2)} <span className="text-xs font-normal text-slate-400">atm</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Scale Height: {atmo.scaleHeightKm} km
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Activity className="w-4 h-4 text-cyan-400" />
            <span>ESCAPE VELOCITY</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-sans">
            {planet.escapeVelocityKms.toFixed(2)} <span className="text-xs font-normal text-slate-400">km/s</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            Density: {planet.densityGcm3.toFixed(2)} g/cm³
          </div>
        </div>

        <div className="bg-slate-900/90 border border-slate-800 p-3.5 rounded-xl">
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Shield className="w-4 h-4 text-cyan-400" />
            <span>MAGNETIC DYNAMO</span>
          </div>
          <div className="text-xl font-bold text-slate-100 font-sans">
            {planet.magneticFieldGauss.toFixed(2)} <span className="text-xs font-normal text-slate-400">Gauss</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-1">
            {planet.magneticFieldGauss > 0.3 ? 'Full Van Allen magnetosphere' : 'Depleted; solar wind erosion'}
          </div>
        </div>
      </div>

      {/* 2. Atmospheric Chemistry Breakdown */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span>ATMOSPHERIC COMPOSITION & GREENHOUSE METRICS</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
            atmo.breathableHuman ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300 border border-red-500/40'
          }`}>
            {atmo.breathableHuman ? 'BREATHABLE (IVA Unneeded)' : 'HAZARDOUS / UNBREATHABLE'}
          </span>
        </div>

        {/* Toxicity warnings if any */}
        {atmo.toxicityAlerts.length > 0 && (
          <div className="mb-3 p-2.5 bg-red-950/40 border border-red-900/60 rounded-lg text-red-300 text-[11px] space-y-0.5">
            {atmo.toxicityAlerts.map((t, idx) => (
              <div key={idx}>⚠ {t}</div>
            ))}
          </div>
        )}

        <div className="space-y-2">
          {atmo.gases.map((g) => (
            <div key={g.symbol} className="space-y-1">
              <div className="flex justify-between text-[11px]">
                <span className="text-slate-300 font-semibold">{g.name} ({g.symbol})</span>
                <span className="text-cyan-400 font-bold">{g.percentage.toFixed(2)}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, g.percentage)}%` }}
                  className="h-full bg-cyan-500 rounded-full"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
          <div>
            <span className="text-slate-500">Greenhouse Warming:</span>
            <div className="text-amber-400 font-bold">+{atmo.greenhouseFactorK} K</div>
          </div>
          <div>
            <span className="text-slate-500">Cloud Shroud:</span>
            <div className="text-slate-200">{atmo.cloudCoveragePercent}% global coverage</div>
          </div>
          <div>
            <span className="text-slate-500">Atmospheric Haze:</span>
            <div className="text-slate-200">{(atmo.hazeDensity * 100).toFixed(0)}% opacity</div>
          </div>
        </div>
      </div>

      {/* 3. Strategic Ore Deposit Prospectus & Mineral Extraction Zones */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Gem className="w-4 h-4 text-purple-400" />
            <span>ORE DEPOSIT HEAT MAPPING & MINERAL WEALTH PROSPECTUS</span>
          </div>
          <span className="text-[11px] text-slate-400">Crustal Abundance Analysis</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {planet.minerals.map((m) => (
            <div
              key={m.id}
              onClick={() => onSelectMineralForOverlay && onSelectMineralForOverlay(m)}
              className="bg-slate-950/60 hover:bg-slate-800/80 transition-all p-3 rounded-xl border border-slate-800 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div
                      style={{ backgroundColor: m.heatmapColor }}
                      className="w-3 h-3 rounded-full shadow-sm"
                    />
                    <span className="font-bold text-slate-200">{m.name}</span>
                  </div>
                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] uppercase font-bold text-cyan-300">
                    {m.economicValueTier}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Abundance: <strong className="text-slate-200">{m.crustalAbundancePpm} ppm</strong>
                </div>
                <p className="text-[10px] text-slate-500 mt-1 line-clamp-2">
                  {m.geologicalOrigin}
                </p>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-800/80 flex justify-between items-center text-[10px] text-purple-400">
                <span>View Mineral Heatmap</span>
                <span>→</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
