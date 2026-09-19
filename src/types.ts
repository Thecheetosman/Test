export type PlanetArchetype =
  | 'earth_like'
  | 'mars_like'
  | 'super_earth'
  | 'oceanic'
  | 'desert'
  | 'ice_world'
  | 'venusian'
  | 'barren_mercurian'
  | 'volcanic_io'
  | 'sub_neptune';

export type SpectralType = 'O' | 'B' | 'A' | 'F' | 'G' | 'K' | 'M' | 'Binary_G_M';

export interface StarSystemData {
  name: string;
  spectralType: SpectralType;
  massSolar: number; // M_sun
  luminositySolar: number; // L_sun
  radiusSolar: number; // R_sun
  effectiveTemperatureK: number; // K
  starColorHex: string;
  habitableZoneInnerAU: number;
  habitableZoneOuterAU: number;
  isBinary?: boolean;
  companionStar?: {
    name: string;
    spectralType: SpectralType;
    luminositySolar: number;
    colorHex: string;
  };
}

export interface MoonData {
  id: string;
  name: string;
  radiusEarth: number; // R_earth
  massEarth: number; // M_earth
  semiMajorAxisKm: number; // distance from planet center in km
  eccentricity: number;
  inclinationDeg: number;
  orbitalPeriodDays: number;
  isTidallyLocked: boolean;
  albedo: number;
  colorHex: string;
  hasAtmosphere: boolean;
}

export interface AtmosphericGas {
  name: string;
  symbol: string;
  percentage: number; // %
  greenhouseEffect: number; // relative warming coefficient
}

export interface AtmosphereData {
  surfacePressureAtm: number; // atm (1.0 = Earth)
  scaleHeightKm: number; // km
  gases: AtmosphericGas[];
  greenhouseFactorK: number; // extra warming in Kelvin
  skyColorHex: string; // Rayleigh scattering base color
  sunsetGlowHex: string;
  cloudCoveragePercent: number; // %
  hazeDensity: number; // 0 to 1
  breathableHuman: boolean;
  toxicityAlerts: string[];
}

export interface TectonicPlate {
  id: number;
  name: string;
  isOceanic: boolean;
  centerLat: number; // -90 to 90
  centerLon: number; // -180 to 180
  velocityMmYr: number; // mm per year (e.g. 20-80)
  headingDeg: number; // 0 to 360
  color: string;
}

export interface MineralDeposit {
  id: string;
  name: string;
  symbol: string;
  category: 'rare_earth' | 'platinum_group' | 'structural' | 'energy_fissile' | 'volatile' | 'exotic';
  crustalAbundancePpm: number; // parts per million
  economicValueTier: 'essential' | 'high' | 'strategic' | 'ultra_rare';
  geologicalOrigin: string;
  heatmapColor: string;
}

export interface CustomMonth {
  name: string;
  days: number;
}

export interface PlanetaryCalendarConfig {
  yearName: string;
  hoursPerDay: number;
  daysPerYear: number;
  months: CustomMonth[];
  weekdays: string[];
  currentYear: number;
  currentMonth: number;
  currentDay: number;
  currentHour: number;
}

export interface ChronicleEra {
  id: string;
  name: string;
  startYear: number;
  endYear: number;
  description: string;
}

export interface ChronicleEvent {
  id: string;
  year: number;
  planetDay?: number;
  eraId: string;
  title: string;
  category: 'astronomical' | 'sociopolitical' | 'technological' | 'ecological' | 'cataclysm';
  description: string;
  isEclipse?: boolean;
  eclipseType?: 'solar_total' | 'solar_annular' | 'lunar_total' | 'transit';
  involvedFactions?: string;
}

export interface TerrainModification {
  id: string;
  lat: number;
  lon: number;
  radiusDeg: number;
  intensity: number; // e.g. +0.4 for uplift, -0.4 for depression, etc.
  type: 'raise' | 'lower' | 'crater' | 'smooth';
  timestamp: number;
}

export interface PlanetData {
  id: string;
  name: string;
  seed: number;
  archetype: PlanetArchetype;
  description: string;

  // Physical Dimensions
  radiusEarth: number; // R_earth
  massEarth: number; // M_earth
  densityGcm3: number; // g/cm^3
  surfaceGravityG: number; // g (1.0 = Earth)
  escapeVelocityKms: number; // km/s
  magneticFieldGauss: number; // Earth is ~0.5 Gauss

  // Orbit & Rotation
  semiMajorAxisAU: number; // AU
  eccentricity: number;
  orbitalInclinationDeg: number;
  argumentOfPeriapsisDeg: number;
  orbitalPeriodDays: number; // Earth days
  axialTiltDeg: number; // Obliquity
  rotationPeriodHours: number; // Day length

  // Star & Moons
  star: StarSystemData;
  moons: MoonData[];

  // Atmosphere & Climate
  atmosphere: AtmosphereData;
  seaLevelPercent: number; // 0 - 95%
  albedo: number; // 0 to 1
  meanAnnualSurfaceTempC: number; // °C
  seasonalTempVarianceC: number; // +/- °C
  meanAnnualPrecipitationMm: number; // mm
  greenhouseGasPpm?: number; // CO2 equivalent ppm
  atmosphericHaze?: number; // Aerosol optical thickness (0-1)
  polarCapLatitudeDeg?: number; // Latitude where polar glaciation begins
  oceanSalinityPpt?: number; // Salinity in parts per thousand (0-80 ppt)
  floraPigmentType?: 'chlorophyll_green' | 'retinal_purple' | 'carotenoid_red' | 'melanin_black' | 'xanthophyll_gold';
  coriolisBeltCount?: number; // Atmospheric wind circulation bands (2-8)

  // Advanced Topography & Geomorphology
  mountainRoughness?: number; // Fractal Hurst exponent / ridge jaggedness (0.2 - 1.5)
  orogenyIntensity?: number; // Tectonic mountain uplift multiplier (0.2 - 3.0)
  erosionRate?: number; // Hydraulic & thermal weathering rate % (0 - 100)
  impactCraterDensity?: number; // Ancient meteorite impact crater density % (0 - 100)
  continentalShelfWidthKm?: number; // Neritic shallow continental shelf width (10 - 300 km)
  volcanicHotspots?: number; // Active mantle plume hotspots (0 - 50)
  terrainModifications?: TerrainModification[]; // Interactive user-sculpted modifications

  // Tectonics & Deep-Time
  plateCount: number;
  plates: TectonicPlate[];
  deepTimeMa: number; // -250 Ma to +250 Ma offset

  // Mineral & Resource Endowments
  minerals: MineralDeposit[];

  // Calendar & Civilizations
  isHabitable: boolean;
  calendar: PlanetaryCalendarConfig;
  eras: ChronicleEra[];
  chronicle: ChronicleEvent[];

  // Custom UI & Metadata
  lastModified: number;
}

export type MapOverlayType =
  | 'heightmap'
  | 'physical'
  | 'relief'
  | 'satellite'
  | 'biomes'
  | 'drainage'
  | 'temperature_annual'
  | 'temperature_seasonal'
  | 'temperature_range'
  | 'precipitation'
  | 'aridity'
  | 'solar_radiation'
  | 'tectonics'
  | 'settlement_suitability'
  | 'mineral_ores';

export type MapStyleType =
  | 'satellite'
  | 'classic_atlas'
  | 'tactical_hud'
  | 'topographic_survey'
  | 'thermal_ir'
  | 'blueprint'
  | 'vintage_parchment';

export type MapProjectionType =
  | 'equirectangular'
  | 'robinson'
  | 'mercator'
  | 'mollweide';

export interface TravelWaypoint {
  name: string;
  lat: number;
  lon: number;
}

export type SurfaceTravelMode = 'suborbital_rocket' | 'hypersonic_craft' | 'vactrain_maglev' | 'ground_rover' | 'ocean_vessel';

export interface InterplanetaryDestination {
  id: string;
  name: string;
  distanceAU: number;
  distanceLightYears?: number;
  systemName: string;
}
