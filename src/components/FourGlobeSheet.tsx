import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlanetData, MapOverlayType, MapStyleType } from '../types';
import { PlanetTerrainEngine, getPixelColor } from '../utils/proceduralTerrain';
import { RotateCw, Sun, Moon, Sparkles } from 'lucide-react';

interface FourGlobeSheetProps {
  planet: PlanetData;
  overlay: MapOverlayType;
  style: MapStyleType;
  solarHour: number;
}

interface GlobeOrientation {
  id: string;
  label: string;
  subLabel: string;
  rotX: number;
  rotY: number;
}

export const FourGlobeSheet: React.FC<FourGlobeSheetProps> = ({
  planet,
  overlay,
  style,
  solarHour,
}) => {
  const views: GlobeOrientation[] = [
    { id: 'prime', label: 'PRIME HEMISPHERE', subLabel: '0° Meridian (Frontal Equator)', rotX: planet.axialTiltDeg * 0.4, rotY: 0 },
    { id: 'anti', label: 'ANTIPODAL HEMISPHERE', subLabel: '180° Anti-Meridian (Rear Equator)', rotX: planet.axialTiltDeg * 0.4, rotY: 180 },
    { id: 'north', label: 'BOREAL POLAR VIEW', subLabel: '+90° North Geographic Apex', rotX: 85, rotY: 0 },
    { id: 'south', label: 'AUSTRAL POLAR VIEW', subLabel: '-90° South Geographic Apex', rotX: -85, rotY: 180 },
  ];

  return (
    <div className="w-full h-full p-4 bg-black text-slate-200 overflow-y-auto select-none font-mono">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
        <div>
          <h2 className="text-sm font-bold text-amber-300 tracking-wider flex items-center gap-2">
            <Sun className="w-4 h-4 text-amber-400" />
            <span>FOUR GLOBE VIEWS SHEET (ORTHOGRAPHIC QUADRANTS)</span>
          </h2>
          <p className="text-xs text-slate-400">
            Real-time day/night terminator masks with axial tilt ({planet.axialTiltDeg.toFixed(1)}°) and solar hour ({solarHour.toFixed(1)}h)
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="px-2 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400">
            Terminator: Dynamic
          </span>
          <span className="px-2 py-1 rounded bg-amber-950/60 border border-amber-500/40 text-amber-300">
            Solar Declination: {(planet.axialTiltDeg * Math.sin((65 * Math.PI) / 180)).toFixed(1)}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
        {views.map((v) => (
          <SingleGlobeQuadrant
            key={v.id}
            planet={planet}
            overlay={overlay}
            style={style}
            solarHour={solarHour}
            orientation={v}
          />
        ))}
      </div>
    </div>
  );
};

interface SingleGlobeQuadrantProps {
  planet: PlanetData;
  overlay: MapOverlayType;
  style: MapStyleType;
  solarHour: number;
  orientation: GlobeOrientation;
}

const SingleGlobeQuadrant: React.FC<SingleGlobeQuadrantProps> = ({
  planet,
  overlay,
  style,
  solarHour,
  orientation,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const engineRef = useRef<PlanetTerrainEngine>(new PlanetTerrainEngine(planet));

  useEffect(() => {
    engineRef.current.updatePlanet(planet);
  }, [planet]);

  const renderView = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = 280;
    const height = 280;
    canvas.width = width;
    canvas.height = height;

    const cx = width / 2;
    const cy = height / 2;
    const radius = width * 0.42;

    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, width, height);

    // Subtle atmosphere glow
    if (planet.atmosphere.surfacePressureAtm > 0.05) {
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.18);
      glowGrad.addColorStop(0, 'transparent');
      glowGrad.addColorStop(0.7, `${planet.atmosphere.skyColorHex}25`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.18, 0, Math.PI * 2);
      ctx.fill();
    }

    const radX = (orientation.rotX * Math.PI) / 180;
    const radY = (orientation.rotY * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    // Stellar declination and subsolar longitude
    const tiltRad = (planet.axialTiltDeg * Math.PI) / 180;
    const seasonRad = (65 * Math.PI) / 180;
    const declinationRad = Math.asin(Math.sin(tiltRad) * Math.sin(seasonRad));
    const sinDec = Math.sin(declinationRad);
    const cosDec = Math.cos(declinationRad);

    const subsolarLonRad = (((solarHour / 24) * 360 - 180) * Math.PI) / 180;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    const r2 = radius * radius;
    const rInt = Math.ceil(radius);
    const minX = Math.max(0, Math.floor(cx - rInt));
    const maxX = Math.min(width - 1, Math.ceil(cx + rInt));
    const minY = Math.max(0, Math.floor(cy - rInt));
    const maxY = Math.min(height - 1, Math.ceil(cy + rInt));

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

          // Solar zenith angle
          const latRad = (lat * Math.PI) / 180;
          const lonRad = (lon * Math.PI) / 180;
          const sinLat = Math.sin(latRad);
          const cosLat = Math.cos(latRad);

          const cosZenith = sinLat * sinDec + cosLat * cosDec * Math.cos(lonRad - subsolarLonRad);

          let light = 1.0;
          let twilightR = 0;
          let twilightG = 0;
          let twilightB = 0;
          let nightLightsR = 0;
          let nightLightsG = 0;
          let nightLightsB = 0;

          if (cosZenith > 0.04) {
            light = Math.min(1.15, 0.12 + cosZenith * 0.95);
          } else if (cosZenith >= -0.09) {
            // Twilight penumbra
            const t = (cosZenith - (-0.09)) / 0.13;
            light = Math.max(0.06, t * 0.35);
            const glowStrength = Math.sin(t * Math.PI);
            twilightR = Math.round(230 * glowStrength * 0.6);
            twilightG = Math.round(110 * glowStrength * 0.45);
            twilightB = Math.round(30 * glowStrength * 0.35);
          } else {
            // Night side
            light = 0.07;
            if (planet.isHabitable && sample.settlementSuitability > 60 && !sample.isWater) {
              nightLightsR = 210;
              nightLightsG = 175;
              nightLightsB = 95;
            }
          }

          const finalR = Math.min(255, Math.round(br * light + twilightR + nightLightsR));
          const finalG = Math.min(255, Math.round(bg * light + twilightG + nightLightsG));
          const finalB = Math.min(255, Math.round(bb * light + twilightB + nightLightsB));

          for (let by = 0; by < step && y + by < height; by++) {
            for (let bx = 0; bx < step && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
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

    // Graticule boundary ring
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, [planet, overlay, style, solarHour, orientation]);

  useEffect(() => {
    renderView();
  }, [renderView]);

  return (
    <div className="bg-slate-950/90 rounded-xl border border-slate-800/80 p-3 flex flex-col items-center">
      <div className="w-full flex justify-between items-center text-[11px] mb-2 px-1">
        <span className="text-amber-300 font-bold">{orientation.label}</span>
        <span className="text-slate-500 text-[10px]">{orientation.subLabel}</span>
      </div>
      <div className="relative rounded-full overflow-hidden border border-slate-800 shadow-xl bg-black">
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
};
