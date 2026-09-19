import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlanetData, MoonData, StarSystemData } from '../types';
import { Play, Pause, FastForward, RotateCcw, Orbit, Info, ShieldAlert, Sparkles } from 'lucide-react';
import { assessEclipseCapability } from '../utils/physics';

interface OrbitalVisualizerProps {
  planet: PlanetData;
  onUpdatePlanetOrbit?: (newSemiMajor: number, newEccentricity: number) => void;
  onLogEclipseEvent?: (type: 'solar_total' | 'solar_annular' | 'lunar_total', moonName: string) => void;
}

export const OrbitalVisualizer: React.FC<OrbitalVisualizerProps> = ({
  planet,
  onUpdatePlanetOrbit,
  onLogEclipseEvent,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [timeScale, setTimeScale] = useState<number>(1.0); // 1x to 20x
  const [simTimeDays, setSimTimeDays] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1.0);
  const [activeTab, setActiveTab] = useState<'system' | 'planet_moons'>('system');

  // Real-time eclipse detection state
  const [currentEclipse, setCurrentEclipse] = useState<string | null>(null);

  const star = planet.star;
  const a = planet.semiMajorAxisAU;
  const e = planet.eccentricity;
  const periodDays = planet.orbitalPeriodDays;

  // Animation Loop
  useEffect(() => {
    if (!isPlaying) return;
    let animationFrameId: number;
    let lastStamp = performance.now();

    const loop = (timestamp: number) => {
      const dtSeconds = (timestamp - lastStamp) / 1000;
      lastStamp = timestamp;

      // Advance simulated days based on timeScale
      setSimTimeDays((prev) => prev + dtSeconds * 30 * timeScale);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isPlaying, timeScale]);

  // Render Orbital Canvas
  const renderOrbits = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const cx = width / 2;
    const cy = height / 2;

    // Clear space
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    // Subtle coordinate grid
    ctx.strokeStyle = 'rgba(30, 41, 59, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 100 * zoom, 0, Math.PI * 2);
    ctx.arc(cx, cy, 200 * zoom, 0, Math.PI * 2);
    ctx.stroke();

    if (activeTab === 'system') {
      // 1. SYSTEM SCALE VIEW
      // Scale: 1 AU = 140px * zoom
      const pxPerAU = 140 * zoom;

      // Draw Habitable Zone green ring
      const hzInner = star.habitableZoneInnerAU * pxPerAU;
      const hzOuter = star.habitableZoneOuterAU * pxPerAU;
      const hzWidth = hzOuter - hzInner;

      ctx.save();
      ctx.fillStyle = 'rgba(16, 185, 129, 0.07)';
      ctx.beginPath();
      ctx.arc(cx, cy, hzOuter, 0, Math.PI * 2);
      ctx.arc(cx, cy, hzInner, 0, Math.PI * 2, true);
      ctx.fill();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.setLineDash([4, 4]);
      ctx.stroke();
      ctx.restore();

      // Draw Keplerian Orbit Ellipse of Planet
      // Semi-major axis = a, Semi-minor axis = b = a * sqrt(1 - e^2)
      // Focus offset = c = a * e
      const aPx = a * pxPerAU;
      const bPx = a * Math.sqrt(Math.max(0.01, 1 - e * e)) * pxPerAU;
      const focusOffsetPx = a * e * pxPerAU;

      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // Ellipse centered at (cx - focusOffsetPx, cy) so the star at (cx, cy) is at one focus!
      ctx.ellipse(cx - focusOffsetPx, cy, aPx, bPx, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Perihelion and Aphelion Markers
      ctx.fillStyle = '#38bdf8';
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`Perihelion: ${(a * (1 - e)).toFixed(2)} AU`, cx - focusOffsetPx + aPx + 8, cy + 4);
      ctx.fillText(`Aphelion: ${(a * (1 + e)).toFixed(2)} AU`, cx - focusOffsetPx - aPx - 95, cy + 4);
      ctx.restore();

      // Calculate current planet orbital position using Kepler's Equation approximation
      const meanAnomaly = ((simTimeDays / periodDays) * 2 * Math.PI) % (2 * Math.PI);
      // Solve Kepler's equation M = E - e*sin(E) for Eccentric Anomaly E
      let E = meanAnomaly;
      for (let i = 0; i < 4; i++) {
        E = E - (E - e * Math.sin(E) - meanAnomaly) / (1 - e * Math.cos(E));
      }
      // True anomaly nu
      const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
      const r = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
      const planetX = cx + r * Math.cos(nu) * pxPerAU;
      const planetY = cy + r * Math.sin(nu) * pxPerAU;

      // Draw Central Star with spectral color glow
      const starRadius = Math.max(12, Math.min(26, star.radiusSolar * 16));
      const starGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, starRadius * 3.5);
      starGlow.addColorStop(0, star.starColorHex);
      starGlow.addColorStop(0.3, `${star.starColorHex}88`);
      starGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = starGlow;
      ctx.beginPath();
      ctx.arc(cx, cy, starRadius * 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = star.starColorHex;
      ctx.beginPath();
      ctx.arc(cx, cy, starRadius, 0, Math.PI * 2);
      ctx.fill();

      // Draw Planet
      const planetRenderRadius = Math.max(6, Math.min(14, planet.radiusEarth * 7));
      ctx.fillStyle = '#06b6d4';
      ctx.beginPath();
      ctx.arc(planetX, planetY, planetRenderRadius, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Planet Label
      ctx.fillStyle = '#f8fafc';
      ctx.font = 'bold 11px "Space Grotesk", sans-serif';
      ctx.fillText(planet.name, planetX + 12, planetY - 4);
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`r = ${r.toFixed(3)} AU`, planetX + 12, planetY + 10);

      // Habitable zone label
      ctx.fillStyle = 'rgba(16, 185, 129, 0.7)';
      ctx.fillText(`Habitable Zone (${star.habitableZoneInnerAU} - ${star.habitableZoneOuterAU} AU)`, cx - 80, cy - hzOuter - 6);
    } else {
      // 2. PLANET & MOONS ORBITAL VIEW (Tracking eclipses & phases)
      const pxPer100kKm = 32 * zoom;

      // Center Planet
      const pRadius = Math.max(16, planet.radiusEarth * 16);
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.arc(cx, cy, pRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Star direction vector (incoming light parallel from left)
      const lightDirX = -1;
      const lightDirY = 0;

      // Draw Planet shadow cone extending to the right
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.beginPath();
      ctx.moveTo(cx, cy - pRadius);
      ctx.lineTo(width, cy - pRadius * 1.5);
      ctx.lineTo(width, cy + pRadius * 1.5);
      ctx.lineTo(cx, cy + pRadius);
      ctx.closePath();
      ctx.fill();

      let detectedEclipse: string | null = null;

      // Draw Moons
      if (planet.moons && planet.moons.length > 0) {
        planet.moons.forEach((m, idx) => {
          const orbitDistPx = (m.semiMajorAxisKm / 100000) * pxPer100kKm;

          // Moon orbit circle
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.3)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath();
          ctx.arc(cx, cy, orbitDistPx, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);

          // Moon position
          const moonPeriod = m.orbitalPeriodDays;
          const moonAngle = ((simTimeDays / moonPeriod) * 2 * Math.PI) % (2 * Math.PI);
          const mx = cx + Math.cos(moonAngle) * orbitDistPx;
          const my = cy + Math.sin(moonAngle) * orbitDistPx;

          // Check for Eclipses:
          // 1. Solar Eclipse: Moon between Star and Planet (moonAngle near 180 degrees / left side)
          const angleDeg = ((moonAngle * 180) / Math.PI + 360) % 360;
          const isSolarConjunction = Math.abs(angleDeg - 180) < 6;
          // 2. Lunar Eclipse: Moon inside Planet's shadow cone (moonAngle near 0 degrees / right side)
          const isLunarConjunction = (angleDeg < 6 || angleDeg > 354);

          const { canTotalEclipse } = assessEclipseCapability(
            star.radiusSolar,
            a,
            m.radiusEarth,
            m.semiMajorAxisKm
          );

          if (isSolarConjunction) {
            detectedEclipse = canTotalEclipse
              ? `TOTAL SOLAR ECLIPSE IN PROGRESS (${m.name})`
              : `ANNULAR SOLAR ECLIPSE IN PROGRESS (${m.name})`;
          } else if (isLunarConjunction) {
            detectedEclipse = `TOTAL LUNAR ECLIPSE IN PROGRESS (${m.name} in umbral shadow)`;
          }

          // Render Moon
          const mRadius = Math.max(4, m.radiusEarth * 14);
          ctx.fillStyle = m.colorHex;
          ctx.beginPath();
          ctx.arc(mx, my, mRadius, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#cbd5e1';
          ctx.fillText(m.name, mx + 8, my - 4);
        });
      }

      setCurrentEclipse(detectedEclipse);

      // Star direction arrow
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(30, cy);
      ctx.lineTo(80, cy);
      ctx.stroke();
      ctx.fillStyle = '#f59e0b';
      ctx.fillText('STEL. INSOLATION →', 30, cy - 8);
    }
  }, [activeTab, planet, star, a, e, periodDays, simTimeDays, zoom]);

  // Resize canvas
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      canvasRef.current.width = Math.max(400, Math.floor(rect.width));
      canvasRef.current.height = 420;
      renderOrbits();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderOrbits]);

  useEffect(() => {
    renderOrbits();
  }, [renderOrbits]);

  return (
    <div
      ref={containerRef}
      id="orbital-visualizer-container"
      className="relative w-full bg-slate-950/80 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col"
    >
      {/* Top Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Orbit className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-200 font-bold">ORBITAL SIMULATOR</span>

          <div className="flex items-center bg-slate-800 rounded-lg p-0.5 ml-2">
            <button
              onClick={() => setActiveTab('system')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'system' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Star System View
            </button>
            <button
              onClick={() => setActiveTab('planet_moons')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'planet_moons' ? 'bg-cyan-500/20 text-cyan-300 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Moons & Eclipses
            </button>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="p-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>

          <button
            onClick={() => setTimeScale((s) => (s >= 8 ? 1 : s * 2))}
            className="flex items-center gap-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            title="Cycle Simulation Speed"
          >
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            <span>{timeScale}x</span>
          </button>

          <button
            onClick={() => setSimTimeDays(0)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg"
            title="Reset Epoch"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setZoom((z) => Math.min(2.5, z + 0.2))}
            className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.2))}
            className="px-2 py-1 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
          >
            -
          </button>
        </div>
      </div>

      {/* Orbit Canvas */}
      <div className="relative w-full h-[420px] bg-slate-950 flex items-center justify-center">
        <canvas ref={canvasRef} id="orbital-canvas" className="block max-w-full" />

        {/* Real-Time Eclipse Alert Banner if occurring */}
        {currentEclipse && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-500/20 border border-amber-500/50 backdrop-blur-md px-4 py-2 rounded-xl text-amber-300 text-xs font-mono font-bold flex items-center gap-2 shadow-lg shadow-amber-950/40 animate-pulse">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>{currentEclipse}</span>
          </div>
        )}

        {/* Planetary Ephemeris Overlay */}
        <div className="absolute bottom-3 left-4 bg-slate-900/80 backdrop-blur-md p-2.5 rounded-xl border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1 max-w-[280px]">
          <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1 flex justify-between">
            <span>EPOCH DAY: {Math.floor(simTimeDays)}</span>
            <span className="text-slate-500">{((simTimeDays / periodDays) * 100).toFixed(1)}% orbit</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Semi-Major Axis:</span>
            <span>{planet.semiMajorAxisAU.toFixed(2)} AU</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Eccentricity:</span>
            <span>{planet.eccentricity.toFixed(3)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Orbital Period:</span>
            <span>{planet.orbitalPeriodDays.toFixed(1)} Earth Days</span>
          </div>
        </div>
      </div>
    </div>
  );
};
