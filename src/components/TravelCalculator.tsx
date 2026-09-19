import React, { useState } from 'react';
import { PlanetData, SurfaceTravelMode, InterplanetaryDestination } from '../types';
import {
  calculateGreatCircleDistanceKm,
  calculateSurfaceTravelTime,
  calculateBrachistochroneTransit,
  AU_KM,
  LY_KM,
} from '../utils/physics';
import { Rocket, Navigation, MapPin, Gauge, Clock, Sparkles } from 'lucide-react';

interface TravelCalculatorProps {
  planet: PlanetData;
  originCoord?: { lat: number; lon: number } | null;
  destCoord?: { lat: number; lon: number } | null;
  onSetOrigin: (lat: number, lon: number) => void;
  onSetDest: (lat: number, lon: number) => void;
}

const INTERPLANETARY_DESTINATIONS: InterplanetaryDestination[] = [
  { id: 'dest-moon-1', name: 'Primary Natural Moon', distanceAU: 0.00257, systemName: 'Local Planetary System' },
  { id: 'dest-sister-inner', name: 'Inner Sister Planet (Terraformed)', distanceAU: 0.38, systemName: 'Helios System' },
  { id: 'dest-gas-giant', name: 'Gas Giant Jovian Base', distanceAU: 4.2, systemName: 'Helios Outer System' },
  { id: 'dest-alpha-centauri', name: 'Alpha Centauri System', distanceAU: 276000, distanceLightYears: 4.37, systemName: 'Centauri Prime' },
  { id: 'dest-kepler-186', name: 'Kepler-186 Habitable System', distanceAU: 36800000, distanceLightYears: 582, systemName: 'Cygnus Expanse' },
];

export const TravelCalculator: React.FC<TravelCalculatorProps> = ({
  planet,
  originCoord,
  destCoord,
  onSetOrigin,
  onSetDest,
}) => {
  const [activeTab, setActiveTab] = useState<'surface' | 'interplanetary'>('surface');
  const [surfaceMode, setSurfaceMode] = useState<SurfaceTravelMode>('suborbital_rocket');

  // Surface manual coordinate inputs
  const [origLat, setOrigLat] = useState<number>(originCoord?.lat ?? 15.0);
  const [origLon, setOrigLon] = useState<number>(originCoord?.lon ?? -45.0);
  const [dLat, setDLat] = useState<number>(destCoord?.lat ?? -22.0);
  const [dLon, setDLon] = useState<number>(destCoord?.lon ?? 85.0);

  // Interplanetary parameters
  const [selectedDestId, setSelectedDestId] = useState<string>('dest-moon-1');
  const [accelG, setAccelG] = useState<number>(1.0); // 1g comfortable burn

  // Calculate surface metrics
  const surfaceDistanceKm = calculateGreatCircleDistanceKm(
    origLat,
    origLon,
    dLat,
    dLon,
    planet.radiusEarth
  );
  const surfaceResult = calculateSurfaceTravelTime(surfaceDistanceKm, surfaceMode);

  // Calculate interplanetary metrics
  const selectedDest = INTERPLANETARY_DESTINATIONS.find((d) => d.id === selectedDestId) || INTERPLANETARY_DESTINATIONS[0];
  const interplanetaryDistanceKm = selectedDest.distanceLightYears
    ? selectedDest.distanceLightYears * LY_KM
    : selectedDest.distanceAU * AU_KM;
  const transitResult = calculateBrachistochroneTransit(interplanetaryDistanceKm, accelG);

  const applyCoordinates = () => {
    onSetOrigin(origLat, origLon);
    onSetDest(dLat, dLon);
  };

  return (
    <div className="flex flex-col gap-6 font-mono text-xs text-slate-300">
      {/* Mode Selector */}
      <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
        <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
          <Navigation className="w-4 h-4 text-cyan-400" />
          <span>ASTRODYNAMIC TRAVEL TIME & TRAJECTORY CALCULATOR</span>
        </div>

        <div className="flex items-center bg-slate-800 p-0.5 rounded-lg">
          <button
            onClick={() => setActiveTab('surface')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'surface' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Surface Planetary Transit
          </button>
          <button
            onClick={() => setActiveTab('interplanetary')}
            className={`px-3 py-1.5 rounded-md transition-colors ${
              activeTab === 'interplanetary' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Interplanetary & Interstellar
          </button>
        </div>
      </div>

      {activeTab === 'surface' ? (
        /* 1. SURFACE TRANSIT CALCULATOR */
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Origin */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 font-bold text-emerald-400 text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>ORIGIN COORDINATES</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">LATITUDE (-90° to 90°)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={origLat}
                      onChange={(e) => setOrigLat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">LONGITUDE (-180° to 180°)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={origLon}
                      onChange={(e) => setOrigLon(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                </div>
              </div>

              {/* Destination */}
              <div className="space-y-2 bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2 font-bold text-rose-400 text-xs">
                  <MapPin className="w-3.5 h-3.5" />
                  <span>DESTINATION COORDINATES</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500">LATITUDE (-90° to 90°)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={dLat}
                      onChange={(e) => setDLat(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">LONGITUDE (-180° to 180°)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={dLon}
                      onChange={(e) => setDLon(parseFloat(e.target.value) || 0)}
                      className="w-full bg-slate-900 border border-slate-700 px-2 py-1 rounded text-slate-200"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-slate-400">VEHICLE CLASS:</span>
                <select
                  value={surfaceMode}
                  onChange={(e) => setSurfaceMode(e.target.value as any)}
                  className="bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-cyan-300 font-bold"
                >
                  <option value="suborbital_rocket">Suborbital Ballistic Shuttle (~27,000 km/h)</option>
                  <option value="hypersonic_craft">Scramjet Atmospheric Waverider (Mach 4.2)</option>
                  <option value="vactrain_maglev">Evacuated Tube Maglev (1,200 km/h)</option>
                  <option value="ground_rover">Rugged Exploration Rover (75 km/h)</option>
                  <option value="ocean_vessel">High-Speed Hydrofoil (55 km/h)</option>
                </select>
              </div>

              <button
                onClick={applyCoordinates}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all"
              >
                Plot Route on Map
              </button>
            </div>
          </div>

          {/* Results Card */}
          <div className="bg-slate-900/90 border border-cyan-500/40 p-4 rounded-xl grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <span className="text-slate-400">GREAT-CIRCLE DISTANCE</span>
              <div className="text-xl font-bold text-slate-100 mt-1 font-sans">
                {surfaceDistanceKm.toLocaleString()} <span className="text-xs font-normal text-slate-400">km</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {(surfaceDistanceKm * 0.621371).toLocaleString(undefined, { maximumFractionDigits: 0 })} statute miles
              </div>
            </div>

            <div>
              <span className="text-slate-400">ESTIMATED TRANSIT TIME</span>
              <div className="text-xl font-bold text-cyan-400 mt-1 font-sans">
                {surfaceResult.hours < 1
                  ? `${Math.round(surfaceResult.hours * 60)} mins`
                  : `${surfaceResult.hours.toFixed(1)} hrs`}
              </div>
              <div className="text-[10px] text-slate-500">
                {surfaceResult.hours > 24 ? `(${(surfaceResult.hours / planet.rotationPeriodHours).toFixed(1)} local sols)` : 'Sub-sol flight'}
              </div>
            </div>

            <div>
              <span className="text-slate-400">CRUISE VELOCITY</span>
              <div className="text-xl font-bold text-slate-100 mt-1 font-sans">
                {surfaceResult.speedKmh.toLocaleString()} <span className="text-xs font-normal text-slate-400">km/h</span>
              </div>
              <div className="text-[10px] text-slate-500">{surfaceResult.description}</div>
            </div>

            <div>
              <span className="text-slate-400">DELTA-V BUDGET</span>
              <div className="text-xl font-bold text-amber-300 mt-1 font-sans">
                {surfaceResult.deltaVKms ? `${surfaceResult.deltaVKms} km/s` : 'Atmospheric / Maglev'}
              </div>
              <div className="text-[10px] text-slate-500">Exoatmospheric burn</div>
            </div>
          </div>
        </div>
      ) : (
        /* 2. INTERPLANETARY & RELATIVISTIC INTERSTELLAR CALCULATOR */
        <div className="space-y-4">
          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] text-slate-400 block mb-1">DESTINATION SYSTEM OR BODY</label>
                <select
                  value={selectedDestId}
                  onChange={(e) => setSelectedDestId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 p-2.5 rounded-lg text-slate-200"
                >
                  {INTERPLANETARY_DESTINATIONS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.distanceLightYears ? `${d.distanceLightYears} LY` : `${d.distanceAU} AU`}) — {d.systemName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[10px] text-slate-400 block mb-1">CONTINUOUS ACCELERATION (BRACHISTOCHRONE FLIP & BURN)</label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="0.1"
                    max="3.0"
                    step="0.1"
                    value={accelG}
                    onChange={(e) => setAccelG(parseFloat(e.target.value))}
                    className="w-full accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-cyan-400 font-bold text-sm min-w-[50px]">{accelG.toFixed(1)} g</span>
                </div>
                <div className="text-[10px] text-slate-500 mt-1">
                  1.0g provides Earth-normal artificial gravity throughout voyage.
                </div>
              </div>
            </div>
          </div>

          {/* Relativistic Results Card */}
          <div className="bg-slate-900/90 border border-purple-500/40 p-4 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-cyan-400" />
                SHIPBOARD PROPER TIME (Crew Time)
              </span>
              <div className="text-2xl font-bold text-cyan-300 mt-1 font-sans">
                {transitResult.shipDays < 365
                  ? `${transitResult.shipDays.toFixed(1)} Days`
                  : `${(transitResult.shipDays / 365.25).toFixed(2)} Earth Years`}
              </div>
              <div className="text-[10px] text-slate-500">Experienced by passengers on ship</div>
            </div>

            <div>
              <span className="text-slate-400 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-purple-400" />
                COORDINATE TIME (Stationary Observer)
              </span>
              <div className="text-2xl font-bold text-purple-300 mt-1 font-sans">
                {transitResult.coordinateDays < 365
                  ? `${transitResult.coordinateDays.toFixed(1)} Days`
                  : `${(transitResult.coordinateDays / 365.25).toFixed(2)} Earth Years`}
              </div>
              <div className="text-[10px] text-slate-500">
                Time elapsed on departure planet
              </div>
            </div>

            <div>
              <span className="text-slate-400 flex items-center gap-1.5">
                <Gauge className="w-3.5 h-3.5 text-amber-400" />
                MAX TURNOVER VELOCITY (β)
              </span>
              <div className="text-2xl font-bold text-amber-300 mt-1 font-sans">
                {(transitResult.maxSpeedC * 100).toFixed(2)}% <span className="text-xs font-normal text-slate-400">c</span>
              </div>
              <div className="text-[10px] text-slate-500">
                {transitResult.maxSpeedC > 0.1 ? 'Relativistic lorentz dilation active' : 'Newtonian classical regime'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
