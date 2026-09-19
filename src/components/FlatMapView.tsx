import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PlanetData, MapOverlayType, MapStyleType, MapProjectionType } from '../types';
import { PlanetTerrainEngine, getPixelColor, SamplePoint } from '../utils/proceduralTerrain';
import { Download, Layers, Sparkles, MapPin, ZoomIn, ZoomOut, RefreshCw, FileText } from 'lucide-react';

interface FlatMapViewProps {
  planet: PlanetData;
  overlay: MapOverlayType;
  style: MapStyleType;
  projection: MapProjectionType;
  onProjectionChange: (p: MapProjectionType) => void;
  onSelectCoordinate?: (lat: number, lon: number, sample: SamplePoint) => void;
  selectedCoord?: { lat: number; lon: number } | null;
  originCoord?: { lat: number; lon: number } | null;
  destCoord?: { lat: number; lon: number } | null;
  travelRouteDistanceKm?: number | null;
}

export const FlatMapView: React.FC<FlatMapViewProps> = ({
  planet,
  overlay,
  style,
  projection,
  onProjectionChange,
  onSelectCoordinate,
  selectedCoord,
  originCoord,
  destCoord,
  travelRouteDistanceKm,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState<number>(1.0);
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [lastPanMouse, setLastPanMouse] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hoverSample, setHoverSample] = useState<SamplePoint | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);

  const engineRef = useRef<PlanetTerrainEngine>(new PlanetTerrainEngine(planet));

  useEffect(() => {
    engineRef.current.updatePlanet(planet);
  }, [planet]);

  // Projection coordinate transformations
  const projectLatLonToXY = useCallback(
    (lat: number, lon: number, width: number, height: number, proj: MapProjectionType) => {
      const cx = width / 2;
      const cy = height / 2;

      switch (proj) {
        case 'mercator': {
          const latRad = (Math.max(-82, Math.min(82, lat)) * Math.PI) / 180;
          const x = cx + (lon / 180) * (width / 2);
          const y = cy - (Math.log(Math.tan(Math.PI / 4 + latRad / 2)) / Math.PI) * (height / 2);
          return { x, y, valid: true };
        }

        case 'mollweide': {
          // Mollweide equal-area projection
          const latRad = (lat * Math.PI) / 180;
          const lonRad = (lon * Math.PI) / 180;
          let theta = latRad;
          for (let i = 0; i < 4; i++) {
            theta -= (2 * theta + Math.sin(2 * theta) - Math.PI * Math.sin(latRad)) / (2 + 2 * Math.cos(2 * theta));
          }
          const x = cx + ((2 * Math.SQRT2) / Math.PI) * lonRad * Math.cos(theta) * (width / 5.6);
          const y = cy - Math.SQRT2 * Math.sin(theta) * (height / 2.8);
          return { x, y, valid: true };
        }

        case 'robinson': {
          // Robinson pseudo-cylindrical projection
          const yNorm = lat / 90;
          const latFactor = 1 - 0.28 * Math.pow(yNorm, 2);
          const x = cx + (lon / 180) * (width / 2) * latFactor;
          const y = cy - (lat / 90) * (height / 2) * 0.95;
          return { x, y, valid: true };
        }

        case 'equirectangular':
        default: {
          const x = cx + (lon / 180) * (width / 2);
          const y = cy - (lat / 90) * (height / 2);
          return { x, y, valid: true };
        }
      }
    },
    []
  );

  const inverseProjectXYToLatLon = useCallback(
    (x: number, y: number, width: number, height: number, proj: MapProjectionType) => {
      const cx = width / 2;
      const cy = height / 2;

      switch (proj) {
        case 'mercator': {
          const lon = ((x - cx) / (width / 2)) * 180;
          const yNorm = -((y - cy) / (height / 2)) * Math.PI;
          const latRad = 2 * Math.atan(Math.exp(yNorm)) - Math.PI / 2;
          const lat = (latRad * 180) / Math.PI;
          return { lat: Math.max(-85, Math.min(85, lat)), lon: Math.max(-180, Math.min(180, lon)), valid: true };
        }

        case 'mollweide': {
          const ny = -((y - cy) / (height / 2.8)) / Math.SQRT2;
          if (Math.abs(ny) > 1) return { lat: 0, lon: 0, valid: false };
          const theta = Math.asin(ny);
          const latRad = Math.asin((2 * theta + Math.sin(2 * theta)) / Math.PI);
          const cosTheta = Math.cos(theta);
          if (Math.abs(cosTheta) < 0.001) return { lat: (latRad * 180) / Math.PI, lon: 0, valid: true };
          const lonRad = ((x - cx) / (width / 5.6)) / (((2 * Math.SQRT2) / Math.PI) * cosTheta);
          const lon = (lonRad * 180) / Math.PI;
          if (Math.abs(lon) > 180) return { lat: 0, lon: 0, valid: false };
          return { lat: (latRad * 180) / Math.PI, lon, valid: true };
        }

        case 'robinson': {
          const lat = -((y - cy) / (height / 2)) * (90 / 0.95);
          const yNorm = lat / 90;
          const latFactor = Math.max(0.2, 1 - 0.28 * Math.pow(yNorm, 2));
          const lon = ((x - cx) / ((width / 2) * latFactor)) * 180;
          return {
            lat: Math.max(-90, Math.min(90, lat)),
            lon: Math.max(-180, Math.min(180, lon)),
            valid: Math.abs(lon) <= 180 && Math.abs(lat) <= 90,
          };
        }

        case 'equirectangular':
        default: {
          const lon = ((x - cx) / (width / 2)) * 180;
          const lat = -((y - cy) / (height / 2)) * 90;
          return {
            lat: Math.max(-90, Math.min(90, lat)),
            lon: Math.max(-180, Math.min(180, lon)),
            valid: Math.abs(lon) <= 180 && Math.abs(lat) <= 90,
          };
        }
      }
    },
    []
  );

  // Render Flat Map canvas
  const renderMap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    if (width === 0 || height === 0) return;

    // Fill space background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    const imgData = ctx.createImageData(width, height);
    const data = imgData.data;

    // Step size for Chromebook high responsiveness: 2px blocks in realtime
    const step = 2;

    for (let y = 0; y < height; y += step) {
      // Unapply pan and zoom to find map coordinate
      const mapY = (y - pan.y - height / 2) / zoom + height / 2;

      for (let x = 0; x < width; x += step) {
        const mapX = (x - pan.x - width / 2) / zoom + width / 2;

        const { lat, lon, valid } = inverseProjectXYToLatLon(mapX, mapY, width, height, projection);

        if (valid) {
          const sample = engineRef.current.sample(lat, lon);
          const [r, g, b] = getPixelColor(sample, overlay, style, planet);

          for (let by = 0; by < step && y + by < height; by++) {
            for (let bx = 0; bx < step && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = 255;
            }
          }
        } else {
          // Space margin outside projection border
          for (let by = 0; by < step && y + by < height; by++) {
            for (let bx = 0; bx < step && x + bx < width; bx++) {
              const idx = ((y + by) * width + (x + bx)) * 4;
              data[idx] = 10;
              data[idx + 1] = 15;
              data[idx + 2] = 28;
              data[idx + 3] = 255;
            }
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Apply pan & zoom transform for vector overlays
    ctx.save();
    ctx.translate(pan.x + width / 2, pan.y + height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-width / 2, -height / 2);

    // Render Coordinate Graticule (Parallels & Meridians)
    if (showGrid) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);

      // Parallels every 30 degrees
      for (let lat = -60; lat <= 60; lat += 30) {
        ctx.beginPath();
        let started = false;
        for (let lon = -180; lon <= 180; lon += 5) {
          const pt = projectLatLonToXY(lat, lon, width, height, projection);
          if (pt.valid) {
            if (!started) {
              ctx.moveTo(pt.x, pt.y);
              started = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        }
        ctx.stroke();
      }

      // Equator highlight
      ctx.strokeStyle = 'rgba(234, 179, 8, 0.4)';
      ctx.setLineDash([]);
      ctx.beginPath();
      let eqStarted = false;
      for (let lon = -180; lon <= 180; lon += 4) {
        const pt = projectLatLonToXY(0, lon, width, height, projection);
        if (pt.valid) {
          if (!eqStarted) {
            ctx.moveTo(pt.x, pt.y);
            eqStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      ctx.stroke();

      // Meridians every 45 degrees
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.25)';
      ctx.setLineDash([2, 4]);
      for (let lon = -180; lon <= 180; lon += 45) {
        ctx.beginPath();
        let mStarted = false;
        for (let lat = -80; lat <= 80; lat += 4) {
          const pt = projectLatLonToXY(lat, lon, width, height, projection);
          if (pt.valid) {
            if (!mStarted) {
              ctx.moveTo(pt.x, pt.y);
              mStarted = true;
            } else {
              ctx.lineTo(pt.x, pt.y);
            }
          }
        }
        ctx.stroke();
      }
    }

    // Render Tectonic Plate Boundaries Vector Overlay
    if (overlay === 'tectonics' && planet.plates && planet.plates.length > 0) {
      for (const p of planet.plates) {
        const pt = projectLatLonToXY(p.centerLat, p.centerLon, width, height, projection);
        if (pt.valid) {
          // Plate center node
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fill();

          // Motion vector arrow
          const rad = (p.headingDeg * Math.PI) / 180;
          const arrowLen = p.velocityMmYr * 0.45;
          const targetX = pt.x + Math.sin(rad) * arrowLen;
          const targetY = pt.y - Math.cos(rad) * arrowLen;

          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(pt.x, pt.y);
          ctx.lineTo(targetX, targetY);
          ctx.stroke();

          ctx.font = '10px "JetBrains Mono", monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText(`${p.name} (${p.velocityMmYr} mm/yr)`, pt.x + 8, pt.y - 4);
        }
      }
    }

    // Render Great-Circle Travel Route Line if Origin and Dest are set
    if (originCoord && destCoord) {
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();

      const numWaypoints = 40;
      let pathStarted = false;

      for (let i = 0; i <= numWaypoints; i++) {
        const frac = i / numWaypoints;
        // Interpolate along great-circle
        const lat = originCoord.lat + (destCoord.lat - originCoord.lat) * frac;
        const lon = originCoord.lon + (destCoord.lon - originCoord.lon) * frac;

        const pt = projectLatLonToXY(lat, lon, width, height, projection);
        if (pt.valid) {
          if (!pathStarted) {
            ctx.moveTo(pt.x, pt.y);
            pathStarted = true;
          } else {
            ctx.lineTo(pt.x, pt.y);
          }
        }
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Draw Origin Pin
      const origPt = projectLatLonToXY(originCoord.lat, originCoord.lon, width, height, projection);
      if (origPt.valid) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(origPt.x, origPt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#a7f3d0';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('ORIGIN', origPt.x + 8, origPt.y + 4);
      }

      // Draw Dest Pin
      const destPt = projectLatLonToXY(destCoord.lat, destCoord.lon, width, height, projection);
      if (destPt.valid) {
        ctx.fillStyle = '#f43f5e';
        ctx.beginPath();
        ctx.arc(destPt.x, destPt.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.fillStyle = '#fecdd3';
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('DESTINATION', destPt.x + 8, destPt.y + 4);
      }
    }

    // Render Selected Pin
    if (selectedCoord) {
      const selPt = projectLatLonToXY(selectedCoord.lat, selectedCoord.lon, width, height, projection);
      if (selPt.valid) {
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(selPt.x, selPt.y, 9, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#22d3ee';
        ctx.beginPath();
        ctx.arc(selPt.x, selPt.y, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();

    // Draw Cartographic Map Legend & Title Box
    drawCartographicFrame(ctx, width, height, planet, overlay, projection);
  }, [
    planet,
    overlay,
    style,
    projection,
    pan,
    zoom,
    showGrid,
    selectedCoord,
    originCoord,
    destCoord,
    projectLatLonToXY,
    inverseProjectXYToLatLon,
  ]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!containerRef.current || !canvasRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const targetWidth = Math.max(480, Math.floor(rect.width));
      const targetHeight = Math.max(340, Math.floor(rect.width * 0.55));
      canvasRef.current.width = targetWidth;
      canvasRef.current.height = targetHeight;
      renderMap();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [renderMap]);

  useEffect(() => {
    renderMap();
  }, [renderMap]);

  // Pan and Zoom interactions
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsPanning(true);
    setLastPanMouse({ x: e.clientX, y: e.clientY });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseCanvasX = e.clientX - rect.left;
    const mouseCanvasY = e.clientY - rect.top;

    setMousePos({ x: e.clientX, y: e.clientY });

    if (isPanning) {
      const dx = e.clientX - lastPanMouse.x;
      const dy = e.clientY - lastPanMouse.y;
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      setLastPanMouse({ x: e.clientX, y: e.clientY });
      return;
    }

    // Calculate Lat/Lon for hover tooltip
    const width = canvas.width;
    const height = canvas.height;
    const mapX = (mouseCanvasX - pan.x - width / 2) / zoom + width / 2;
    const mapY = (mouseCanvasY - pan.y - height / 2) / zoom + height / 2;

    const { lat, lon, valid } = inverseProjectXYToLatLon(mapX, mapY, width, height, projection);
    if (valid) {
      const sample = engineRef.current.sample(lat, lon);
      setHoverSample(sample);
    } else {
      setHoverSample(null);
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
  };

  const handleClick = () => {
    if (hoverSample && onSelectCoordinate) {
      onSelectCoordinate(hoverSample.lat, hoverSample.lon, hoverSample);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY * -0.0015;
    setZoom((prev) => Math.max(0.75, Math.min(4.0, prev + zoomDelta)));
  };

  // High-Resolution Map PNG Export (Generates a clean 3840x2160 or 2560x1440 print cartography map)
  const handleExportPNG = async () => {
    setIsExporting(true);
    try {
      const exportCanvas = document.createElement('canvas');
      const exWidth = 3200;
      const exHeight = 1800;
      exportCanvas.width = exWidth;
      exportCanvas.height = exHeight;
      const exCtx = exportCanvas.getContext('2d');
      if (!exCtx) return;

      // Draw high-res equirectangular or selected projection
      exCtx.fillStyle = '#020617';
      exCtx.fillRect(0, 0, exWidth, exHeight);

      const exImgData = exCtx.createImageData(exWidth, exHeight);
      const exData = exImgData.data;

      for (let y = 0; y < exHeight; y++) {
        for (let x = 0; x < exWidth; x++) {
          const { lat, lon, valid } = inverseProjectXYToLatLon(x, y, exWidth, exHeight, projection);
          if (valid) {
            const sample = engineRef.current.sample(lat, lon);
            const [r, g, b] = getPixelColor(sample, overlay, style);
            const idx = (y * exWidth + x) * 4;
            exData[idx] = r;
            exData[idx + 1] = g;
            exData[idx + 2] = b;
            exData[idx + 3] = 255;
          }
        }
      }
      exCtx.putImageData(exImgData, 0, 0);

      // Add high-res decorative border and cartographic cartouche
      drawHighResCartouche(exCtx, exWidth, exHeight, planet, overlay, projection);

      // Trigger download
      const dataUrl = exportCanvas.toDataURL('image/png', 0.95);
      const link = document.createElement('a');
      link.download = `${planet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${projection}_${overlay}_highres.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('Map export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div
      ref={containerRef}
      id="flat-map-container"
      className="relative w-full flex flex-col bg-slate-950/80 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl"
    >
      {/* Top Map Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-900/90 border-b border-slate-800 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300 font-semibold">PROJECTION:</span>
          {(['equirectangular', 'robinson', 'mercator', 'mollweide'] as MapProjectionType[]).map((p) => (
            <button
              key={p}
              onClick={() => onProjectionChange(p)}
              className={`px-2.5 py-1 rounded-lg uppercase transition-all ${
                projection === p
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1 rounded-lg transition-colors ${
              showGrid ? 'bg-slate-800 text-slate-200' : 'text-slate-500 hover:bg-slate-800'
            }`}
          >
            Graticule Grid
          </button>

          <button
            onClick={() => {
              setPan({ x: 0, y: 0 });
              setZoom(1.0);
            }}
            className="p-1 rounded-lg text-slate-400 hover:bg-slate-800"
            title="Reset Map View"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleExportPNG}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-bold transition-all shadow-md shadow-cyan-900/30 active:scale-95 disabled:opacity-50"
            title="Export High-Resolution Map (PNG)"
          >
            <Download className="w-3.5 h-3.5" />
            <span>{isExporting ? 'Generating...' : 'Export High-Res PNG'}</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Canvas */}
      <div className="relative w-full overflow-hidden flex items-center justify-center bg-slate-950">
        <canvas
          ref={canvasRef}
          id="flat-map-canvas"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => {
            setIsPanning(false);
            setHoverSample(null);
          }}
          onClick={handleClick}
          onWheel={handleWheel}
          className="cursor-crosshair block max-w-full"
        />

        {/* Hover Inspector Tooltip */}
        {hoverSample && mousePos && (
          <div
            style={{ left: mousePos.x + 14, top: mousePos.y + 14 }}
            className="fixed pointer-events-none z-50 bg-slate-900/95 backdrop-blur-md p-3 rounded-xl border border-cyan-500/40 shadow-2xl text-xs font-mono max-w-[260px] animate-in fade-in duration-150"
          >
            <div className="text-cyan-400 font-bold border-b border-slate-800 pb-1 flex items-center justify-between">
              <span>{hoverSample.biome}</span>
              <span className="text-slate-400 text-[10px]">
                {hoverSample.lat >= 0 ? '+' : ''}{hoverSample.lat.toFixed(1)}°, {hoverSample.lon >= 0 ? '+' : ''}{hoverSample.lon.toFixed(1)}°
              </span>
            </div>
            <div className="mt-2 space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-400">Elevation:</span>
                <span className={hoverSample.isWater ? 'text-blue-400' : 'text-emerald-400'}>
                  {hoverSample.depthOrHeightM >= 0 ? `+${hoverSample.depthOrHeightM} m` : `${hoverSample.depthOrHeightM} m (Bathy)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">MAST:</span>
                <span className="text-amber-300 font-semibold">{hoverSample.temperatureC}°C</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Precipitation:</span>
                <span>{hoverSample.precipitationMm} mm</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Suitability:</span>
                <span className="text-cyan-400 font-bold">{hoverSample.settlementSuitability} / 100</span>
              </div>
              {hoverSample.dominantOre && (
                <div className="flex justify-between border-t border-slate-800/80 pt-1 text-[10px]">
                  <span className="text-purple-400">Ore:</span>
                  <span className="text-purple-300 font-bold truncate max-w-[140px]">
                    {hoverSample.dominantOre.symbol} ({hoverSample.oreEnrichmentFactor}x)
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Travel Route Info Pill if active */}
        {travelRouteDistanceKm && (
          <div className="absolute top-4 left-4 bg-cyan-950/80 backdrop-blur-md border border-cyan-500/40 px-3 py-1.5 rounded-xl text-xs font-mono text-cyan-200 flex items-center gap-2">
            <MapPin className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span>Active Surface Arc: <strong>{travelRouteDistanceKm.toLocaleString()} km</strong></span>
          </div>
        )}
      </div>
    </div>
  );
};

// Draw elegant cartographic legend directly onto the canvas
function drawCartographicFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: PlanetData,
  overlay: MapOverlayType,
  proj: MapProjectionType
) {
  ctx.save();
  // Cartouche in bottom left
  const boxW = 240;
  const boxH = 68;
  const boxX = 16;
  const boxY = height - boxH - 16;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
  ctx.strokeStyle = 'rgba(51, 65, 85, 0.8)';
  ctx.lineWidth = 1;
  ctx.fillRect(boxX, boxY, boxW, boxH);
  ctx.strokeRect(boxX, boxY, boxW, boxH);

  ctx.font = 'bold 12px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(planet.name.toUpperCase(), boxX + 12, boxY + 20);

  ctx.font = '10px "JetBrains Mono", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`LAYER: ${overlay.replace('_', ' ').toUpperCase()}`, boxX + 12, boxY + 38);

  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`PROJECTION: ${proj.toUpperCase()} • R: ${planet.radiusEarth} R⊕`, boxX + 12, boxY + 54);

  ctx.restore();
}

function drawHighResCartouche(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  planet: PlanetData,
  overlay: MapOverlayType,
  proj: MapProjectionType
) {
  ctx.save();
  // Top Title banner
  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.fillRect(40, 40, 680, 140);
  ctx.strokeStyle = '#38bdf8';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, 680, 140);

  ctx.font = 'bold 36px "Space Grotesk", sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(planet.name.toUpperCase(), 64, 95);

  ctx.font = '18px "JetBrains Mono", monospace';
  ctx.fillStyle = '#38bdf8';
  ctx.fillText(`HIGH-PRECISION CARTOGRAPHIC SURVEY • ${overlay.toUpperCase()}`, 64, 130);

  ctx.font = '14px "JetBrains Mono", monospace';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`PROJECTION: ${proj.toUpperCase()} | RADIUS: ${planet.radiusEarth} R⊕ | GRAVITY: ${planet.surfaceGravityG}g`, 64, 160);

  // Border frame
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
  ctx.lineWidth = 8;
  ctx.strokeRect(20, 20, width - 40, height - 40);

  ctx.restore();
}
