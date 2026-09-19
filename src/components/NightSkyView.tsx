import React, { useState } from 'react';
import { PlanetData, MoonData } from '../types';
import { calculateAngularDiameterArcmin, assessEclipseCapability } from '../utils/physics';
import { Moon, Sun, Sparkles, Clock, Eye } from 'lucide-react';

interface NightSkyViewProps {
  planet: PlanetData;
}

export const NightSkyView: React.FC<NightSkyViewProps> = ({ planet }) => {
  const [hourOfDay, setHourOfDay] = useState<number>(planet.rotationPeriodHours * 0.95); // default night/dusk

  const star = planet.star;
  const isAirless = planet.atmosphere.surfacePressureAtm < 0.001;

  // Calculate sun elevation in sky from 0 to 180 degrees (0 = horizon dawn, 90 = zenith, 180 = sunset, >180 = night)
  const dayFraction = (hourOfDay % planet.rotationPeriodHours) / planet.rotationPeriodHours;
  const sunElevationDeg = Math.sin(dayFraction * Math.PI * 2) * 90;
  const isDaytime = sunElevationDeg > 0;

  // Star visual sizing
  const starDiameterKm = star.radiusSolar * 1392700;
  const planetDistKm = planet.semiMajorAxisAU * 149597870.7;
  const starArcmin = calculateAngularDiameterArcmin(starDiameterKm, planetDistKm);

  // Background sky styling
  const getSkyBackground = () => {
    if (isAirless) {
      return 'linear-gradient(to bottom, #020617 0%, #000000 100%)';
    }
    if (!isDaytime) {
      return 'linear-gradient(to bottom, #020617 0%, #090d1f 60%, #17152b 100%)';
    }
    if (sunElevationDeg < 12) {
      // Sunset / Sunrise twilight
      return `linear-gradient(to bottom, #0f172a 0%, ${planet.atmosphere.sunsetGlowHex}88 60%, ${planet.atmosphere.sunsetGlowHex} 100%)`;
    }
    // Full daylight
    return `linear-gradient(to bottom, ${planet.atmosphere.skyColorHex} 0%, #ffffff33 100%)`;
  };

  return (
    <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 shadow-2xl flex flex-col gap-4 font-mono">
      {/* Header and Time Slider */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-200 font-bold text-sm">SURFACE OBSERVATORY & NIGHT SKY VIEW</span>
        </div>

        <div className="flex items-center gap-2 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
          <Clock className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-slate-400">Local Planetary Time:</span>
          <span className="text-cyan-300 font-bold">{hourOfDay.toFixed(1)}h / {planet.rotationPeriodHours.toFixed(1)}h</span>
          <input
            type="range"
            min="0"
            max={planet.rotationPeriodHours}
            step="0.2"
            value={hourOfDay}
            onChange={(e) => setHourOfDay(parseFloat(e.target.value))}
            className="w-28 accent-cyan-400 cursor-pointer ml-2"
          />
        </div>
      </div>

      {/* Sky Canvas View Box */}
      <div
        style={{ background: getSkyBackground() }}
        className="relative w-full h-[360px] rounded-xl overflow-hidden border border-slate-800 transition-all duration-300 flex flex-col justify-end"
      >
        {/* Starfield visible at night or on airless worlds */}
        {(!isDaytime || isAirless) && (
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 60 }).map((_, i) => (
              <div
                key={i}
                style={{
                  top: `${(i * 17.3) % 85}%`,
                  left: `${(i * 29.1) % 96}%`,
                  width: i % 4 === 0 ? '2px' : '1.2px',
                  height: i % 4 === 0 ? '2px' : '1.2px',
                  opacity: (i % 3 === 0 ? 0.9 : 0.5),
                }}
                className="absolute bg-white rounded-full"
              />
            ))}
          </div>
        )}

        {/* Parent Star in Sky */}
        {isDaytime && (
          <div
            style={{
              top: `${Math.max(10, 85 - (sunElevationDeg / 90) * 75)}%`,
              left: `${dayFraction * 80 + 10}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute flex flex-col items-center pointer-events-none"
          >
            <div
              style={{
                width: `${Math.max(28, Math.min(80, (starArcmin / 32) * 45))}px`,
                height: `${Math.max(28, Math.min(80, (starArcmin / 32) * 45))}px`,
                backgroundColor: star.starColorHex,
                boxShadow: `0 0 ${starArcmin * 1.5}px ${star.starColorHex}, 0 0 60px ${star.starColorHex}66`,
              }}
              className="rounded-full"
            />
            <span className="text-[10px] text-white/80 bg-slate-900/60 px-1.5 py-0.5 rounded mt-1 backdrop-blur-xs">
              {star.name} ({starArcmin}&apos;)
            </span>
          </div>
        )}

        {/* Moon System rendered in Night Sky */}
        <div className="absolute top-8 left-8 right-8 flex flex-wrap gap-8 justify-center pointer-events-none">
          {planet.moons.map((m, idx) => {
            const { canTotalEclipse, moonArcmin, ratio } = assessEclipseCapability(
              star.radiusSolar,
              planet.semiMajorAxisAU,
              m.radiusEarth,
              m.semiMajorAxisKm
            );

            // Phase illumination based on local hour
            const phaseFactor = ((hourOfDay / planet.rotationPeriodHours) + idx * 0.25) % 1.0;
            const moonPx = Math.max(24, Math.min(70, (moonArcmin / 32) * 40));

            return (
              <div key={m.id} className="flex flex-col items-center bg-slate-900/75 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 text-xs">
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="w-4 h-4 text-slate-300" />
                  <span className="font-bold text-slate-100">{m.name}</span>
                </div>

                {/* Moon Visual Disk */}
                <div
                  style={{
                    width: `${moonPx}px`,
                    height: `${moonPx}px`,
                    backgroundColor: m.colorHex,
                    boxShadow: '0 0 16px rgba(255,255,255,0.2)',
                  }}
                  className="rounded-full relative overflow-hidden border border-slate-600 mb-2"
                >
                  {/* Shadow overlay for phase */}
                  <div
                    style={{
                      transform: `translateX(${(phaseFactor - 0.5) * 100}%)`,
                    }}
                    className="absolute inset-0 bg-slate-950/85 transition-all duration-150"
                  />
                </div>

                <div className="space-y-0.5 text-[10px] text-slate-300 text-center">
                  <div>Angular Size: <strong>{moonArcmin}&apos;</strong></div>
                  <div className={canTotalEclipse ? 'text-emerald-400 font-semibold' : 'text-amber-400'}>
                    {canTotalEclipse ? 'Total Eclipse Capable' : 'Annular Eclipse Only'} (Ratio: {ratio}x)
                  </div>
                  <div className="text-slate-400">Dist: {m.semiMajorAxisKm.toLocaleString()} km</div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Planet Horizon Landscape Silhouette */}
        <div className="w-full h-14 bg-gradient-to-t from-slate-950 to-slate-900/90 border-t border-slate-700 flex items-center justify-between px-6 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">HORIZON AZIMUTH:</span>
            <span>0° NORTH</span>
          </div>
          <div>
            ATMOSPHERE: <strong className="text-cyan-400">{planet.atmosphere.surfacePressureAtm} atm</strong> ({planet.atmosphere.breathableHuman ? 'Breathable' : 'Toxic/Hostile'})
          </div>
        </div>
      </div>
    </div>
  );
};
