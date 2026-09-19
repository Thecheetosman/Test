import React from 'react';
import { MapOverlayType, MapStyleType, MapProjectionType } from '../types';
import { Sliders, Sparkles, ChevronDown, Download, Check, Eye } from 'lucide-react';

export type GeneratedViewCategory =
  | 'terrain_geology'
  | 'climate_seasons'
  | 'water_atmosphere'
  | 'life_settlement'
  | 'cartography'
  | 'atlas_plates';

export interface SubViewConfig {
  id: string;
  name: string;
  category: GeneratedViewCategory;
  description: string;
  overlay?: MapOverlayType;
  style?: MapStyleType;
  projection?: MapProjectionType;
  isSpecial?: 'four_globe_sheet' | 'sculpt_terrain';
}

export const SUB_VIEWS: SubViewConfig[] = [
  // Terrain & geology
  {
    id: 'physical_relief',
    name: 'Physical relief',
    category: 'terrain_geology',
    description: 'Hypsometric elevation, shaded relief, rivers, lakes, and coastlines.',
    overlay: 'physical',
    style: 'classic_atlas',
  },
  {
    id: 'four_globe_sheet',
    name: 'Four globe views SHEET',
    category: 'terrain_geology',
    description: 'Quad-orthographic hemispheric projection sheet with real-time stellar shadow masks.',
    isSpecial: 'four_globe_sheet',
  },
  {
    id: 'tectonic_plates',
    name: 'Tectonic plates',
    category: 'terrain_geology',
    description: 'Crustal boundary faults, convergent subduction zones, and divergent rift valleys.',
    overlay: 'tectonics',
    style: 'tactical_hud',
  },
  {
    id: 'soils',
    name: 'Soils & Regolith',
    category: 'terrain_geology',
    description: 'Pedological horizons, sediment accumulation, and weathered topsoil depth.',
    overlay: 'biomes',
    style: 'classic_atlas',
  },
  {
    id: 'bedrock',
    name: 'Bedrock & Basal Geology',
    category: 'terrain_geology',
    description: 'Crystalline cratonic basement, basaltic volcanic flows, and sedimentary basins.',
    overlay: 'heightmap',
    style: 'classic_atlas',
  },
  {
    id: 'glacial_legacy',
    name: 'Glacial legacy',
    category: 'terrain_geology',
    description: 'Pleistocene-analog moraines, kettle basins, and polar ice sheets.',
    overlay: 'physical',
    style: 'satellite',
  },
  {
    id: 'resource_prospectivity',
    name: 'Resource prospectivity',
    category: 'terrain_geology',
    description: 'Stratigraphic deposit locations for rare minerals, fission fuel, and industrial ores.',
    overlay: 'mineral_ores',
    style: 'tactical_hud',
  },

  // Climate & seasons
  {
    id: 'mast_temp',
    name: 'Annual Temperature (MAST)',
    category: 'climate_seasons',
    description: 'Mean annual surface temperature model driven by solar insolation and greenhouse lapse.',
    overlay: 'temperature_annual',
    style: 'classic_atlas',
  },
  {
    id: 'seasonal_range',
    name: 'Seasonal Thermal Range',
    category: 'climate_seasons',
    description: 'Peak seasonal thermal extremes governed by orbital eccentricity and axial obliquity.',
    overlay: 'temperature_range',
    style: 'classic_atlas',
  },
  {
    id: 'precipitation_map',
    name: 'Precipitation & Rainfall',
    category: 'climate_seasons',
    description: 'Global mean annual rainfall (MAP), convective ITCZ cells, and orographic rain shadows.',
    overlay: 'precipitation',
    style: 'classic_atlas',
  },
  {
    id: 'insolation',
    name: 'Solar Radiation & Insolation',
    category: 'climate_seasons',
    description: 'Top-of-atmosphere solar flux per latitude band across orbital apastron and periastron.',
    overlay: 'solar_radiation',
    style: 'classic_atlas',
  },
  {
    id: 'aridity_index',
    name: 'Aridity & Evapotranspiration',
    category: 'climate_seasons',
    description: 'Moisture deficit, potential evapotranspiration, and desertification frontiers.',
    overlay: 'aridity',
    style: 'classic_atlas',
  },
  {
    id: 'koppen_zones',
    name: 'Seasonal Temp Extrema',
    category: 'climate_seasons',
    description: 'Solstice temperature extremes across boreal and austral hemispheres.',
    overlay: 'temperature_seasonal',
    style: 'classic_atlas',
  },

  // Water & atmosphere
  {
    id: 'drainage_basins',
    name: 'Drainage Basins & Hydrology',
    category: 'water_atmosphere',
    description: 'Stream order networks, catchment divides, endorheic lakes, and fluvial deltas.',
    overlay: 'drainage',
    style: 'classic_atlas',
  },
  {
    id: 'true_satellite',
    name: 'True Satellite Photorealism',
    category: 'water_atmosphere',
    description: 'Sub-pixel Rayleigh scattering, optical water specular reflectance, and cloud cover.',
    overlay: 'satellite',
    style: 'satellite',
  },
  {
    id: 'digital_elevation',
    name: 'Digital Elevation Model (DEM)',
    category: 'water_atmosphere',
    description: 'Calibrated hypsometric heightmap contour grid with bathymetric trenches.',
    overlay: 'heightmap',
    style: 'classic_atlas',
  },
  {
    id: 'cloud_albedo',
    name: 'Atmospheric Envelope & Sky',
    category: 'water_atmosphere',
    description: 'Atmospheric optical depth, Rayleigh tint, and greenhouse vapor pressure.',
    overlay: 'physical',
    style: 'satellite',
  },

  // Life & settlement
  {
    id: 'settlement_suitability',
    name: 'Settlement Suitability Index',
    category: 'life_settlement',
    description: 'Multifactor habitability composite: fresh water access, temperature, and slope.',
    overlay: 'settlement_suitability',
    style: 'tactical_hud',
  },
  {
    id: 'ecological_biomes',
    name: 'Ecological Biomes',
    category: 'life_settlement',
    description: 'Whittaker eco-climatic biome taxonomy adapted for alien planetary conditions.',
    overlay: 'biomes',
    style: 'classic_atlas',
  },
  {
    id: 'night_civilization_lights',
    name: 'Night Lights & Megastructures',
    category: 'life_settlement',
    description: 'Nocturnal emissions from metropolitan agglomerations and orbital tether anchors.',
    overlay: 'satellite',
    style: 'tactical_hud',
  },

  // Cartography
  {
    id: 'equirectangular',
    name: 'Equirectangular Map',
    category: 'cartography',
    description: 'Standard cylindrical equidistant projection (Plate Carrée 2:1 aspect ratio).',
    overlay: 'physical',
    style: 'classic_atlas',
    projection: 'equirectangular',
  },
  {
    id: 'mollweide',
    name: 'Mollweide Equal-Area',
    category: 'cartography',
    description: 'Pseudocylindrical equal-area projection ideal for global thematic distribution.',
    overlay: 'physical',
    style: 'classic_atlas',
    projection: 'mollweide',
  },
  {
    id: 'winkel_tripel',
    name: 'Winkel Tripel Projection',
    category: 'cartography',
    description: 'National Geographic standard projection minimizing area, direction, and distance distortion.',
    overlay: 'physical',
    style: 'classic_atlas',
    projection: 'robinson',
  },
  {
    id: 'tactical_hud_carto',
    name: 'Tactical Sci-Fi HUD',
    category: 'cartography',
    description: 'Vector military graticule overlay with coordinate telemetry.',
    overlay: 'physical',
    style: 'tactical_hud',
  },
  {
    id: 'topographic_survey',
    name: 'Topographic Survey Contours',
    category: 'cartography',
    description: 'High-contrast topographic isobaths and hypsometric elevation banding.',
    overlay: 'relief',
    style: 'topographic_survey',
  },
];

interface AtlasGeneratedViewsBarProps {
  activeCategory: GeneratedViewCategory;
  onSelectCategory: (cat: GeneratedViewCategory) => void;
  activeSubViewId: string;
  onSelectSubView: (view: SubViewConfig) => void;
  onToggleSculpt: () => void;
  isSculptActive: boolean;
}

export const AtlasGeneratedViewsBar: React.FC<AtlasGeneratedViewsBarProps> = ({
  activeCategory,
  onSelectCategory,
  activeSubViewId,
  onSelectSubView,
  onToggleSculpt,
  isSculptActive,
}) => {
  const categories: { id: GeneratedViewCategory; label: string; count: number }[] = [
    { id: 'terrain_geology', label: 'Terrain & geology', count: 7 },
    { id: 'climate_seasons', label: 'Climate & seasons', count: 6 },
    { id: 'water_atmosphere', label: 'Water & atmosphere', count: 11 },
    { id: 'life_settlement', label: 'Life & settlement', count: 4 },
    { id: 'cartography', label: 'Cartography', count: 7 },
    { id: 'atlas_plates', label: 'Atlas plates', count: 12 },
  ];

  const currentSubViews = SUB_VIEWS.filter((v) => v.category === activeCategory);
  const activeSubView = SUB_VIEWS.find((v) => v.id === activeSubViewId) || SUB_VIEWS[0];

  return (
    <div className="w-full bg-black border-b border-slate-800/90 text-slate-200 font-mono px-4 py-2.5 space-y-2 select-none">
      {/* Title & Description Header */}
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-amber-400 font-bold tracking-wider text-xs uppercase">
          GENERATED VIEWS
        </span>
        <span className="text-white font-bold text-xs uppercase tracking-wider">
          {activeSubView.name}
        </span>
        <span className="text-slate-400 text-xs truncate max-w-2xl">
          {activeSubView.description}
        </span>
      </div>

      {/* Main Categories Pills (Selectable, exactly like screenshot!) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {categories.map((cat) => {
          const isSelected = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                onSelectCategory(cat.id);
                const first = SUB_VIEWS.find((v) => v.category === cat.id);
                if (first) onSelectSubView(first);
              }}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap text-xs transition-all flex items-center gap-1.5 border ${
                isSelected
                  ? 'bg-slate-900 border-slate-700 text-white font-bold shadow-md'
                  : 'bg-black border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
              }`}
            >
              <span>{cat.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] ${
                  isSelected ? 'bg-amber-950 text-amber-300 font-bold' : 'text-slate-500'
                }`}
              >
                {cat.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Sub-Views Secondary Pills Row */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          {currentSubViews.map((sub) => {
            const isSubActive = activeSubViewId === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => onSelectSubView(sub)}
                className={`px-2.5 py-1 rounded-md text-[11px] whitespace-nowrap transition-all border ${
                  isSubActive
                    ? 'bg-amber-950/70 border-amber-500/60 text-amber-300 font-bold shadow-sm'
                    : 'bg-slate-950/80 border-slate-850 text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                {sub.name}
              </button>
            );
          })}
        </div>

        {/* Sculpt Terrain Action Dropdown/Button */}
        <button
          onClick={onToggleSculpt}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
            isSculptActive
              ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 shadow-md'
              : 'bg-slate-900 border-slate-750 text-slate-300 hover:bg-slate-850'
          }`}
        >
          <span>Sculpt terrain</span>
          <ChevronDown className="w-3 h-3 text-slate-400" />
        </button>
      </div>
    </div>
  );
};
