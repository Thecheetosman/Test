import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { PlanetData, MapOverlayType, MapStyleType } from '../types';
import { PlanetTerrainEngine, getPixelColor, SamplePoint } from '../utils/proceduralTerrain';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Eye,
  Wind,
  Sun,
  Compass,
  Moon,
  Sunset,
  Clock,
  Sparkles,
  Sliders,
} from 'lucide-react';

interface PlanetGlobeViewProps {
  planet: PlanetData;
  overlay: MapOverlayType;
  style: MapStyleType;
  onSelectCoordinate?: (lat: number, lon: number, sample: SamplePoint) => void;
  selectedCoord?: { lat: number; lon: number } | null;
  compactMode?: boolean;
  externalSolarHour?: number;
  onSolarHourChange?: (hour: number) => void;
}

export const PlanetGlobeView: React.FC<PlanetGlobeViewProps> = ({
  planet,
  overlay,
  style,
  onSelectCoordinate,
  selectedCoord,
  compactMode = false,
  externalSolarHour,
  onSolarHourChange,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Rotation and camera state
  const [rotY, setRotY] = useState<number>(0); // longitude rotation (yaw)
  const [rotX, setRotX] = useState<number>(planet.axialTiltDeg * 0.4); // latitude tilt (pitch)
  const [zoom, setZoom] = useState<number>(1.0);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [lastMouse, setLastMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [autoRotate, setAutoRotate] = useState<boolean>(true);
  const [showAtmosphere, setShowAtmosphere] = useState<boolean>(true);
  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [cloudOffset, setCloudOffset] = useState<number>(0);

  // Real-time Shadow Mask, Axial Tilt & Stellar Position State
  const [enableShadowMask, setEnableShadowMask] = useState<boolean>(true);
  const [shadowDensity, setShadowDensity] = useState<number>(0.92); // 0 = no shadow, 1 = deep dark space shadow
  const [showTerminatorHighlight, setShowTerminatorHighlight] = useState<boolean>(true);
  const [showTwilightGlow, setShowTwilightGlow] = useState<boolean>(true);
  const [showNightLights, setShowNightLights] = useState<boolean>(true);
  const [showSubsolarMarker, setShowSubsolarMarker] = useState<boolean>(true);
  const [showAxialTiltLine, setShowAxialTiltLine] = useState<boolean>(true);

  // Stellar position parameters
  // seasonAngleDeg: orbital longitude (0° = Spring Equinox, 90° = Summer Solstice, 180° = Autumn Equinox, 270° = Winter Solstice)
  const [seasonAngleDeg, setSeasonAngleDeg] = useState<number>(65);
  // local solar hour (0 to 24 hours, default noon-afternoon ~13.5h)
  const [internalSolarHour, setInternalSolarHour] = useState<number>(13.5);
  const currentSolarHour = externalSolarHour !== undefined ? externalSolarHour : internalSolarHour;

  const handleUpdateSolarHour = (hour: number) => {
    setInternalSolarHour(hour);
    if (onSolarHourChange) onSolarHourChange(hour);
  };

  // Inspector hover point
  const [hoverData, setHoverData] = useState<SamplePoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [showControlsDrawer, setShowControlsDrawer] = useState<boolean>(false);

  // Engine instance
  const engineRef = useRef<PlanetTerrainEngine>(new PlanetTerrainEngine(planet));

  useEffect(() => {
    engineRef.current.updatePlanet(planet);
  }, [planet]);

  // Auto-rotation animation loop
  useEffect(() => {
    if (!autoRotate) return;
    let animationFrameId: number;
    let lastTime = performance.now();

    const loop = (time: number) => {
      const dt = (time - lastTime) / 1000;
      lastTime = time;

      // Rotate based on planet's actual rotation speed (day length)
      const speed = Math.max(0.05, 24 / Math.max(1, planet.rotationPeriodHours)) * 10;
      setRotY((prev) => (prev + speed * dt) % 360);
      setCloudOffset((prev) => (prev + speed * dt * 1.3) % 360);

      // Also gently advance solar time in sync with spin
      setInternalSolarHour((prev) => (prev + (speed * dt) / 15) % 24);

      animationFrameId = requestAnimationFrame(loop);
    };

    animationFrameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationFrameId);
  }, [autoRotate, planet.rotationPeriodHours]);

  // Derived Stellar Astrodynamics:
  // Calculate stellar declination from axial tilt and orbital season
  const stellarDynamics = useMemo(() => {
    const tiltRad = (planet.axialTiltDeg * Math.PI) / 180;
    const seasonRad = (seasonAngleDeg * Math.PI) / 180;

    // Exact spherical declination: sin(delta) = sin(obliquity) * sin(orbit_longitude)
    const sinDeclination = Math.sin(tiltRad) * Math.sin(seasonRad);
    const declinationRad = Math.asin(Math.max(-1, Math.min(1, sinDeclination)));
    const declinationDeg = (declinationRad * 180) / Math.PI;

    // Sub-stellar longitude from solar hour (0h = -180°, 12h = 0°, 24h = +180°)
    const subsolarLonDeg = ((currentSolarHour / 24) * 360 - 180);
    const subsolarLonRad = (subsolarLonDeg * Math.PI) / 180;

    // Subsolar unit vector in planet body coordinates
    const cosDec = Math.cos(declinationRad);
    const sinDec = Math.sin(declinationRad);
    const cosSubLon = Math.cos(subsolarLonRad);
    const sinSubLon = Math.sin(subsolarLonRad);

    // Planet body frame: X right, Y north, Z outward
    const starBodyX = cosDec * sinSubLon;
    const starBodyY = -sinDec; // -Y is north in projection
    const starBodyZ = cosDec * cosSubLon;

    return {
      tiltRad,
      seasonRad,
      declinationDeg,
      declinationRad,
      subsolarLonDeg,
      subsolarLonRad,
      starBodyX,
      starBodyY,
      starBodyZ,
      sinDec,
      cosDec,
    };
  }, [planet.axialTiltDeg, seasonAngleDeg, currentSolarHour]);

  // Render the 3D sphere onto the canvas with dynamic day/night shadow masks
  const renderGlobe = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * (compactMode ? 0.44 : 0.41);
    const radius = baseRadius * zoom;

    // Clear background to pitch black void (#020617 or #000000)
    ctx.fillStyle = '#05070a';
    ctx.fillRect(0, 0, width, height);

    // Starfield backdrop
    if (!compactMode) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      const seedStars = (planet.seed % 80) + 70;
      for (let i = 0; i < seedStars; i++) {
        const sx = ((i * 137.5) % width);
        const sy = ((i * 249.7) % height);
        const sSize = (i % 3 === 0) ? 1.4 : 0.75;
        ctx.fillRect(sx, sy, sSize, sSize);
      }
    }

    // Atmosphere Glow behind the planet (tinted by stellar illumination direction)
    if (showAtmosphere && planet.atmosphere.surfacePressureAtm > 0.05) {
      const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.2);
      glowGrad.addColorStop(0, 'transparent');
      glowGrad.addColorStop(0.65, `${planet.atmosphere.skyColorHex}30`);
      glowGrad.addColorStop(0.9, `${planet.atmosphere.skyColorHex}12`);
      glowGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 1.22, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera rotation trigonometry
    const radX = (rotX * Math.PI) / 180;
    const radY = (rotY * Math.PI) / 180;
    const cosX = Math.cos(radX);
    const sinX = Math.sin(radX);
    const cosY = Math.cos(radY);
    const sinY = Math.sin(radY);

    // Stellar position vectors in View/Camera space for Specular & Atmospheric Scattering
    // Rotate star body vector by camera rotation (rotY spin, then rotX tilt):
    const { starBodyX, starBodyY, starBodyZ, sinDec, cosDec, subsolarLonRad } = stellarDynamics;
    const sx1 = starBodyX * cosY - starBodyZ * sinY;
    const sz1 = starBodyX * sinY + starBodyZ * cosY;
    const starViewX = sx1;
    const starViewY = starBodyY * cosX + sz1 * sinX;
    const starViewZ = -starBodyY * sinX + sz1 * cosX;
    const sLen = Math.sqrt(starViewX * starViewX + starViewY * starViewY + starViewZ * starViewZ) || 1;
    const nlx = starViewX / sLen;
    const nly = starViewY / sLen;
    const nlz = starViewZ / sLen;

    const r2 = radius * radius;
    const rInt = Math.ceil(radius);
    const minX = Math.max(0, Math.floor(cx - rInt));
    const maxX = Math.min(width - 1, Math.ceil(cx + rInt));
    const minY = Math.max(0, Math.floor(cy - rInt));
    const maxY = Math.min(height - 1, Math.ceil(cy + rInt));

    // Pixel step: 2px blocks for smooth 60fps performance, 1px on smaller canvases
    const step = compactMode ? 1 : 2;

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    for (let y = minY; y <= maxY; y += step) {
      const dy = y - cy;
      const dy2 = dy * dy;

      for (let x = minX; x <= maxX; x += step) {
        const dx = x - cx;
        const dist2 = dx * dx + dy2;

        if (dist2 <= r2) {
          // Point is on the sphere
          const nx = dx / radius;
          const ny = dy / radius;
          const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

          // Inverse camera transform -> body coordinates (lat, lon)
          // 1. Un-tilt X (pitch)
          const y1 = ny * cosX - nz * sinX;
          const z1 = ny * sinX + nz * cosX;
          // 2. Un-rotate Y (yaw/spin)
          const x2 = nx * cosY + z1 * sinY;
          const z2 = -nx * sinY + z1 * cosY;

          // Compute exact Latitude and Longitude
          const lat = (Math.asin(Math.max(-1, Math.min(1, -y1))) * 180) / Math.PI;
          const lon = (Math.atan2(z2, x2) * 180) / Math.PI;

          // Sample procedurally
          const sample = engineRef.current.sample(lat, lon);

          // Get base map color
          const [br, bg, bb] = getPixelColor(sample, overlay, style, planet);

          // --- REAL-TIME STELLAR SHADOW MASK & TERMINATOR CALCULATIONS ---
          // Solar Zenith Angle: cos(theta_z) = sin(phi)*sin(delta) + cos(phi)*cos(delta)*cos(lon - subsolarLon)
          const latRad = (lat * Math.PI) / 180;
          const lonRad = (lon * Math.PI) / 180;
          const sinLat = Math.sin(latRad);
          const cosLat = Math.cos(latRad);

          // Cosine of solar zenith angle
          const cosZenith = sinLat * sinDec + cosLat * cosDec * Math.cos(lonRad - subsolarLonRad);

          // Calculate direct day lighting factor vs shadow mask
          let dayLightFactor = 1.0;
          let shadowMaskVal = 1.0; // 1 = full light, 0 = pure night shadow
          let isTwilightBand = false;
          let twilightTintR = 0;
          let twilightTintG = 0;
          let twilightTintB = 0;

          if (enableShadowMask) {
            if (cosZenith > 0.04) {
              // Daytime side: Cosine Lambertian law with slight ambient
              dayLightFactor = Math.min(1.15, 0.12 + cosZenith * 0.95);
              shadowMaskVal = 1.0;
            } else if (cosZenith >= -0.09) {
              // --- DYNAMIC TERMINATOR LINE & TWILIGHT ZONE (PENUMBRA) ---
              // Sun is grazing the horizon (-5° to +2° solar depression)
              isTwilightBand = true;
              const t = (cosZenith - (-0.09)) / 0.13; // 0 (night boundary) to 1 (day boundary)
              dayLightFactor = Math.max(0.06, t * 0.35);
              shadowMaskVal = Math.max(0.08, t);

              if (showTwilightGlow) {
                // Atmospheric Rayleigh scattering: blue scatters out, leaving warm sunset/sunrise crimson-amber
                const glowStrength = Math.sin(t * Math.PI); // peak exactly at the terminator line (cosZenith == 0)
                twilightTintR = Math.round(230 * glowStrength * 0.65);
                twilightTintG = Math.round(110 * glowStrength * 0.5);
                twilightTintB = Math.round(30 * glowStrength * 0.4);
              }
            } else {
              // Night side: Deep space planetary shadow mask
              const nightDepth = Math.min(1, Math.abs(cosZenith + 0.09) * 2.5);
              const minAmbient = (1 - shadowDensity) * 0.4 + 0.04;
              dayLightFactor = Math.max(minAmbient, 0.06 - nightDepth * 0.03);
              shadowMaskVal = Math.max(minAmbient, 0.08);
            }
          } else {
            // Shadow mask disabled: uniform soft lighting from front
            const dotFront = Math.max(0.15, nz * 0.85 + 0.15);
            dayLightFactor = dotFront;
          }

          // Specular reflection on liquid oceans on the illuminated day side
          let specular = 0;
          if (sample.isWater && cosZenith > 0.05 && enableShadowMask) {
            // Halfway vector between camera view normal and star view direction
            const hx = nlx;
            const hy = nly;
            const hz = nlz + 1;
            const hLen = Math.sqrt(hx * hx + hy * hy + hz * hz) || 1;
            const ndoth = Math.max(0, (nx * hx + ny * hy + nz * hz) / hLen);
            specular = Math.pow(ndoth, 28) * 0.85 * Math.max(0, cosZenith);
          }

          // Procedural Cloud Overlay
          let cloudAlpha = 0;
          if (showClouds && planet.atmosphere.cloudCoveragePercent > 0) {
            const cloudLon = ((lon + cloudOffset + 180) % 360) - 180;
            const cloudSample = engineRef.current.sample(lat, cloudLon);
            if (cloudSample.elevation > 0.08 && (Math.abs(lat) < 18 || Math.abs(lat) > 38)) {
              cloudAlpha = (planet.atmosphere.cloudCoveragePercent / 100) * 0.68;
            }
          }

          // Night side city lights & geothermal bioluminescence
          let nightGlowR = 0;
          let nightGlowG = 0;
          let nightGlowB = 0;
          if (enableShadowMask && showNightLights && cosZenith < 0.02) {
            const nightWeight = Math.min(1, (0.02 - cosZenith) / 0.18);
            if (planet.isHabitable && sample.settlementSuitability > 55 && !sample.isWater) {
              // City clusters on fertile landmasses
              nightGlowR = Math.round(250 * nightWeight * 0.85);
              nightGlowG = Math.round(205 * nightWeight * 0.85);
              nightGlowB = Math.round(115 * nightWeight * 0.85);
            } else if (planet.archetype === 'volcanic_io' && sample.elevation > 0.35) {
              // Glowing lava lakes
              nightGlowR = Math.round(255 * nightWeight);
              nightGlowG = Math.round(75 * nightWeight);
              nightGlowB = Math.round(20 * nightWeight);
            }
          }

          // Terminator Line Highlight Ring:
          let terminatorHighlight = 0;
          if (enableShadowMask && showTerminatorHighlight && Math.abs(cosZenith) < 0.015) {
            terminatorHighlight = (1 - Math.abs(cosZenith) / 0.015) * 80;
          }

          // Composite final RGB with Day/Night Shadow Mask
          let finalR = Math.min(255, Math.round(br * dayLightFactor + specular * 255 + nightGlowR + twilightTintR + terminatorHighlight));
          let finalG = Math.min(255, Math.round(bg * dayLightFactor + specular * 255 + nightGlowG + twilightTintG + terminatorHighlight * 0.8));
          let finalB = Math.min(255, Math.round(bb * dayLightFactor + specular * 255 + nightGlowB + twilightTintB));

          // Cloud layer illumination (clouds also cast/receive shadow mask)
          if (cloudAlpha > 0) {
            const cloudLight = Math.max(0.08, dayLightFactor * 1.1);
            finalR = Math.min(255, Math.round(finalR * (1 - cloudAlpha) + 250 * cloudAlpha * cloudLight));
            finalG = Math.min(255, Math.round(finalG * (1 - cloudAlpha) + 250 * cloudAlpha * cloudLight));
            finalB = Math.min(255, Math.round(finalB * (1 - cloudAlpha) + 255 * cloudAlpha * cloudLight));
          }

          // Atmospheric limb scattering (Fresnel rim on horizon)
          const rim = 1 - nz;
          if (showAtmosphere && rim > 0.62 && planet.atmosphere.surfacePressureAtm > 0.05) {
            const rimIllum = enableShadowMask ? Math.max(0.12, Math.min(1, dayLightFactor + 0.2)) : 0.8;
            const rimFactor = Math.pow((rim - 0.62) / 0.38, 2.4) * 0.55 * rimIllum;
            finalR = Math.min(255, Math.round(finalR + 56 * rimFactor));
            finalG = Math.min(255, Math.round(finalG + 189 * rimFactor));
            finalB = Math.min(255, Math.round(finalB + 248 * rimFactor));
          }

          // Fill pixel block (1x1 or 2x2)
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

    // Draw Subsolar Point Indicator (Sun zenith point on the planet surface)
    if (showSubsolarMarker && enableShadowMask) {
      const { declinationDeg, subsolarLonDeg } = stellarDynamics;
      const subLatRad = (declinationDeg * Math.PI) / 180;
      const subLonRad = (subsolarLonDeg * Math.PI) / 180;

      const px = Math.cos(subLatRad) * Math.sin(subLonRad);
      const py = -Math.sin(subLatRad);
      const pz = Math.cos(subLatRad) * Math.cos(subLonRad);

      const x1 = px * cosY - pz * sinY;
      const z1 = px * sinY + pz * cosY;
      const y2 = py * cosX + z1 * sinX;
      const z2 = -py * sinX + z1 * cosX;

      if (z2 > 0) {
        const subX = cx + x1 * radius;
        const subY = cy + y2 * radius;

        ctx.save();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(subX, subY, 6, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(subX, subY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (!compactMode) {
          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#fde68a';
          ctx.fillText('☉ Sub-solar', subX + 9, subY + 3);
        }
        ctx.restore();
      }
    }

    // Draw Selected Coordinate Marker on globe if visible on front hemisphere
    if (selectedCoord) {
      const selLatRad = (selectedCoord.lat * Math.PI) / 180;
      const selLonRad = (selectedCoord.lon * Math.PI) / 180;

      const px = Math.cos(selLatRad) * Math.sin(selLonRad);
      const py = -Math.sin(selLatRad);
      const pz = Math.cos(selLatRad) * Math.cos(selLonRad);

      const x1 = px * cosY - pz * sinY;
      const z1 = px * sinY + pz * cosY;
      const y2 = py * cosX + z1 * sinX;
      const z2 = -py * sinX + z1 * cosX;

      if (z2 > 0) {
        const screenX = cx + x1 * radius;
        const screenY = cy + y2 * radius;

        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(screenX, screenY, 7, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(screenX, screenY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        if (!compactMode) {
          ctx.font = '11px "JetBrains Mono", monospace';
          ctx.fillStyle = '#a5f3fc';
          ctx.fillText(
            `${selectedCoord.lat >= 0 ? '+' : ''}${selectedCoord.lat.toFixed(1)}°, ${selectedCoord.lon >= 0 ? '+' : ''}${selectedCoord.lon.toFixed(1)}°`,
            screenX + 11,
            screenY - 5
          );
        }
      }
    }

    // Draw Planet's Tilted Spin Axis Line
    if (showAxialTiltLine && !compactMode) {
      ctx.save();
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      // Axis tilted relative to vertical by rotX and axial tilt
      ctx.moveTo(cx - sinX * (radius + 22), cy - cosX * (radius + 22));
      ctx.lineTo(cx + sinX * (radius + 22), cy + cosX * (radius + 22));
      ctx.stroke();

      // Axis North Label
      ctx.font = '9px "JetBrains Mono", monospace';
      ctx.fillStyle = '#fef08a';
      ctx.fillText(
        `N-Pole (${planet.axialTiltDeg.toFixed(1)}° Tilt)`,
        cx - sinX * (radius + 24) - 28,
        cy - cosX * (radius + 24) - 6
      );
      ctx.restore();
    }
  }, [
    planet,
    overlay,
    style,
    rotX,
    rotY,
    zoom,
    showAtmosphere,
    showClouds,
    cloudOffset,
    selectedCoord,
    enableShadowMask,
    shadowDensity,
    showTerminatorHighlight,
    showTwilightGlow,
    showNightLights,
    showSubsolarMarker,
    showAxialTiltLine,
    stellarDynamics,
    compactMode,
  ]);

  // Handle canvas resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const size = Math.min(rect.width, rect.height || (compactMode ? 320 : 540));
      canvasRef.current.width = Math.max(200, Math.floor(size));
      canvasRef.current.height = Math.max(200, Math.floor(size));
      renderGlobe();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderGlobe, compactMode]);

  useEffect(() => {
    renderGlobe();
  }, [renderGlobe]);

  // Mouse drag to rotate sphere
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setAutoRotate(false);
    setLastMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    // If dragging, update rotation
    if (isDragging) {
      const dx = e.clientX - lastMouse.x;
      const dy = e.clientY - lastMouse.y;
      setRotY((prev) => (prev - dx * 0.45) % 360);
      setRotX((prev) => Math.max(-85, Math.min(85, prev + dy * 0.45)));
      setLastMouse({ x: e.clientX, y: e.clientY });
      return;
    }

    // Otherwise calculate Lat/Lon under cursor for hover inspection
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const baseRadius = Math.min(canvas.width, canvas.height) * (compactMode ? 0.44 : 0.41);
    const radius = baseRadius * zoom;
    const dx = mouseCanvasX - cx;
    const dy = mouseCanvasY - cy;

    if (dx * dx + dy * dy <= radius * radius) {
      const nx = dx / radius;
      const ny = dy / radius;
      const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));

      const radX = (rotX * Math.PI) / 180;
      const radY = (rotY * Math.PI) / 180;
      const cosX = Math.cos(radX);
      const sinX = Math.sin(radX);
      const cosY = Math.cos(radY);
      const sinY = Math.sin(radY);

      const y1 = ny * cosX - nz * sinX;
      const z1 = ny * sinX + nz * cosX;
      const x2 = nx * cosY + z1 * sinY;
      const z2 = -nx * sinY + z1 * cosY;

      const lat = (Math.asin(Math.max(-1, Math.min(1, -y1))) * 180) / Math.PI;
      const lon = (Math.atan2(z2, x2) * 180) / Math.PI;

      const sample = engineRef.current.sample(lat, lon);
      setHoverData(sample);
    } else {
      setHoverData(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleClick = () => {
    if (hoverData && onSelectCoordinate) {
      onSelectCoordinate(hoverData.lat, hoverData.lon, hoverData);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    setZoom((prev) => Math.max(0.65, Math.min(2.4, prev + zoomDelta)));
  };

  // Format solar hour into HH:MM
  const formatHour = (hour: number) => {
    const h = Math.floor(hour);
    const m = Math.floor((hour - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  return (
    <div
      ref={containerRef}
      id="planet-globe-container"
      className={`relative w-full ${
        compactMode ? 'h-[280px] sm:h-[310px]' : 'h-[520px] sm:h-[580px]'
      } flex items-center justify-center bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl select-none`}
    >
      <canvas
        ref={canvasRef}
        id="planet-globe-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setIsDragging(false);
          setHoverData(null);
        }}
        onClick={handleClick}
        onWheel={handleWheel}
        className="cursor-grab active:cursor-grabbing max-w-full max-h-full block"
      />

      {/* COMPACT MODE: Coordinate Tag in bottom-left corner like user screenshot (0.0°N 145.2°E) */}
      {compactMode && (
        <div className="absolute bottom-2.5 left-2.5 px-2 py-1 rounded bg-black/80 border border-slate-800/80 font-mono text-[10px] text-slate-400 backdrop-blur-sm pointer-events-none">
          {selectedCoord
            ? `${selectedCoord.lat >= 0 ? selectedCoord.lat.toFixed(1) + '°N' : Math.abs(selectedCoord.lat).toFixed(1) + '°S'} ${
                selectedCoord.lon >= 0 ? selectedCoord.lon.toFixed(1) + '°E' : Math.abs(selectedCoord.lon).toFixed(1) + '°W'
              }`
            : `${planet.axialTiltDeg.toFixed(1)}° Tilt · ${stellarDynamics.declinationDeg >= 0 ? '+' : ''}${stellarDynamics.declinationDeg.toFixed(1)}° Dec`}
        </div>
      )}

      {/* COMPACT MODE: Quick Solar Cycle scrubber at bottom-right */}
      {compactMode && (
        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 bg-black/80 px-2 py-1 rounded border border-slate-800/80 font-mono text-[10px] text-slate-300">
          <Sun className="w-3 h-3 text-amber-400" />
          <span>{formatHour(currentSolarHour)}</span>
          <button
            onClick={() => setAutoRotate(!autoRotate)}
            className={`p-0.5 rounded hover:text-cyan-400 ${autoRotate ? 'text-cyan-400' : 'text-slate-500'}`}
            title="Auto rotate planet spin"
          >
            <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
          </button>
        </div>
      )}

      {/* FULL MODE: Floating View Controls HUD */}
      {!compactMode && (
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 bg-slate-950/90 backdrop-blur-md p-2 rounded-xl border border-slate-800 text-xs shadow-xl max-w-[200px]">
          <div className="flex items-center justify-between text-slate-300 font-mono pb-1 border-b border-slate-800">
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-bold text-[11px]">3D GLOBE HUD</span>
            </div>
            <button
              onClick={() => setShowControlsDrawer(!showControlsDrawer)}
              className="text-[10px] font-mono text-amber-400 hover:text-amber-300 p-0.5"
              title="Toggle Stellar Shadow Controls"
            >
              <Sliders className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1 font-mono text-[10px]">
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded transition-colors ${
                autoRotate ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
              title="Toggle Planet Spin"
            >
              <RotateCw className={`w-3 h-3 ${autoRotate ? 'animate-spin' : ''}`} />
              <span>Spin</span>
            </button>

            <button
              onClick={() => setEnableShadowMask(!enableShadowMask)}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded transition-colors ${
                enableShadowMask ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
              title="Toggle Real-Time Day/Night Shadow Mask"
            >
              <Moon className="w-3 h-3" />
              <span>Shadow</span>
            </button>

            <button
              onClick={() => setShowAtmosphere(!showAtmosphere)}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded transition-colors ${
                showAtmosphere ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
              title="Toggle Atmosphere Glow"
            >
              <Eye className="w-3 h-3" />
              <span>Atmo</span>
            </button>

            <button
              onClick={() => setShowClouds(!showClouds)}
              className={`flex items-center justify-center gap-1 px-2 py-1 rounded transition-colors ${
                showClouds ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40' : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
              }`}
              title="Toggle Clouds"
            >
              <Wind className="w-3 h-3" />
              <span>Clouds</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-800 text-[10px]">
            <span className="text-slate-500 font-mono">Zoom: {(zoom * 100).toFixed(0)}%</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoom((z) => Math.min(2.4, z + 0.2))}
                className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
                title="Zoom In"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
              <button
                onClick={() => setZoom((z) => Math.max(0.65, z - 0.2))}
                className="p-1 rounded bg-slate-900 text-slate-300 hover:bg-slate-800 transition-colors"
                title="Zoom Out"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL MODE: Stellar Shadow & Terminator Controls Drawer */}
      {!compactMode && showControlsDrawer && (
        <div className="absolute top-3 left-[215px] bg-slate-950/95 backdrop-blur-md p-3.5 rounded-xl border border-amber-500/30 text-xs font-mono w-[260px] shadow-2xl space-y-2.5 z-20">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="font-bold text-amber-300 text-[11px] flex items-center gap-1.5">
              <Sun className="w-3.5 h-3.5 text-amber-400" />
              <span>STELLAR SHADOW MASK</span>
            </span>
            <button
              onClick={() => setShowControlsDrawer(false)}
              className="text-slate-400 hover:text-slate-200 text-xs"
            >
              ✕
            </button>
          </div>

          {/* Diurnal Solar Time Scrubber */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>SOLAR HOUR (DIURNAL)</span>
              <span className="text-amber-400 font-bold">{formatHour(currentSolarHour)}</span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="0.25"
              value={currentSolarHour}
              onChange={(e) => handleUpdateSolarHour(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Stellar Orbital Season (Declination) */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>ORBITAL SEASON ANGLE</span>
              <span className="text-amber-400 font-bold">{seasonAngleDeg}°</span>
            </div>
            <input
              type="range"
              min="0"
              max="360"
              step="5"
              value={seasonAngleDeg}
              onChange={(e) => setSeasonAngleDeg(parseInt(e.target.value, 10))}
              className="w-full accent-amber-400 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-0.5">
              <span>Eq (0°)</span>
              <span>Sol (+{planet.axialTiltDeg.toFixed(0)}°)</span>
              <span>Eq (180°)</span>
              <span>Sol (-{planet.axialTiltDeg.toFixed(0)}°)</span>
            </div>
          </div>

          {/* Shadow Density Slider */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-400 mb-1">
              <span>SHADOW MASK OPACITY</span>
              <span className="text-amber-400 font-bold">{Math.round(shadowDensity * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="1.0"
              step="0.05"
              value={shadowDensity}
              onChange={(e) => setShadowDensity(parseFloat(e.target.value))}
              className="w-full accent-amber-400 cursor-pointer"
            />
          </div>

          {/* Quick Toggles */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5 text-[10px]">
            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
              <span>Twilight Penumbra Glow</span>
              <input
                type="checkbox"
                checked={showTwilightGlow}
                onChange={(e) => setShowTwilightGlow(e.target.checked)}
                className="accent-amber-400 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
              <span>Highlight Terminator Ring</span>
              <input
                type="checkbox"
                checked={showTerminatorHighlight}
                onChange={(e) => setShowTerminatorHighlight(e.target.checked)}
                className="accent-amber-400 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
              <span>Civilization Night Lights</span>
              <input
                type="checkbox"
                checked={showNightLights}
                onChange={(e) => setShowNightLights(e.target.checked)}
                className="accent-amber-400 rounded"
              />
            </label>
            <label className="flex items-center justify-between text-slate-300 cursor-pointer">
              <span>Sub-Solar Point Marker (☉)</span>
              <input
                type="checkbox"
                checked={showSubsolarMarker}
                onChange={(e) => setShowSubsolarMarker(e.target.checked)}
                className="accent-amber-400 rounded"
              />
            </label>
          </div>
        </div>
      )}

      {/* FULL MODE: Stellar Telemetry & Axial Tilt Badge */}
      {!compactMode && (
        <div className="absolute top-3 right-3 bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-800 text-xs font-mono max-w-[210px] shadow-xl">
          <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1 flex items-center justify-between">
            <span>Stellar Position</span>
            <Sun className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-slate-100 font-semibold text-xs truncate">{planet.name}</div>
          <div className="mt-2 space-y-1 text-slate-300 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-500">Axial Tilt:</span>
              <span className="text-amber-400 font-bold">{planet.axialTiltDeg.toFixed(1)}°</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sub-solar Lat:</span>
              <span className="text-cyan-400 font-semibold">
                {stellarDynamics.declinationDeg >= 0 ? '+' : ''}
                {stellarDynamics.declinationDeg.toFixed(1)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Sub-solar Lon:</span>
              <span>
                {stellarDynamics.subsolarLonDeg >= 0 ? '+' : ''}
                {stellarDynamics.subsolarLonDeg.toFixed(1)}°
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Terminator:</span>
              <span className="text-emerald-400 font-bold">Dynamic</span>
            </div>
          </div>
        </div>
      )}

      {/* Surface Inspector Tooltip when hovering over planet */}
      {hoverData && mousePos && (
        <div
          style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
          className="fixed pointer-events-none z-50 bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-cyan-500/40 shadow-2xl text-xs font-mono max-w-[260px] animate-in fade-in duration-150"
        >
          <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1 flex items-center justify-between">
            <span>{hoverData.biome}</span>
            <span className="text-slate-400 text-[10px]">
              {hoverData.lat >= 0 ? '+' : ''}{hoverData.lat.toFixed(1)}°, {hoverData.lon >= 0 ? '+' : ''}{hoverData.lon.toFixed(1)}°
            </span>
          </div>
          <div className="mt-2 space-y-1 text-[11px]">
            <div className="flex justify-between">
              <span className="text-slate-400">Elevation:</span>
              <span className={hoverData.isWater ? 'text-blue-400' : 'text-emerald-400'}>
                {hoverData.depthOrHeightM >= 0 ? `+${hoverData.depthOrHeightM} m` : `${hoverData.depthOrHeightM} m (Bathy)`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Surface Temp:</span>
              <span className="text-amber-300 font-semibold">{hoverData.temperatureC}°C</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Rainfall:</span>
              <span>{hoverData.precipitationMm} mm/yr</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Solar Flux:</span>
              <span>{hoverData.solarFluxWm2} W/m²</span>
            </div>
            {hoverData.dominantOre && (
              <div className="flex justify-between border-t border-slate-800/80 pt-1 text-[10px]">
                <span className="text-purple-400">Deposit:</span>
                <span className="text-purple-300 font-bold truncate max-w-[140px]">
                  {hoverData.dominantOre.symbol} ({hoverData.oreEnrichmentFactor}x)
                </span>
              </div>
            )}
            <div className="pt-1 text-[10px] text-cyan-400/80 italic text-center">
              Click to pin surface coordinate
            </div>
          </div>
        </div>
      )}

      {/* Instruction hint banner */}
      {!compactMode && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] font-mono text-slate-400 bg-slate-950/80 backdrop-blur-sm px-3 py-1 rounded-full border border-slate-800 pointer-events-none">
          Drag to rotate • Scroll to zoom • Click surface to inspect
        </div>
      )}
    </div>
  );
};

