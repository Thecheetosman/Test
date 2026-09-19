import React from 'react';
import { PlanetData, SpectralType } from '../types';
import { PLANET_PRESETS } from '../utils/presets';
import { Sliders, RefreshCw, Sun, Globe, Wind, Droplets, Sparkles } from 'lucide-react';
import { calculateOrbitalPeriodDays, calculatePlanetDensity, calculateEscapeVelocity } from '../utils/physics';

interface PlanetEditorPanelProps {
  planet: PlanetData;
  onUpdatePlanet: (updater: (prev: PlanetData) => PlanetData) => void;
  onLoadPreset: (presetId: string) => void;
}

export const PlanetEditorPanel: React.FC<PlanetEditorPanelProps> = ({
  planet,
  onUpdatePlanet,
  onLoadPreset,
}) => {
  const handleArchetypeChange = (presetId: string) => {
    onLoadPreset(presetId);
  };

  const handleRandomizeSeed = () => {
    const newSeed = Math.floor(Math.random() * 1000000);
    onUpdatePlanet((prev) => ({
      ...prev,
      seed: newSeed,
    }));
  };

  const handleSpectralTypeChange = (type: SpectralType) => {
    let lum = 1.0;
    let radius = 1.0;
    let color = '#fbbf24';
    let temp = 5778;

    switch (type) {
      case 'O':
        lum = 40000;
        radius = 8.0;
        color = '#93c5fd';
        temp = 35000;
        break;
      case 'B':
        lum = 800;
        radius = 3.5;
        color = '#bfdbfe';
        temp = 18000;
        break;
      case 'A':
        lum = 25;
        radius = 1.8;
        color = '#f8fafc';
        temp = 8500;
        break;
      case 'F':
        lum = 3.2;
        radius = 1.3;
        color = '#fef08a';
        temp = 6500;
        break;
      case 'G':
        lum = 1.0;
        radius = 1.0;
        color = '#fde047';
        temp = 5778;
        break;
      case 'K':
        lum = 0.25;
        radius = 0.8;
        color = '#fb923c';
        temp = 4400;
        break;
      case 'M':
        lum = 0.015;
        radius = 0.35;
        color = '#f87171';
        temp = 3100;
        break;
      case 'Binary_G_M':
        lum = 2.4;
        radius = 1.5;
        color = '#fcd34d';
        temp = 6100;
        break;
    }

    const hzInner = Math.round(Math.sqrt(lum / 1.1) * 100) / 100;
    const hzOuter = Math.round(Math.sqrt(lum / 0.53) * 100) / 100;

    onUpdatePlanet((prev) => ({
      ...prev,
      star: {
        ...prev.star,
        spectralType: type,
        luminositySolar: lum,
        radiusSolar: radius,
        starColorHex: color,
        effectiveTemperatureK: temp,
        habitableZoneInnerAU: hzInner,
        habitableZoneOuterAU: hzOuter,
      },
    }));
  };

  return (
    <div className="flex flex-col gap-6 font-mono text-xs text-slate-300">
      {/* 1. Quick Preset Loader */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>PLANETARY ARCHETYPE PRESETS</span>
          </div>
          <button
            onClick={handleRandomizeSeed}
            className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg transition-colors text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Randomize Seed ({planet.seed})</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PLANET_PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => handleArchetypeChange(p.id)}
              className={`p-2.5 rounded-xl border text-left transition-all ${
                planet.archetype === p.archetype
                  ? 'bg-cyan-950/40 border-cyan-500/50 text-cyan-200'
                  : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="font-bold text-[11px] truncate">{p.name}</div>
              <div className="text-[10px] text-slate-500 capitalize">{p.archetype.replace('_', ' ')}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 2. Physical & Geodynamic Customization Sliders */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-100 text-sm border-b border-slate-800 pb-2">
          <Globe className="w-4 h-4 text-cyan-400" />
          <span>GEOPHYSICAL & TOPOGRAPHIC PARAMETERS</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Planet Name */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">PLANET DESIGNATION / NAME</label>
            <input
              type="text"
              value={planet.name}
              onChange={(e) =>
                onUpdatePlanet((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full bg-slate-950 border border-slate-700 px-3 py-1.5 rounded-lg text-slate-100 font-bold"
            />
          </div>

          {/* Sea Level / Hydrosphere */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>HYDROSPHERE / OCEAN LEVEL</span>
              <span className="text-cyan-400 font-bold">{planet.seaLevelPercent}%</span>
            </div>
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
          </div>

          {/* Radius (Earth radii) */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>PLANETARY RADIUS</span>
              <span className="text-cyan-400 font-bold">{planet.radiusEarth.toFixed(2)} R⊕</span>
            </div>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.05"
              value={planet.radiusEarth}
              onChange={(e) => {
                const r = parseFloat(e.target.value);
                onUpdatePlanet((prev) => {
                  const m = prev.massEarth;
                  const dens = calculatePlanetDensity(m, r);
                  const vEsc = calculateEscapeVelocity(m, r);
                  const g = m / (r * r);
                  return {
                    ...prev,
                    radiusEarth: r,
                    densityGcm3: dens,
                    escapeVelocityKms: vEsc,
                    surfaceGravityG: Math.round(g * 100) / 100,
                  };
                });
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Surface Gravity (g) */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>SURFACE GRAVITY</span>
              <span className="text-cyan-400 font-bold">{planet.surfaceGravityG.toFixed(2)} g</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="3.0"
              step="0.05"
              value={planet.surfaceGravityG}
              onChange={(e) => {
                const g = parseFloat(e.target.value);
                onUpdatePlanet((prev) => {
                  const r = prev.radiusEarth;
                  const newMass = g * r * r;
                  const dens = calculatePlanetDensity(newMass, r);
                  const vEsc = calculateEscapeVelocity(newMass, r);
                  return {
                    ...prev,
                    surfaceGravityG: g,
                    massEarth: Math.round(newMass * 100) / 100,
                    densityGcm3: dens,
                    escapeVelocityKms: vEsc,
                  };
                });
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Mean Base Surface Temperature */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>MEAN BASE SURFACE TEMP</span>
              <span className="text-amber-300 font-bold">{planet.meanAnnualSurfaceTempC}°C</span>
            </div>
            <input
              type="range"
              min="-120"
              max="150"
              step="1"
              value={planet.meanAnnualSurfaceTempC}
              onChange={(e) => {
                const t = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  meanAnnualSurfaceTempC: t,
                }));
              }}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Axial Tilt */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>AXIAL TILT (SEASONS)</span>
              <span className="text-cyan-400 font-bold">{planet.axialTiltDeg.toFixed(1)}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="90"
              step="0.5"
              value={planet.axialTiltDeg}
              onChange={(e) => {
                const tilt = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({ ...prev, axialTiltDeg: tilt }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Rotation Period (Day Length in hours) */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ROTATION PERIOD (DAY LENGTH)</span>
              <span className="text-cyan-400 font-bold">{planet.rotationPeriodHours.toFixed(1)} Hours</span>
            </div>
            <input
              type="range"
              min="4"
              max="120"
              step="1"
              value={planet.rotationPeriodHours}
              onChange={(e) => {
                const hrs = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  rotationPeriodHours: hrs,
                  calendar: {
                    ...prev.calendar,
                    hoursPerDay: hrs,
                    daysPerYear: Math.round((prev.orbitalPeriodDays * 24) / hrs),
                  },
                }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Atmospheric Pressure (atm) */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ATMOSPHERIC SURFACE PRESSURE</span>
              <span className="text-cyan-400 font-bold">{planet.atmosphere.surfacePressureAtm.toFixed(2)} atm</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="15.0"
              step="0.05"
              value={planet.atmosphere.surfacePressureAtm}
              onChange={(e) => {
                const p = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  atmosphere: {
                    ...prev.atmosphere,
                    surfacePressureAtm: p,
                    scaleHeightKm: Math.round((8.5 / Math.max(0.1, prev.surfaceGravityG)) * 10) / 10,
                  },
                }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 3. Star System & Orbital Architecture */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
        <div className="flex items-center gap-2 font-bold text-slate-100 text-sm border-b border-slate-800 pb-2">
          <Sun className="w-4 h-4 text-amber-400" />
          <span>STELLAR HOST & ORBITAL TRAJECTORY</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">PARENT STAR SPECTRAL CLASSIFICATION</label>
            <select
              value={planet.star.spectralType}
              onChange={(e) => handleSpectralTypeChange(e.target.value as any)}
              className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-amber-300 font-bold"
            >
              <option value="O">O-Type (Hyper-Luminous Blue Giant, 35,000K)</option>
              <option value="B">B-Type (Blue-White Star, 18,000K)</option>
              <option value="A">A-Type (Sirius-like Pure White Star, 8,500K)</option>
              <option value="F">F-Type (Yellow-White Star, 6,500K)</option>
              <option value="G">G-Type (Solar Analog Yellow Dwarf, 5,778K)</option>
              <option value="K">K-Type (Orange Dwarf, Stable 4,400K)</option>
              <option value="M">M-Type (Red Dwarf Flare Star, 3,100K)</option>
              <option value="Binary_G_M">Binary System (Circumbinary Double Star)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ORBITAL SEMI-MAJOR AXIS</span>
              <span className="text-cyan-400 font-bold">{planet.semiMajorAxisAU.toFixed(2)} AU</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="4.0"
              step="0.05"
              value={planet.semiMajorAxisAU}
              onChange={(e) => {
                const au = parseFloat(e.target.value);
                const pDays = calculateOrbitalPeriodDays(au, planet.star.massSolar);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  semiMajorAxisAU: au,
                  orbitalPeriodDays: pDays,
                  calendar: {
                    ...prev.calendar,
                    daysPerYear: Math.round((pDays * 24) / prev.rotationPeriodHours),
                  },
                }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ORBITAL ECCENTRICITY (e)</span>
              <span className="text-cyan-400 font-bold">{planet.eccentricity.toFixed(3)}</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="0.6"
              step="0.01"
              value={planet.eccentricity}
              onChange={(e) => {
                const ecc = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({ ...prev, eccentricity: ecc }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>CLOUD COVERAGE</span>
              <span className="text-cyan-400 font-bold">{planet.atmosphere.cloudCoveragePercent}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={planet.atmosphere.cloudCoveragePercent}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({
                  ...prev,
                  atmosphere: { ...prev.atmosphere, cloudCoveragePercent: val },
                }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 4. Advanced Topography & Geomorphology */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Globe className="w-4 h-4 text-emerald-400" />
            <span>ADVANCED TOPOGRAPHY & GEOMORPHOLOGY</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
            DEM & HEIGHTMAP
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Mountain Roughness */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>MOUNTAIN ROUGHNESS (HURST EXPONENT)</span>
              <span className="text-emerald-400 font-bold">{(planet.mountainRoughness ?? 0.7).toFixed(2)}</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="1.5"
              step="0.05"
              value={planet.mountainRoughness ?? 0.7}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({ ...prev, mountainRoughness: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Orogeny Intensity */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>OROGENY UPLIFT (TECTONIC COLLISION)</span>
              <span className="text-emerald-400 font-bold">{(planet.orogenyIntensity ?? 1.0).toFixed(2)}x</span>
            </div>
            <input
              type="range"
              min="0.2"
              max="3.0"
              step="0.1"
              value={planet.orogenyIntensity ?? 1.0}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({ ...prev, orogenyIntensity: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Erosion Rate */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>HYDRAULIC & THERMAL EROSION RATE</span>
              <span className="text-emerald-400 font-bold">{planet.erosionRate ?? 35}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={planet.erosionRate ?? 35}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, erosionRate: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Impact Crater Bombardment */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ANCIENT IMPACT CRATER DENSITY</span>
              <span className="text-emerald-400 font-bold">{planet.impactCraterDensity ?? 15}%</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={planet.impactCraterDensity ?? 15}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, impactCraterDensity: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Continental Shelf Width */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>NERITIC CONTINENTAL SHELF WIDTH</span>
              <span className="text-emerald-400 font-bold">{planet.continentalShelfWidthKm ?? 80} km</span>
            </div>
            <input
              type="range"
              min="10"
              max="300"
              step="10"
              value={planet.continentalShelfWidthKm ?? 80}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, continentalShelfWidthKm: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>

          {/* Volcanic Hotspots */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>MANTLE PLUME VOLCANIC HOTSPOTS</span>
              <span className="text-emerald-400 font-bold">{planet.volcanicHotspots ?? 6}</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={planet.volcanicHotspots ?? 6}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, volcanicHotspots: val }));
              }}
              className="w-full accent-emerald-400 cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* 5. Advanced Atmosphere, Climate & Astrobiology */}
      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 font-bold text-slate-100 text-sm">
            <Wind className="w-4 h-4 text-cyan-400" />
            <span>ADVANCED ATMOSPHERE & ASTROBIOLOGY</span>
          </div>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-400 border border-cyan-500/30">
            SPECTRAL BIOSPHERE
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Flora Pigment Type */}
          <div>
            <label className="text-[10px] text-slate-400 block mb-1">FLORA SPECTRAL PIGMENTATION</label>
            <select
              value={planet.floraPigmentType ?? 'chlorophyll_green'}
              onChange={(e) => {
                const val = e.target.value as any;
                onUpdatePlanet((prev) => ({ ...prev, floraPigmentType: val }));
              }}
              className="w-full bg-slate-950 border border-slate-700 p-2 rounded-lg text-cyan-300 font-bold text-xs"
            >
              <option value="chlorophyll_green">Chlorophyll Green (Standard G-Type Solar)</option>
              <option value="retinal_purple">Retinal Purple (Archaea / Purple Rhodopsin)</option>
              <option value="carotenoid_red">Carotenoid Red (M-Dwarf Low-Flux Crimson)</option>
              <option value="xanthophyll_gold">Xanthophyll Gold (Warm Amber Canopy)</option>
              <option value="melanin_black">Melanin Obsidian (High-UV Radiation Absorber)</option>
            </select>
          </div>

          {/* Polar Glaciation Cap Limit */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>POLAR GLACIATION THRESHOLD</span>
              <span className="text-cyan-400 font-bold">±{planet.polarCapLatitudeDeg ?? 72}° LAT</span>
            </div>
            <input
              type="range"
              min="40"
              max="88"
              step="1"
              value={planet.polarCapLatitudeDeg ?? 72}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, polarCapLatitudeDeg: val }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Greenhouse Gas CO2 eq */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>GREENHOUSE GAS CONCENTRATION</span>
              <span className="text-cyan-400 font-bold">{planet.greenhouseGasPpm ?? 420} ppm</span>
            </div>
            <input
              type="range"
              min="50"
              max="5000"
              step="50"
              value={planet.greenhouseGasPpm ?? 420}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, greenhouseGasPpm: val }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Atmospheric Aerosol Haze */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>AEROSOL OPTICAL HAZE</span>
              <span className="text-cyan-400 font-bold">{(planet.atmosphericHaze ?? 0.2).toFixed(2)} AOD</span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.0"
              step="0.05"
              value={planet.atmosphericHaze ?? 0.2}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                onUpdatePlanet((prev) => ({ ...prev, atmosphericHaze: val }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Ocean Salinity */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>HYDROSPHERE OCEAN SALINITY</span>
              <span className="text-cyan-400 font-bold">{planet.oceanSalinityPpt ?? 35} ppt</span>
            </div>
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={planet.oceanSalinityPpt ?? 35}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, oceanSalinityPpt: val }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>

          {/* Coriolis Circulation Bands */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ATMOSPHERIC CORIOLIS CIRCULATION CELLS</span>
              <span className="text-cyan-400 font-bold">{planet.coriolisBeltCount ?? 3} Cells</span>
            </div>
            <input
              type="range"
              min="2"
              max="8"
              step="1"
              value={planet.coriolisBeltCount ?? 3}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                onUpdatePlanet((prev) => ({ ...prev, coriolisBeltCount: val }));
              }}
              className="w-full accent-cyan-400 cursor-pointer"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
