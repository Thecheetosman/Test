import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  PlanetData,
  MapOverlayType,
  MapStyleType,
  MapProjectionType,
  MineralDeposit,
  ChronicleEvent,
} from './types';
import { PRESET_PLANETS, PLANET_PRESETS } from './utils/presets';
import {
  loadStoredWorlds,
  saveStoredWorlds,
  getActiveWorldId,
  setActiveWorldId,
  pushWorldToCloud,
  fetchWorldFromCloud,
} from './utils/storage';
import { PlanetTerrainEngine, SamplePoint } from './utils/proceduralTerrain';
import { calculateGreatCircleDistanceKm } from './utils/physics';

import { PlanetGlobeView } from './components/PlanetGlobeView';
import { FlatMapView } from './components/FlatMapView';
import { OrbitalVisualizer } from './components/OrbitalVisualizer';
import { NightSkyView } from './components/NightSkyView';
import { EnvironmentalPanel } from './components/EnvironmentalPanel';
import { TectonicsDeepTimePanel } from './components/TectonicsDeepTimePanel';
import { CivilizationChronicle } from './components/CivilizationChronicle';
import { TravelCalculator } from './components/TravelCalculator';
import { PlanetEditorPanel } from './components/PlanetEditorPanel';
import { ReportExportModal } from './components/ReportExportModal';

import {
  Globe,
  Map as MapIcon,
  Orbit,
  Eye,
  Sliders,
  FileText,
  Cloud,
  CloudCheck,
  CloudUpload,
  RefreshCw,
  Sparkles,
  Layers,
  Palette,
  Compass,
  Navigation,
  BookOpen,
  Activity,
  History,
  ShieldCheck,
  ChevronDown,
  Mountain,
} from 'lucide-react';
import { GlobeaLogo } from './components/GlobeaLogo';
import { HeightmapSculptPanel } from './components/HeightmapSculptPanel';
import { AtlasLeftSidebar } from './components/AtlasLeftSidebar';
import {
  AtlasGeneratedViewsBar,
  GeneratedViewCategory,
  SUB_VIEWS,
  SubViewConfig,
} from './components/AtlasGeneratedViewsBar';
import { FourGlobeSheet } from './components/FourGlobeSheet';
import {
  Download,
  Plus,
  ZoomIn,
  ZoomOut,
  Maximize2,
  PanelLeftClose,
  PanelLeftOpen,
  Check,
} from 'lucide-react';

type MainViewTab =
  | 'globe'
  | 'flat_map'
  | 'heightmap'
  | 'orbits'
  | 'night_sky'
  | 'chronicle'
  | 'travel'
  | 'tectonics'
  | 'environment'
  | 'four_globe_sheet';

export default function App() {
  // Worlds collection and active world state
  const [worlds, setWorlds] = useState<PlanetData[]>(() => loadStoredWorlds());
  const [activeWorldId, setActiveWorldIdState] = useState<string>(() => getActiveWorldId());

  // Active Planet object
  const activePlanet = useMemo(() => {
    const found = worlds.find((w) => w.id === activeWorldId);
    return found || worlds[0] || PRESET_PLANETS.earth_like;
  }, [worlds, activeWorldId]);

  // Main navigation tab
  const [activeTab, setActiveTab] = useState<MainViewTab>('globe');

  // Map display settings
  const [overlay, setOverlay] = useState<MapOverlayType>('physical');
  const [style, setStyle] = useState<MapStyleType>('satellite');
  const [projection, setProjection] = useState<MapProjectionType>('equirectangular');

  // UI Drawers and Modals
  const [showEditor, setShowEditor] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);

  // Inspection & Travel Coordinates
  const [selectedCoord, setSelectedCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [selectedSample, setSelectedSample] = useState<SamplePoint | null>(null);
  const [originCoord, setOriginCoord] = useState<{ lat: number; lon: number } | null>(null);
  const [destCoord, setDestCoord] = useState<{ lat: number; lon: number } | null>(null);

  // Atlas Studio Layout & Selectable Views States
  const [showLeftPanel, setShowLeftPanel] = useState<boolean>(true);
  const [activeCategory, setActiveCategory] = useState<GeneratedViewCategory>('terrain_geology');
  const [activeSubViewId, setActiveSubViewId] = useState<string>('physical_relief');
  const [zoomScale, setZoomScale] = useState<number>(1.0);
  const [isSculptActive, setIsSculptActive] = useState<boolean>(false);
  const [showWorldDropdown, setShowWorldDropdown] = useState<boolean>(false);

  // Cloud Sync state
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'offline'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // AI Lore Generation state
  const [isGeneratingLore, setIsGeneratingLore] = useState<boolean>(false);

  // Sync to localStorage whenever worlds change
  useEffect(() => {
    saveStoredWorlds(worlds);
  }, [worlds]);

  // Update active world ID
  const handleSelectWorld = (id: string) => {
    setActiveWorldIdState(id);
    setActiveWorldId(id);
    setSelectedCoord(null);
    setSelectedSample(null);
  };

  // Mutator for the active planet
  const handleUpdateActivePlanet = useCallback(
    (updater: (prev: PlanetData) => PlanetData) => {
      setWorlds((prevWorlds) =>
        prevWorlds.map((w) => (w.id === activeWorldId ? updater(w) : w))
      );
    },
    [activeWorldId]
  );

  // Load Preset
  const handleLoadPreset = (presetId: string) => {
    const preset = PLANET_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    const newPlanet: PlanetData = {
      ...preset,
      id: `world-${Date.now()}`,
      seed: Math.floor(Math.random() * 1000000),
    };

    setWorlds((prev) => [newPlanet, ...prev]);
    setActiveWorldIdState(newPlanet.id);
    setActiveWorldId(newPlanet.id);
  };

  // Perform Cloud Sync
  const handleTriggerCloudSync = async () => {
    setSyncStatus('syncing');
    try {
      const res = await pushWorldToCloud(activePlanet);
      if (res.success) {
        setSyncStatus('synced');
        setLastSyncTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        setTimeout(() => setSyncStatus('idle'), 3000);
      } else {
        setSyncStatus('offline');
      }
    } catch {
      setSyncStatus('offline');
    }
  };

  // Handle Coordinate Click from Globe or Map
  const handleSelectCoordinate = (
    latOrCoord: number | { lat: number; lon: number },
    maybeLon?: number,
    maybeSample?: SamplePoint
  ) => {
    let lat: number;
    let lon: number;
    let sample: SamplePoint | undefined;
    if (typeof latOrCoord === 'object') {
      lat = latOrCoord.lat;
      lon = latOrCoord.lon;
      sample = maybeLon as unknown as SamplePoint;
    } else {
      lat = latOrCoord;
      lon = maybeLon ?? 0;
      sample = maybeSample;
    }
    setSelectedCoord({ lat, lon });
    if (sample) {
      setSelectedSample(sample);
    } else {
      const s = new PlanetTerrainEngine(activePlanet).sample(lat, lon);
      setSelectedSample(s);
    }
  };

  // Quick Generate new seed or planet variation
  const handleQuickGenerate = () => {
    const newSeed = Math.floor(Math.random() * 900000) + 100000;
    handleUpdateActivePlanet((prev) => ({
      ...prev,
      seed: newSeed,
      name: prev.name.endsWith(' II') ? prev.name.replace(' II', ' III') : `${prev.name} II`,
      axialTiltDeg: Math.round((Math.random() * 32 + 3) * 10) / 10,
    }));
  };

  // SubView selection handler
  const handleSelectSubView = (sub: SubViewConfig) => {
    setActiveSubViewId(sub.id);
    setIsSculptActive(false);

    if (sub.isSpecial === 'four_globe_sheet') {
      setActiveTab('four_globe_sheet');
      return;
    }
    if (sub.overlay) {
      setOverlay(sub.overlay);
    }
    if (sub.style) {
      setStyle(sub.style);
    }
    if (sub.projection) {
      setProjection(sub.projection);
      setActiveTab('flat_map');
    } else if (activeTab === 'four_globe_sheet') {
      setActiveTab('globe');
    }
  };

  // Toggle terrain sculpt mode
  const handleToggleSculpt = () => {
    if (isSculptActive) {
      setIsSculptActive(false);
      setActiveTab('globe');
    } else {
      setIsSculptActive(true);
      setActiveTab('heightmap');
    }
  };

  // Trigger high-res PNG export of currently active canvas
  const handleDownloadMapPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) {
      alert('No active map canvas found to export.');
      return;
    }
    const dataUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${activePlanet.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${activeSubViewId}.png`;
    link.href = dataUrl;
    link.click();
  };

  // Add Event to Chronicle
  const handleAddChronicleEvent = (event: ChronicleEvent) => {
    handleUpdateActivePlanet((prev) => ({
      ...prev,
      chronicle: [event, ...prev.chronicle],
    }));
  };

  // Delete Event from Chronicle
  const handleDeleteChronicleEvent = (eventId: string) => {
    handleUpdateActivePlanet((prev) => ({
      ...prev,
      chronicle: prev.chronicle.filter((e) => e.id !== eventId),
    }));
  };

  // AI Astrobiology Lore generation via server API
  const handleGenerateAILore = async () => {
    setIsGeneratingLore(true);
    try {
      const res = await fetch('/api/ai-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planetData: activePlanet,
          prompt: `Generate 2 unique cultural/historical chronicle events for the habitable era of ${activePlanet.name}. Detail how the planet's gravity (${activePlanet.surfaceGravityG}g), moons, or atmosphere affected civilization development. Format as JSON array of events with title and description.`,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        // Add a lore event summarizing the research
        const newLoreEvent: ChronicleEvent = {
          id: `ai-lore-${Date.now()}`,
          year: activePlanet.calendar.currentYear - 45,
          planetDay: 112,
          eraId: activePlanet.eras[0]?.id || 'era-default',
          title: 'Synthesis of Astrobiological Records',
          category: 'sociopolitical',
          description: data.report.slice(0, 320) + '...',
        };
        handleAddChronicleEvent(newLoreEvent);
      }
    } catch (err) {
      console.warn('AI lore synthesis failed, using local generator:', err);
      const fallbackEvent: ChronicleEvent = {
        id: `ai-fallback-${Date.now()}`,
        year: activePlanet.calendar.currentYear - 20,
        planetDay: 48,
        eraId: activePlanet.eras[0]?.id || 'era-default',
        title: 'Atmospheric Harmonization Pact',
        category: 'sociopolitical',
        description: `Colony conglomerates signed the Volatile Retention Accord to regulate industrial halocarbon emissions in ${activePlanet.name}'s ${activePlanet.atmosphere.surfacePressureAtm} atm envelope.`,
      };
      handleAddChronicleEvent(fallbackEvent);
    } finally {
      setIsGeneratingLore(false);
    }
  };

  // Calculate surface arc distance between origin and destination
  const travelRouteDistanceKm = useMemo(() => {
    if (!originCoord || !destCoord) return null;
    return calculateGreatCircleDistanceKm(
      originCoord.lat,
      originCoord.lon,
      destCoord.lat,
      destCoord.lon,
      activePlanet.radiusEarth
    );
  }, [originCoord, destCoord, activePlanet.radiusEarth]);

  const activeSubViewObj = useMemo(
    () => SUB_VIEWS.find((v) => v.id === activeSubViewId) || SUB_VIEWS[0],
    [activeSubViewId]
  );

  return (
    <div className="min-h-screen bg-black text-slate-100 flex flex-col font-mono selection:bg-amber-500 selection:text-black">
      {/* 1. TOP BAR: ATLAS STUDIO NAVIGATION */}
      <header className="sticky top-0 z-40 bg-black/95 backdrop-blur-md border-b border-slate-800 px-4 py-2 shadow-2xl">
        <div className="w-full flex items-center justify-between gap-4">
          {/* Logo & Subtitle */}
          <div className="shrink-0 flex items-center gap-3">
            <GlobeaLogo size="sm" showSubtitle={true} />
          </div>

          {/* Center Navigation Tabs (Selectable!) */}
          <nav className="hidden lg:flex items-center gap-1 text-xs">
            <button
              onClick={() => setShowEditor(true)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Create
            </button>
            <button
              onClick={() => setActiveTab('tectonics')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'tectonics'
                  ? 'bg-slate-900 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Deep Time
            </button>
            <button
              onClick={() => setShowEditor(true)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Compare 0
            </button>
            <button
              onClick={() => {
                setActiveTab('globe');
                setActiveSubViewId('physical_relief');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'globe' || activeTab === 'four_globe_sheet'
                  ? 'bg-slate-900 text-amber-300 font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>World</span>
            </button>
            <button
              onClick={() => setActiveTab('flat_map')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'flat_map'
                  ? 'bg-slate-900 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Atlas
            </button>
            <button
              onClick={() => setActiveTab('travel')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'travel'
                  ? 'bg-slate-900 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Travel
            </button>
            <button
              onClick={() => setActiveTab('chronicle')}
              className={`px-3 py-1.5 rounded-lg transition-colors ${
                activeTab === 'chronicle'
                  ? 'bg-slate-900 text-white font-bold border border-slate-700'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900'
              }`}
            >
              Chronicle
            </button>
            <button
              onClick={handleGenerateAILore}
              disabled={isGeneratingLore}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-slate-400 hover:text-amber-300 hover:bg-slate-900 transition-colors"
              title="Generate AI Astrobiological lore"
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Lore</span>
            </button>
            <button
              onClick={() => setShowWorldDropdown(!showWorldDropdown)}
              className="px-3 py-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
            >
              Library {worlds.length}
            </button>
          </nav>

          {/* Right Action Controls: Preview & Generate Button */}
          <div className="flex items-center gap-2 text-xs">
            <button
              onClick={handleTriggerCloudSync}
              className="px-3 py-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
              title="Sync Worlds with Cloud Storage"
            >
              {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'synced' ? 'Synced' : 'Preview'}
            </button>
            <button
              onClick={handleQuickGenerate}
              className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-4 py-1.5 rounded-lg text-xs tracking-wide shadow-md shadow-amber-500/20 active:scale-95 transition-all"
            >
              Generate
            </button>
          </div>
        </div>
      </header>

      {/* 2. SUB-HEADER TOOLBAR */}
      <div className="w-full bg-black border-b border-slate-800/90 px-4 py-2 flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Hide Panel Toggle + World Tag & Name */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLeftPanel(!showLeftPanel)}
            className="flex items-center gap-1 text-slate-400 hover:text-white transition-colors"
            title="Toggle Left Studio Panel"
          >
            {showLeftPanel ? (
              <>
                <PanelLeftClose className="w-3.5 h-3.5" />
                <span>[Hide panel]</span>
              </>
            ) : (
              <>
                <PanelLeftOpen className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-amber-400">[Show panel]</span>
              </>
            )}
          </button>

          <span className="px-1.5 py-0.5 rounded bg-amber-950/70 border border-amber-500/40 text-amber-400 font-bold text-[10px] tracking-wider">
            ACTIVE R0001
          </span>

          {/* World Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowWorldDropdown(!showWorldDropdown)}
              className="flex items-center gap-1.5 font-bold text-white hover:text-amber-300 transition-colors"
            >
              <span>{activePlanet.name.toUpperCase()}</span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {showWorldDropdown && (
              <div className="absolute left-0 mt-2 w-56 bg-slate-950 border border-slate-800 rounded-xl shadow-2xl z-50 p-1.5">
                <div className="text-[10px] text-slate-500 px-2 py-1 uppercase tracking-wider font-semibold">
                  Saved Worlds
                </div>
                {worlds.map((w) => (
                  <button
                    key={w.id}
                    onClick={() => {
                      handleSelectWorld(w.id);
                      setShowWorldDropdown(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs flex items-center justify-between ${
                      w.id === activeWorldId
                        ? 'bg-amber-950/70 text-amber-300 font-bold'
                        : 'text-slate-300 hover:bg-slate-900'
                    }`}
                  >
                    <span>{w.name}</span>
                    <span className="text-[10px] text-slate-500">{w.archetype.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <span className="text-slate-500 text-[11px]">r0001 · 1 revision</span>
        </div>

        {/* Right: Views count, Export, Original, PNG Download */}
        <div className="flex items-center gap-2">
          {/* Active View Quick Dropdown */}
          <select
            value={activeSubViewId}
            onChange={(e) => {
              const found = SUB_VIEWS.find((v) => v.id === e.target.value);
              if (found) handleSelectSubView(found);
            }}
            className="bg-slate-900 border border-slate-800 text-slate-300 px-2.5 py-1 rounded-lg text-xs focus:outline-none"
          >
            {SUB_VIEWS.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>

          {/* Export Report Modal */}
          <button
            onClick={() => setShowExportModal(true)}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white transition-colors"
          >
            Export v
          </button>

          {/* Views count badge */}
          <span className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-slate-400 text-[11px]">
            38 of 47 views
          </span>

          {/* Reset original parameters */}
          <button
            onClick={() => handleLoadPreset('earth_like')}
            className="px-2.5 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
          >
            Original
          </button>

          {/* Download Canvas as PNG */}
          <button
            onClick={handleDownloadMapPNG}
            className="flex items-center gap-1 px-3 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-amber-300 font-bold transition-all"
            title="Download high-resolution PNG of current map view"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>PNG</span>
          </button>
        </div>
      </div>

      {/* 3. GENERATED VIEWS CATEGORY SELECTION BAR */}
      <AtlasGeneratedViewsBar
        activeCategory={activeCategory}
        onSelectCategory={setActiveCategory}
        activeSubViewId={activeSubViewId}
        onSelectSubView={handleSelectSubView}
        onToggleSculpt={handleToggleSculpt}
        isSculptActive={isSculptActive}
      />

      {/* 4. MAIN SPLIT STUDIO WORKBENCH (Left Sidebar + Right Viewport) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column Sidebar */}
        {showLeftPanel && (
          <AtlasLeftSidebar
            planet={activePlanet}
            overlay={overlay}
            style={style}
            onOpenEditor={() => setShowEditor(true)}
            onSelectCoord={handleSelectCoordinate}
            onUpdatePlanetName={(newName) => {
              handleUpdateActivePlanet((prev) => ({ ...prev, name: newName }));
            }}
          />
        )}

        {/* Right Column Viewport Canvas Area */}
        <main className="flex-1 relative flex flex-col bg-black overflow-hidden">
          {/* Viewport Top Header Banner */}
          <div className="bg-black/80 backdrop-blur-sm border-b border-slate-900 px-4 py-2 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span className="text-white font-bold tracking-wide">
                {activeSubViewObj.name}
              </span>
              <span className="text-slate-500">•</span>
              <span className="text-slate-400 text-[11px] truncate">
                {activeSubViewObj.description}
              </span>
            </div>
            <div className="flex items-center gap-2 text-slate-500 text-[11px]">
              <span>Seed: {activePlanet.seed}</span>
              <span>Tilt: {activePlanet.axialTiltDeg.toFixed(1)}°</span>
            </div>
          </div>

          {/* Selected Core Sample Banner (if user clicks any point) */}
          {selectedSample && (
            <div className="mx-4 my-2 bg-slate-950/95 border border-amber-500/40 p-3 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl animate-in fade-in z-20">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-amber-950 border border-amber-500/40">
                  <Compass className="w-4 h-4 text-amber-400" />
                </div>
                <div>
                  <div className="text-amber-300 font-bold">
                    {selectedSample.biome.toUpperCase()} ({selectedSample.lat.toFixed(1)}°N, {selectedSample.lon.toFixed(1)}°E)
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Elevation: <strong className={selectedSample.isWater ? 'text-blue-400' : 'text-emerald-400'}>{selectedSample.depthOrHeightM} m</strong> • MAST: <strong className="text-amber-300">{selectedSample.temperatureC}°C</strong> • MAP: <strong>{selectedSample.precipitationMm} mm</strong> • Suitability: <strong className="text-cyan-400">{selectedSample.settlementSuitability}/100</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setOriginCoord({ lat: selectedSample.lat, lon: selectedSample.lon });
                    setActiveTab('travel');
                  }}
                  className="px-2.5 py-1 bg-emerald-950 border border-emerald-500/50 text-emerald-300 rounded-lg font-bold"
                >
                  Set Origin
                </button>
                <button
                  onClick={() => {
                    setDestCoord({ lat: selectedSample.lat, lon: selectedSample.lon });
                    setActiveTab('travel');
                  }}
                  className="px-2.5 py-1 bg-rose-950 border border-rose-500/50 text-rose-300 rounded-lg font-bold"
                >
                  Set Destination
                </button>
                <button
                  onClick={() => {
                    setSelectedCoord(null);
                    setSelectedSample(null);
                  }}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Active View Container */}
          <div className="flex-1 relative overflow-auto flex items-center justify-center p-2">
            {activeTab === 'four_globe_sheet' && (
              <FourGlobeSheet
                planet={activePlanet}
                overlay={overlay}
                style={style}
                solarHour={14.2}
              />
            )}

            {activeTab === 'globe' && (
              <div className="w-full h-full flex flex-col items-center justify-center">
                <PlanetGlobeView
                  planet={activePlanet}
                  overlay={overlay}
                  style={style}
                  selectedCoord={selectedCoord}
                  onSelectCoordinate={handleSelectCoordinate}
                />
              </div>
            )}

            {activeTab === 'flat_map' && (
              <div className="w-full h-full">
                <FlatMapView
                  planet={activePlanet}
                  overlay={overlay}
                  style={style}
                  projection={projection}
                  onProjectionChange={setProjection}
                  selectedCoord={selectedCoord}
                  onSelectCoordinate={handleSelectCoordinate}
                  originCoord={originCoord}
                  destCoord={destCoord}
                  travelRouteDistanceKm={travelRouteDistanceKm}
                />
              </div>
            )}

            {activeTab === 'heightmap' && (
              <div className="w-full h-full">
                <HeightmapSculptPanel
                  planet={activePlanet}
                  onUpdatePlanet={handleUpdateActivePlanet}
                  onSelectCoord={handleSelectCoordinate}
                />
              </div>
            )}

            {activeTab === 'orbits' && (
              <div className="w-full h-full">
                <OrbitalVisualizer
                  planet={activePlanet}
                  onUpdatePlanetOrbit={(newA, newE) => {
                    handleUpdateActivePlanet((prev) => ({
                      ...prev,
                      semiMajorAxisAU: newA,
                      eccentricity: newE,
                    }));
                  }}
                />
              </div>
            )}

            {activeTab === 'night_sky' && (
              <div className="w-full h-full">
                <NightSkyView planet={activePlanet} />
              </div>
            )}

            {activeTab === 'travel' && (
              <div className="w-full h-full">
                <TravelCalculator
                  planet={activePlanet}
                  originCoord={originCoord}
                  destCoord={destCoord}
                  onSetOrigin={(lat, lon) => setOriginCoord({ lat, lon })}
                  onSetDest={(lat, lon) => setDestCoord({ lat, lon })}
                />
              </div>
            )}

            {activeTab === 'chronicle' && (
              <div className="w-full h-full">
                <CivilizationChronicle
                  planet={activePlanet}
                  onAddEvent={handleAddChronicleEvent}
                  onDeleteEvent={handleDeleteChronicleEvent}
                  onRequestAILore={handleGenerateAILore}
                  isGeneratingLore={isGeneratingLore}
                />
              </div>
            )}

            {activeTab === 'tectonics' && (
              <div className="w-full h-full">
                <TectonicsDeepTimePanel
                  planet={activePlanet}
                  onUpdateDeepTime={(ma) => {
                    handleUpdateActivePlanet((prev) => ({
                      ...prev,
                      deepTimeMa: ma,
                    }));
                  }}
                />
              </div>
            )}

            {activeTab === 'environment' && (
              <div className="w-full h-full">
                <EnvironmentalPanel
                  planet={activePlanet}
                  onSelectMineralForOverlay={(_mineral) => {
                    setOverlay('mineral_ores');
                    setActiveTab('flat_map');
                  }}
                />
              </div>
            )}
          </div>

          {/* 5. FLOATING BOTTOM TOOLBAR OVERLAY */}
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between pointer-events-none z-30">
            {/* Left helper text */}
            <div className="pointer-events-auto bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-400 flex items-center gap-2 shadow-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Move onto the map · click to inspect</span>
            </div>

            {/* Right Zoom & View Controls */}
            <div className="pointer-events-auto bg-black/80 backdrop-blur-md px-2 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5 text-xs text-slate-300 shadow-lg">
              <button
                onClick={handleGenerateAILore}
                className="px-2.5 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-900 transition-colors text-[11px]"
              >
                Lore
              </button>
              <button
                onClick={() => setActiveTab('flat_map')}
                className="px-2.5 py-1 rounded text-slate-300 hover:text-white hover:bg-slate-900 transition-colors text-[11px]"
              >
                Regional lens
              </button>
              <button
                onClick={() => setZoomScale(1.0)}
                className="px-2 py-1 rounded text-slate-400 hover:text-white hover:bg-slate-900 text-[11px]"
              >
                1:1
              </button>
              <button
                onClick={() => setZoomScale((z) => Math.max(0.5, z - 0.2))}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoomScale((z) => Math.min(2.5, z + 0.2))}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setShowLeftPanel(!showLeftPanel)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-900"
                title="Toggle Fullscreen Width"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </main>
      </div>

      {/* 6. PLANET PARAMETERS CUSTOMIZATION MODAL / SLIDE-OVER */}
      {showEditor && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex justify-end animate-in fade-in">
          <div className="w-full max-w-2xl bg-slate-950 border-l border-slate-800 h-full overflow-y-auto p-6 flex flex-col gap-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 font-bold text-white font-mono text-base">
                <Sliders className="w-5 h-5 text-amber-400" />
                <span>CUSTOMIZE PLANET PARAMETERS</span>
              </div>
              <button
                onClick={() => setShowEditor(false)}
                className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono font-bold"
              >
                Done
              </button>
            </div>

            <PlanetEditorPanel
              planet={activePlanet}
              onUpdatePlanet={handleUpdateActivePlanet}
              onLoadPreset={handleLoadPreset}
            />
          </div>
        </div>
      )}

      {/* 7. SCIENTIFIC REPORT DOSSIER MODAL */}
      {showExportModal && (
        <ReportExportModal
          planet={activePlanet}
          onClose={() => setShowExportModal(false)}
        />
      )}
    </div>
  );
}
