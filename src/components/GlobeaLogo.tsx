import React from 'react';

interface GlobeaLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
}

export const GlobeaLogo: React.FC<GlobeaLogoProps> = ({ size = 'md', showSubtitle = true }) => {
  const iconSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 36;

  return (
    <div className="flex items-center gap-2.5 select-none">
      {/* Custom Vector Cartographic Globe Icon */}
      <div
        className="relative flex items-center justify-center shrink-0 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-950 to-cyan-950/80 border border-cyan-500/30 p-1 shadow-lg shadow-cyan-950/60"
        style={{ width: iconSize + 10, height: iconSize + 10 }}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="relative z-10"
        >
          <defs>
            {/* Planetary Sphere Gradient */}
            <radialGradient id="globeSphere" cx="35%" cy="30%" r="65%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="45%" stopColor="#0284c7" />
              <stop offset="85%" stopColor="#082f49" />
              <stop offset="100%" stopColor="#020617" />
            </radialGradient>

            {/* Atmosphere Rim Glow */}
            <linearGradient id="atmoGlow" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#10b981" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity="0" />
            </linearGradient>

            {/* Ring Gradient */}
            <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#67e8f9" stopOpacity="0.9" />
              <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.6" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.1" />
            </linearGradient>
          </defs>

          {/* Background Space Ambient Bloom */}
          <circle cx="24" cy="24" r="22" fill="#0369a1" fillOpacity="0.15" />

          {/* Orbital Ring - Back Segment */}
          <ellipse
            cx="24"
            cy="24"
            rx="21"
            ry="7.5"
            transform="rotate(-28 24 24)"
            stroke="url(#ringGrad)"
            strokeWidth="1.2"
            strokeDasharray="4 2"
            opacity="0.5"
          />

          {/* Planetary Main Sphere Body */}
          <circle cx="24" cy="24" r="14" fill="url(#globeSphere)" />

          {/* Graticule Latitude lines */}
          <ellipse
            cx="24"
            cy="24"
            rx="13.5"
            ry="4.5"
            stroke="#7dd3fc"
            strokeWidth="0.8"
            strokeOpacity="0.4"
            fill="none"
          />
          <ellipse
            cx="24"
            cy="19"
            rx="10.5"
            ry="3.2"
            stroke="#7dd3fc"
            strokeWidth="0.6"
            strokeOpacity="0.25"
            fill="none"
          />
          <ellipse
            cx="24"
            cy="29"
            rx="10.5"
            ry="3.2"
            stroke="#7dd3fc"
            strokeWidth="0.6"
            strokeOpacity="0.25"
            fill="none"
          />

          {/* Graticule Longitude Meridian */}
          <ellipse
            cx="24"
            cy="24"
            rx="6.5"
            ry="13.5"
            stroke="#7dd3fc"
            strokeWidth="0.8"
            strokeOpacity="0.35"
            fill="none"
          />

          {/* Atmosphere outer crescent rim highlight */}
          <circle
            cx="24"
            cy="24"
            r="14"
            stroke="url(#atmoGlow)"
            strokeWidth="1.4"
            fill="none"
          />

          {/* Orbital Ring - Front Segment */}
          <path
            d="M 6 32 C 10 37 34 33 42 16"
            stroke="url(#ringGrad)"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Satellite / Node on Ring */}
          <circle cx="10" cy="30" r="1.8" fill="#38bdf8" />
          <circle cx="10" cy="30" r="3.5" stroke="#38bdf8" strokeWidth="0.6" opacity="0.6" />

          {/* Cartographic Optics Crosshairs */}
          <path d="M 24 3 L 24 7" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <path d="M 24 41 L 24 45" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <path d="M 3 24 L 7 24" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
          <path d="M 41 24 L 45 24" stroke="#38bdf8" strokeWidth="1" strokeLinecap="round" opacity="0.8" />
        </svg>

        {/* Ambient Backlight Glow */}
        <div className="absolute inset-0 bg-cyan-500/10 rounded-2xl blur-sm -z-0 pointer-events-none" />
      </div>

      {/* Typography */}
      <div>
        <div className="flex items-center gap-2">
          <span className="font-extrabold tracking-wider font-mono text-base sm:text-lg text-white">
            GLOBEA
          </span>
          <span className="text-slate-400 font-mono text-sm tracking-widest uppercase">
            ATLAS STUDIO
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase tracking-widest bg-amber-950/60 text-amber-400 border border-amber-500/40">
            R0001
          </span>
        </div>
        {showSubtitle && (
          <div className="text-[10px] font-mono tracking-tight text-slate-400">
            simulated worlds, drawn by hand
          </div>
        )}
      </div>
    </div>
  );
};
