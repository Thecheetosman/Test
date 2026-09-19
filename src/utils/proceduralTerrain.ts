import { PlanetData, MapOverlayType, MapStyleType, TectonicPlate, MineralDeposit } from '../types';

// Fast deterministic PRNG based on Mulberry32
export function createPRNG(seed: number) {
  let s = Math.floor(seed) >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 3D Simplex-like Noise generator for seamless spherical coordinates
class SimplexNoise3D {
  private perm: Uint8Array = new Uint8Array(512);

  constructor(seed: number) {
    const prng = createPRNG(seed);
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    for (let i = 255; i > 0; i--) {
      const r = Math.floor(prng() * (i + 1));
      const temp = p[i];
      p[i] = p[r];
      p[r] = temp;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
  }

  public noise(x: number, y: number, z: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    const fx = x - Math.floor(x);
    const fy = y - Math.floor(y);
    const fz = z - Math.floor(z);

    const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
    const v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
    const w = fz * fz * fz * (fz * (fz * 6 - 15) + 10);

    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;

    const grad = (hash: number, x: number, y: number, z: number) => {
      const h = hash & 15;
      const u = h < 8 ? x : y;
      const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
      return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
    };

    const res =
      (1 - w) *
        ((1 - v) *
          ((1 - u) * grad(this.perm[AA], fx, fy, fz) +
            u * grad(this.perm[BA], fx - 1, fy, fz)) +
          v *
            ((1 - u) * grad(this.perm[AB], fx, fy - 1, fz) +
              u * grad(this.perm[BB], fx - 1, fy - 1, fz))) +
      w *
        ((1 - v) *
          ((1 - u) * grad(this.perm[AA + 1], fx, fy, fz - 1) +
            u * grad(this.perm[BA + 1], fx - 1, fy, fz - 1)) +
          v *
            ((1 - u) * grad(this.perm[AB + 1], fx, fy - 1, fz - 1) +
              u * grad(this.perm[BB + 1], fx - 1, fy - 1, fz - 1)));

    return res;
  }

  public fbm(x: number, y: number, z: number, octaves = 6, persistence = 0.5, lacunarity = 2.0): number {
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }
}

// Terrain Cache singleton to avoid recomputing on every render frame
export interface SamplePoint {
  lat: number;
  lon: number;
  elevation: number; // -1.0 to 1.0 (0 is base sea level)
  rawElevation: number; // raw elevation before sea level threshold
  isWater: boolean;
  depthOrHeightM: number;
  plateId: number;
  temperatureC: number;
  seasonalTempMinC: number;
  seasonalTempMaxC: number;
  seasonalRangeC: number;
  precipitationMm: number;
  aridityIndex: number;
  solarFluxWm2: number;
  settlementSuitability: number; // 0 - 100
  dominantOre: MineralDeposit | null;
  oreEnrichmentFactor: number;
  biome: string;
  hasRiver: boolean;
  slope: number; // 0 to 1
  hillshade: number; // 0.2 to 1.4 sun illumination factor
  isContinentalShelf: boolean;
}

export class PlanetTerrainEngine {
  private planet: PlanetData;
  private noiseGenerator: SimplexNoise3D;
  private riverNoise: SimplexNoise3D;

  constructor(planet: PlanetData) {
    this.planet = planet;
    this.noiseGenerator = new SimplexNoise3D(planet.seed);
    this.riverNoise = new SimplexNoise3D(planet.seed + 9999);
  }

  public updatePlanet(planet: PlanetData) {
    this.planet = planet;
    this.noiseGenerator = new SimplexNoise3D(planet.seed);
    this.riverNoise = new SimplexNoise3D(planet.seed + 9999);
  }

  // Convert lat/long in degrees to unit 3D sphere coordinate
  private latLonToSphere(latDeg: number, lonDeg: number): { x: number; y: number; z: number } {
    const latRad = (latDeg * Math.PI) / 180;
    const lonRad = (lonDeg * Math.PI) / 180;
    return {
      x: Math.cos(latRad) * Math.cos(lonRad),
      y: Math.cos(latRad) * Math.sin(lonRad),
      z: Math.sin(latRad),
    };
  }

  // Find nearest tectonic plate, accounting for deep-time drift
  public getPlateAt(lat: number, lon: number): { plate: TectonicPlate; distDeg: number } {
    const plates = this.planet.plates;
    if (!plates || plates.length === 0) {
      return {
        plate: {
          id: 0,
          name: 'Primary Plate',
          isOceanic: false,
          centerLat: 0,
          centerLon: 0,
          velocityMmYr: 30,
          headingDeg: 45,
          color: '#3b82f6',
        },
        distDeg: 0,
      };
    }

    const dtMa = this.planet.deepTimeMa || 0;
    let closestPlate = plates[0];
    let minDist = 999999;

    for (const p of plates) {
      // Plate drift over deep time: 1 mm/yr = 1 km per Ma
      // 1 degree on earth is ~111 km
      const driftKm = (p.velocityMmYr * dtMa);
      const driftDeg = driftKm / (111 * Math.max(0.2, this.planet.radiusEarth));
      const radHeading = (p.headingDeg * Math.PI) / 180;

      const shiftedLat = Math.max(-85, Math.min(85, p.centerLat + Math.cos(radHeading) * driftDeg));
      const shiftedLon = ((p.centerLon + Math.sin(radHeading) * driftDeg + 180) % 360) - 180;

      const dLat = lat - shiftedLat;
      const dLon = Math.abs(lon - shiftedLon);
      const dLonWrapped = dLon > 180 ? 360 - dLon : dLon;
      const dist = Math.sqrt(dLat * dLat + dLonWrapped * dLonWrapped);

      if (dist < minDist) {
        minDist = dist;
        closestPlate = p;
      }
    }

    return { plate: closestPlate, distDeg: minDist };
  }

  // Compute raw elevation at any coordinate before sea level cutoff
  public getRawElevationAt(lat: number, lon: number): number {
    const { x, y, z } = this.latLonToSphere(lat, lon);
    const { plate, distDeg } = this.getPlateAt(lat, lon);

    // 1. Fractal roughness and octaves
    const roughness = this.planet.mountainRoughness ?? 0.7;
    const persistence = 0.45 + (roughness - 0.7) * 0.15;
    const baseElevation = this.noiseGenerator.fbm(x * 1.5, y * 1.5, z * 1.5, 6, persistence, 2.05);

    // 2. Mountain Ridges (Voronoi/billow style)
    const mountainRidges = Math.pow(Math.abs(this.noiseGenerator.fbm(x * 3.2, y * 3.2, z * 3.2, 4, 0.5, 2.1)), 1.4);

    // 3. Plate Tectonic boundary orogeny & trenches
    const boundaryProximity = Math.exp(-distDeg / 8.0);
    const orogenyScale = this.planet.orogenyIntensity ?? 1.0;
    const boundaryOrogeny = (plate.isOceanic ? -boundaryProximity * 0.55 : boundaryProximity * 0.65) * orogenyScale;

    let rawElevation = baseElevation + boundaryOrogeny + (mountainRidges * 0.35 * orogenyScale);

    // 4. Ancient impact crater field
    const craterDensity = (this.planet.impactCraterDensity ?? 15) / 100;
    if (craterDensity > 0.02) {
      const craterNoise = this.noiseGenerator.noise(x * 6.5, y * 6.5, z * 6.5);
      if (craterNoise > 0.65 - craterDensity * 0.25) {
        const distToCenter = (craterNoise - 0.65) * 4;
        const rim = Math.sin(distToCenter * Math.PI * 2) * 0.14 * craterDensity;
        rawElevation += rim;
      }
    }

    // 5. Volcanic mantle hotspots
    const hotspotsCount = this.planet.volcanicHotspots ?? 6;
    if (hotspotsCount > 0) {
      const spotNoise = this.noiseGenerator.noise(x * 4.0, y * 4.0, z * 4.0);
      if (spotNoise > 0.82) {
        rawElevation += Math.pow((spotNoise - 0.82) / 0.18, 2) * 0.4;
      }
    }

    // 6. Hydraulic & thermal weathering / erosion
    const erosion = (this.planet.erosionRate ?? 35) / 100;
    if (erosion > 0.1 && rawElevation > 0) {
      rawElevation -= Math.pow(rawElevation, 1.8) * 0.18 * erosion;
    }

    // 7. Interactive user sculpted modifications (drag & sculpt tools)
    if (this.planet.terrainModifications && this.planet.terrainModifications.length > 0) {
      for (const mod of this.planet.terrainModifications) {
        const dLat = lat - mod.lat;
        let dLon = Math.abs(lon - mod.lon);
        if (dLon > 180) dLon = 360 - dLon;
        const distDeg = Math.sqrt(dLat * dLat + dLon * dLon);
        if (distDeg < mod.radiusDeg) {
          const t = distDeg / mod.radiusDeg;
          const factor = Math.cos(t * (Math.PI / 2));
          if (mod.type === 'raise') {
            rawElevation += mod.intensity * factor;
          } else if (mod.type === 'lower') {
            rawElevation -= mod.intensity * factor;
          } else if (mod.type === 'crater') {
            // Circular crater with central rebound peak & raised lip
            const rim = Math.sin(t * Math.PI * 2) * mod.intensity * 0.6;
            const basin = (1 - t * t) * -mod.intensity * 0.8;
            rawElevation += (basin + rim);
          } else if (mod.type === 'smooth') {
            const seaLevelThreshold = (this.planet.seaLevelPercent / 100) * 1.6 - 0.8;
            rawElevation = rawElevation * (1 - factor * 0.6) + seaLevelThreshold * (factor * 0.6);
          }
        }
      }
    }

    // 8. Archetype modifier
    switch (this.planet.archetype) {
      case 'mars_like': rawElevation = rawElevation * 1.3 - 0.15; break;
      case 'oceanic': rawElevation = rawElevation * 0.7 - 0.35; break;
      case 'desert': rawElevation = rawElevation * 0.9; break;
      case 'ice_world': rawElevation = rawElevation * 0.85; break;
      case 'super_earth': rawElevation = rawElevation * 1.15; break;
      case 'barren_mercurian': rawElevation = rawElevation * 1.25; break;
      case 'venusian': rawElevation = rawElevation * 0.8; break;
    }

    return rawElevation;
  }

  // Sample environmental and geological parameters at any (lat, lon)
  public sample(lat: number, lon: number): SamplePoint {
    const { x, y, z } = this.latLonToSphere(lat, lon);
    const { plate, distDeg } = this.getPlateAt(lat, lon);

    // Calculate raw elevation based on full heightmap engine
    const rawElevation = this.getRawElevationAt(lat, lon);

    // Normalized sea level threshold (-1 to 1) strictly following heightmap
    const seaLevelThreshold = (this.planet.seaLevelPercent / 100) * 1.6 - 0.8;
    const isWater = rawElevation < seaLevelThreshold;

    // Fast surface gradient estimation for 3D hillshading and realistic terrain normal
    const deltaDeg = 0.55;
    const eEast = this.getRawElevationAt(lat, lon + deltaDeg);
    const eWest = this.getRawElevationAt(lat, lon - deltaDeg);
    const eNorth = this.getRawElevationAt(lat + deltaDeg, lon);
    const eSouth = this.getRawElevationAt(lat - deltaDeg, lon);
    const dX = (eEast - eWest) * 3.8;
    const dY = (eNorth - eSouth) * 3.8;
    const slope = Math.min(1.0, Math.sqrt(dX * dX + dY * dY));

    // Solar illumination vector (from azimuth 315 deg, elevation 45 deg)
    const lSunX = -0.577;
    const lSunY = 0.577;
    const lSunZ = 0.577;
    const nLen = Math.sqrt(dX * dX + dY * dY + 1.0);
    const normX = -dX / nLen;
    const normY = -dY / nLen;
    const normZ = 1.0 / nLen;
    const hillshade = Math.max(0.25, Math.min(1.45, normX * lSunX + normY * lSunY + normZ * lSunZ + 0.35));

    // Continental shelf calculation
    const shelfWidthKm = this.planet.continentalShelfWidthKm ?? 80;
    const shelfThreshold = seaLevelThreshold - 0.075 * (shelfWidthKm / 80);
    const isContinentalShelf = isWater && rawElevation > shelfThreshold;

    const maxMountainHeightM = 8848 * Math.pow(this.planet.radiusEarth, 0.8) / Math.max(0.5, this.planet.surfaceGravityG);
    const maxOceanDepthM = 11000 * Math.pow(this.planet.radiusEarth, 0.5);

    let depthOrHeightM = 0;
    if (isWater) {
      if (isContinentalShelf) {
        const normShelf = (seaLevelThreshold - rawElevation) / Math.max(0.001, seaLevelThreshold - shelfThreshold);
        depthOrHeightM = -Math.round(15 + normShelf * 185); // 15m to 200m depth
      } else {
        const normAbyssal = (shelfThreshold - rawElevation) / Math.max(0.001, shelfThreshold + 1.01);
        depthOrHeightM = -Math.round(200 + Math.max(0, normAbyssal) * (maxOceanDepthM - 200));
      }
    } else {
      const normalizedHeight = (rawElevation - seaLevelThreshold) / Math.max(0.001, 1.01 - seaLevelThreshold);
      depthOrHeightM = Math.round(normalizedHeight * maxMountainHeightM);
    }

    // Temperature Calculation:
    // MAST: Base planet temp modulated by latitude, elevation lapse rate (-6.5°C/km), and marine moderating effect
    const latAbs = Math.abs(lat);
    const equatorPoleDrop = 48 * (1 - Math.cos((latAbs * Math.PI) / 180));
    const lapseRateCooling = (!isWater ? (depthOrHeightM / 1000) * 6.5 : 0);
    const oceanBuffering = isWater ? 4.0 : 0.0;
    const mastC = this.planet.meanAnnualSurfaceTempC - equatorPoleDrop - lapseRateCooling + oceanBuffering;

    // Seasonal extremes: influenced by axial tilt and orbital eccentricity
    const axialTiltEffect = (this.planet.axialTiltDeg / 23.5) * (lat / 90) * 18;
    const eccentricityEffect = this.planet.eccentricity * 12;
    const seasonalRangeC = Math.abs(axialTiltEffect) + eccentricityEffect + (isWater ? 4 : 16);
    const seasonalTempMinC = Number((mastC - seasonalRangeC / 2).toFixed(1));
    const seasonalTempMaxC = Number((mastC + seasonalRangeC / 2).toFixed(1));

    // Solar Radiation Exposure (W/m^2)
    const baseInsolation = (1361 * this.planet.star.luminositySolar) / Math.pow(this.planet.semiMajorAxisAU, 2);
    const solarFluxWm2 = Math.max(0, Math.round(baseInsolation * Math.cos((latAbs * Math.PI) / 180)));

    // Precipitation (MAP in mm):
    // ITCZ (equatorial updraft), Subtropical arid belt (25-35 deg), Mid-latitude storm track (45-60 deg)
    const itczPeak = Math.exp(-Math.pow(latAbs / 12, 2)) * 1600;
    const midLatPeak = Math.exp(-Math.pow((latAbs - 50) / 15, 2)) * 950;
    const rainShadow = !isWater && slope > 0.4 ? -350 : 0;
    const waterProximity = isWater ? 300 : (isContinentalShelf ? 150 : 0);
    const precipitationMm = Math.max(
      15,
      Math.round(
        (this.planet.meanAnnualPrecipitationMm / 900) * (itczPeak + midLatPeak + rainShadow + waterProximity)
      )
    );

    // Aridity Index (De Martonne: I = P / (T + 10))
    const safeTemp = Math.max(-9, mastC);
    const aridityIndex = Number((precipitationMm / (safeTemp + 10)).toFixed(1));

    // River Network Detection (endorheic basins and dendritic rivers flowing toward sea)
    let hasRiver = false;
    if (!isWater && this.planet.seaLevelPercent > 10) {
      const riverVal = Math.abs(this.riverNoise.fbm(x * 8.0, y * 8.0, z * 8.0, 3));
      if (riverVal < 0.045 && depthOrHeightM < 2500 && precipitationMm > 250) {
        hasRiver = true;
      }
    }

    // Settlement Suitability (0 - 100)
    let suitability = 50;
    // Thermal comfort: ideal 10 - 24°C
    if (mastC >= 10 && mastC <= 24) suitability += 20;
    else if (mastC < -10 || mastC > 45) suitability -= 30;
    // Atmosphere breathable
    if (this.planet.atmosphere.breathableHuman) suitability += 20;
    else suitability -= 20;
    // Water proximity
    if (isWater) suitability = 0;
    else if (distDeg < 18 || hasRiver) suitability += 15;
    // Slope / Extreme mountains
    if (depthOrHeightM > 4000) suitability -= 25;
    suitability = Math.max(0, Math.min(100, Math.round(suitability)));

    // Ore deposits & Mineral heat mapping
    let dominantOre: MineralDeposit | null = null;
    let oreEnrichmentFactor = 1.0;

    if (this.planet.minerals && this.planet.minerals.length > 0) {
      // Different minerals enrich in different geodynamic environments
      // Ores 0: Rare Earths (volcanic rift arcs)
      // Ores 1: Platinum Group (impact craters / deep mantle upwellings)
      // Ores 2: Structural (continental shield)
      // Ores 3: Fissiles (ancient granite cratons)
      const mineralIndex = Math.floor(Math.abs(this.noiseGenerator.noise(x * 5, y * 5, z * 5)) * this.planet.minerals.length) % this.planet.minerals.length;
      dominantOre = this.planet.minerals[mineralIndex] || this.planet.minerals[0];

      const oreNoise = Math.abs(this.noiseGenerator.fbm(x * 12 + mineralIndex, y * 12, z * 12, 3));
      oreEnrichmentFactor = Number((1.0 + oreNoise * 4.5).toFixed(2));
    }

    // Biome determination
    let biome = 'Barren Regolith';
    if (isWater) {
      if (depthOrHeightM < -4000) biome = 'Abyssal Trench';
      else if (depthOrHeightM < -1500) biome = 'Pelagic Ocean';
      else biome = 'Shallow Continental Shelf';
    } else {
      if (mastC < -12) {
        biome = latAbs > 65 ? 'Polar Ice Cap' : 'Cryo-Tundra';
      } else if (mastC < 5) {
        biome = precipitationMm > 400 ? 'Boreal Conifer Forest' : 'Steppe & Tundra';
      } else if (mastC < 22) {
        if (aridityIndex < 15) biome = 'Temperate Desert & Scrub';
        else if (precipitationMm > 1200) biome = 'Temperate Rainforest';
        else biome = 'Temperate Grassland / Woodland';
      } else {
        if (aridityIndex < 10) biome = 'Hyper-Arid Erg Desert';
        else if (precipitationMm > 1500) biome = 'Tropical Rainforest';
        else if (precipitationMm > 700) biome = 'Savanna & Shrubland';
        else biome = 'Semi-Arid Scrubland';
      }

      if (this.planet.archetype === 'mars_like') biome = 'Iron Oxide Regolith & Dune';
      if (this.planet.archetype === 'venusian') biome = 'Supercritical Basaltic Plain';
      if (this.planet.archetype === 'volcanic_io') biome = 'Sulfur Caldera & Basalt Flow';
      if (this.planet.archetype === 'barren_mercurian') biome = 'Impact Maria & Shock Regolith';
    }

    return {
      lat,
      lon,
      elevation: rawElevation,
      rawElevation,
      isWater,
      depthOrHeightM,
      plateId: plate.id,
      temperatureC: Number(mastC.toFixed(1)),
      seasonalTempMinC,
      seasonalTempMaxC,
      seasonalRangeC: Number(seasonalRangeC.toFixed(1)),
      precipitationMm,
      aridityIndex,
      solarFluxWm2,
      settlementSuitability: suitability,
      dominantOre,
      oreEnrichmentFactor,
      biome,
      hasRiver,
      slope,
      hillshade,
      isContinentalShelf,
    };
  }
}

// Color palette mapping based on chosen overlay and style
export function getPixelColor(
  sample: SamplePoint,
  overlay: MapOverlayType,
  style: MapStyleType,
  planet?: PlanetData
): [number, number, number, number] {
  // 1. Overlay Overrides
  switch (overlay) {
    case 'heightmap': {
      // High-precision Digital Elevation Model (DEM) with hypsometric bathymetry and topography
      if (sample.isWater) {
        const depthNorm = Math.min(1, Math.abs(sample.depthOrHeightM) / 9000);
        return colorRamp(depthNorm, [
          [0.0, [68, 220, 248]], // Neritic continental shelf cyan
          [0.15, [24, 150, 205]], // Shelf break & slope
          [0.45, [12, 70, 148]], // Pelagic abyssal basin
          [0.75, [8, 30, 96]], // Deep ocean plain
          [1.0, [3, 10, 48]], // Hadal trench deep violet-navy
        ]);
      } else {
        const heightNorm = Math.min(1, sample.depthOrHeightM / 7800);
        // Subtle 500m contour intervals
        const isContour = (sample.depthOrHeightM % 500) < 30 && sample.depthOrHeightM > 80;
        const baseColor = colorRamp(heightNorm, [
          [0.0, [38, 175, 80]], // Coastal lowlands green
          [0.15, [115, 195, 48]], // Low plains
          [0.35, [212, 198, 45]], // Upland plateaus
          [0.55, [228, 138, 25]], // Cordillera foothills
          [0.72, [172, 74, 20]], // High alpine brown
          [0.85, [118, 102, 100]], // Rocky slate crags
          [1.0, [252, 252, 255]], // Glaciated summit snow
        ]);
        if (isContour) {
          return [
            Math.max(0, baseColor[0] - 45),
            Math.max(0, baseColor[1] - 45),
            Math.max(0, baseColor[2] - 45),
            255,
          ];
        }
        return baseColor;
      }
    }

    case 'temperature_annual':
    case 'temperature_seasonal': {
      const temp = overlay === 'temperature_seasonal' ? sample.seasonalTempMaxC : sample.temperatureC;
      // Range: -50°C (deep purple/blue) to +50°C (fiery red/white)
      const tNorm = Math.max(0, Math.min(1, (temp + 50) / 100));
      return colorRamp(tNorm, [
        [0.0, [24, 16, 75]], // -50C
        [0.2, [41, 98, 255]], // -30C
        [0.4, [34, 211, 238]], // -10C
        [0.55, [74, 222, 128]], // +5C
        [0.7, [250, 204, 21]], // +20C
        [0.85, [249, 115, 22]], // +35C
        [1.0, [239, 68, 68]], // +50C
      ]);
    }

    case 'temperature_range': {
      // Range 0 to 45°C swing
      const rNorm = Math.max(0, Math.min(1, sample.seasonalRangeC / 45));
      return colorRamp(rNorm, [
        [0.0, [59, 130, 246]], // Oceanic stable
        [0.3, [16, 185, 129]],
        [0.6, [245, 158, 11]],
        [1.0, [220, 38, 38]], // Extreme continental swing
      ]);
    }

    case 'precipitation': {
      // 0 to 2500 mm
      const pNorm = Math.max(0, Math.min(1, sample.precipitationMm / 2200));
      return colorRamp(pNorm, [
        [0.0, [245, 230, 190]], // Arid bone
        [0.2, [217, 249, 157]],
        [0.4, [52, 211, 153]],
        [0.7, [14, 165, 233]],
        [1.0, [30, 58, 138]], // Monsoon deep blue
      ]);
    }

    case 'aridity': {
      // 0 to 60 index
      const aNorm = Math.max(0, Math.min(1, sample.aridityIndex / 50));
      return colorRamp(aNorm, [
        [0.0, [239, 68, 68]], // Hyper-arid red
        [0.2, [249, 115, 22]], // Arid orange
        [0.4, [234, 179, 8]], // Semi-arid yellow
        [0.7, [34, 197, 94]], // Humid green
        [1.0, [59, 130, 246]], // Per-humid blue
      ]);
    }

    case 'solar_radiation': {
      // 0 to 1800 W/m^2
      const sNorm = Math.max(0, Math.min(1, sample.solarFluxWm2 / 1600));
      return colorRamp(sNorm, [
        [0.0, [15, 23, 42]],
        [0.25, [79, 70, 229]],
        [0.55, [234, 88, 12]],
        [0.85, [250, 204, 21]],
        [1.0, [255, 255, 255]],
      ]);
    }

    case 'settlement_suitability': {
      const suitNorm = sample.settlementSuitability / 100;
      if (sample.isWater) return [12, 35, 64, 255];
      return colorRamp(suitNorm, [
        [0.0, [75, 85, 99]], // Inhospitable gray/red
        [0.3, [239, 68, 68]],
        [0.6, [234, 179, 8]],
        [0.8, [34, 197, 94]],
        [1.0, [6, 182, 212]], // Prime colony zone cyan
      ]);
    }

    case 'mineral_ores': {
      if (sample.isWater) return [15, 23, 42, 255];
      const factorNorm = Math.max(0, Math.min(1, (sample.oreEnrichmentFactor - 1.0) / 4.0));
      const hex = sample.dominantOre?.heatmapColor || '#f59e0b';
      const rgb = hexToRgb(hex);
      return [
        Math.min(255, Math.round(rgb[0] * (factorNorm + 0.3))),
        Math.min(255, Math.round(rgb[1] * (factorNorm + 0.3))),
        Math.min(255, Math.round(rgb[2] * (factorNorm + 0.3))),
        255,
      ];
    }

    case 'tectonics': {
      const plateColor = hexToRgb(getPlateHexColor(sample.plateId));
      if (sample.isWater) {
        return [
          Math.round(plateColor[0] * 0.4),
          Math.round(plateColor[1] * 0.4 + 20),
          Math.round(plateColor[2] * 0.5 + 40),
          255,
        ];
      }
      return [plateColor[0], plateColor[1], plateColor[2], 255];
    }

    case 'drainage': {
      if (sample.isWater) {
        const lat = sample.lat;
        const gyre = Math.sin((lat * Math.PI) / 30);
        return [14, Math.round(50 + gyre * 20), Math.round(110 + gyre * 35), 255];
      }
      if (sample.hasRiver) return [56, 189, 248, 255]; // Vivid river turquoise
      const elev = Math.max(0, sample.depthOrHeightM / 6000);
      return [
        Math.round(65 + elev * 80),
        Math.round(90 + elev * 70),
        Math.round(60 + elev * 40),
        255,
      ];
    }

    case 'physical': {
      // Hypsometric elevation tint with hillshading
      const hs = sample.hillshade ?? 1.0;
      if (sample.isWater) {
        const depthNorm = Math.min(1, Math.abs(sample.depthOrHeightM) / 8000);
        const col = colorRamp(depthNorm, [
          [0.0, [56, 189, 248]], // Shallow cyan
          [0.3, [14, 116, 144]],
          [0.7, [3, 40, 90]],
          [1.0, [2, 18, 48]], // Abyssal deep navy
        ]);
        return col;
      } else {
        const heightNorm = Math.min(1, sample.depthOrHeightM / 7000);
        const col = colorRamp(heightNorm, [
          [0.0, [34, 197, 94]], // Coastal green
          [0.2, [132, 204, 22]],
          [0.45, [234, 179, 8]], // Foothills ochre
          [0.7, [180, 83, 9]], // High alpine brown
          [0.9, [248, 250, 252]], // Glaciated summit snow
        ]);
        return [
          Math.min(255, Math.round(col[0] * hs)),
          Math.min(255, Math.round(col[1] * hs)),
          Math.min(255, Math.round(col[2] * hs)),
          255,
        ];
      }
    }

    case 'relief': {
      // High-resolution illuminated 3D shaded relief
      if (sample.isWater) {
        const depthNorm = Math.min(1, Math.abs(sample.depthOrHeightM) / 6000);
        const val = Math.round(18 + (1 - depthNorm) * 22);
        return [val, val + 10, val + 24, 255];
      }
      const hs = sample.hillshade ?? 1.0;
      const baseGrey = 135;
      const shaded = Math.min(255, Math.max(15, Math.round(baseGrey * hs)));
      return [shaded, shaded, shaded, 255];
    }

    case 'biomes':
    case 'satellite':
    default: {
      return renderSatelliteOrStyle(sample, style, planet);
    }
  }
}

function renderSatelliteOrStyle(
  sample: SamplePoint,
  style: MapStyleType,
  planet?: PlanetData
): [number, number, number, number] {
  if (style === 'tactical_hud') {
    if (sample.isWater) return [5, 25, 38, 255];
    const contour = Math.floor(sample.depthOrHeightM / 500) % 2 === 0 ? 30 : 0;
    return [0, 180 + contour, 220 + contour, 255];
  }

  if (style === 'blueprint') {
    if (sample.isWater) return [10, 30, 65, 255];
    const gridLine = Math.round(sample.depthOrHeightM / 400) % 2 === 0;
    return gridLine ? [200, 230, 255, 255] : [20, 60, 110, 255];
  }

  if (style === 'topographic_survey') {
    if (sample.isWater) return [220, 235, 245, 255];
    const step = Math.floor(sample.depthOrHeightM / 400);
    const grey = (step * 25) % 180 + 50;
    return [grey, grey, grey, 255];
  }

  if (style === 'vintage_parchment') {
    if (sample.isWater) return [195, 205, 190, 255];
    const elev = Math.min(1, sample.depthOrHeightM / 6000);
    return [
      Math.round(230 - elev * 40),
      Math.round(215 - elev * 50),
      Math.round(180 - elev * 70),
      255,
    ];
  }

  if (style === 'thermal_ir') {
    const tNorm = Math.max(0, Math.min(1, (sample.temperatureC + 40) / 80));
    return colorRamp(tNorm, [
      [0.0, [20, 0, 40]],
      [0.3, [120, 20, 140]],
      [0.6, [230, 60, 40]],
      [0.85, [250, 210, 30]],
      [1.0, [255, 255, 255]],
    ]);
  }

  // -------------------------------------------------------------
  // PHOTOREALISTIC TRUE SATELLITE IMAGERY ENGINE
  // -------------------------------------------------------------
  const hs = sample.hillshade ?? 1.0;
  const polarCapLimit = planet?.polarCapLatitudeDeg ?? 72;

  // 1. Water rendering: Realistic shallow turquoise shoals to abyssal navy
  if (sample.isWater) {
    if (sample.temperatureC < -2.0 || Math.abs(sample.lat) > polarCapLimit) {
      // Polar pack ice with subtle surface texture
      const iceMod = Math.abs(Math.sin(sample.lat * 8 + sample.lon * 8)) > 0.82 ? -18 : 0;
      return [
        Math.min(255, Math.max(0, 238 + iceMod)),
        Math.min(255, Math.max(0, 246 + iceMod)),
        Math.min(255, Math.max(0, 255 + iceMod)),
        255,
      ];
    }

    const depth = Math.min(1, Math.abs(sample.depthOrHeightM) / 6000);
    const isShelf = sample.isContinentalShelf || Math.abs(sample.depthOrHeightM) < 220;

    let r = 8, g = 32, b = 76;
    if (isShelf) {
      // Luminous tropical turquoise & shallow neritic shelf
      const shelfNorm = Math.min(1, Math.abs(sample.depthOrHeightM) / 220);
      r = Math.round(52 - shelfNorm * 42);
      g = Math.round(184 - shelfNorm * 126);
      b = Math.round(208 - shelfNorm * 115);
    } else {
      // Abyssal deep ocean
      r = Math.round(8 - depth * 5);
      g = Math.round(30 - depth * 16);
      b = Math.round(76 - depth * 26);
    }

    // Specular solar sheen on water when facing the sun
    if (hs > 1.18) {
      const glint = (hs - 1.18) * 95;
      r = Math.min(255, Math.round(r + glint * 0.7));
      g = Math.min(255, Math.round(g + glint * 0.85));
      b = Math.min(255, Math.round(b + glint));
    }

    return [r, g, b, 255];
  }

  // 2. Polar ice caps on land
  if (sample.temperatureC < -14 || Math.abs(sample.lat) > polarCapLimit) {
    const iceShade = Math.round(242 * Math.min(1.15, hs));
    return [iceShade, Math.min(255, iceShade + 6), Math.min(255, iceShade + 12), 255];
  }

  // 3. Rivers on land
  if (sample.hasRiver) {
    return [
      Math.min(255, Math.round(44 * hs)),
      Math.min(255, Math.round(148 * hs)),
      Math.min(255, Math.round(216 * hs)),
      255,
    ];
  }

  // 4. Coastlines & sandy beaches (narrow fringe where altitude is low and near water)
  if (sample.depthOrHeightM < 65 && sample.precipitationMm > 70) {
    return [
      Math.min(255, Math.round(214 * hs)),
      Math.min(255, Math.round(196 * hs)),
      Math.min(255, Math.round(152 * hs)),
      255,
    ];
  }

  // 5. Alpine peaks & dynamic snow line
  const snowlineM = Math.max(900, 5200 - Math.pow(Math.abs(sample.lat) / 90, 2) * 4400);
  if (sample.depthOrHeightM > snowlineM) {
    // Glaciated summit snow
    return [
      Math.min(255, Math.round(244 * hs)),
      Math.min(255, Math.round(248 * hs)),
      Math.min(255, Math.round(254 * hs)),
      255,
    ];
  } else if (sample.depthOrHeightM > snowlineM - 900) {
    // Rocky granite & slate scree above tree line
    return [
      Math.min(255, Math.round(98 * hs)),
      Math.min(255, Math.round(94 * hs)),
      Math.min(255, Math.round(90 * hs)),
      255,
    ];
  }

  // 6. Realistic Biome Colors with Flora Spectral Pigment Adaptation
  const flora = planet?.floraPigmentType ?? 'chlorophyll_green';
  let baseRGB: [number, number, number] = [64, 120, 52];

  switch (sample.biome) {
    case 'Hyper-Arid Erg Desert':
      // Terracotta sandstone, erg dunes, and desert varnish
      baseRGB = [220, 162, 98];
      break;

    case 'Tropical Rainforest':
      if (flora === 'retinal_purple') baseRGB = [64, 24, 82];
      else if (flora === 'carotenoid_red') baseRGB = [115, 25, 34];
      else if (flora === 'xanthophyll_gold') baseRGB = [168, 126, 38];
      else if (flora === 'melanin_black') baseRGB = [28, 30, 32];
      else baseRGB = [18, 76, 32]; // Deep chlorophyll emerald
      break;

    case 'Savanna & Shrubland':
      if (flora === 'carotenoid_red') baseRGB = [156, 70, 54];
      else if (flora === 'retinal_purple') baseRGB = [108, 56, 118];
      else baseRGB = [158, 146, 76]; // Golden straw
      break;

    case 'Temperate Rainforest':
      if (flora === 'retinal_purple') baseRGB = [72, 34, 94];
      else if (flora === 'carotenoid_red') baseRGB = [128, 36, 44];
      else baseRGB = [26, 98, 45];
      break;

    case 'Boreal Conifer Forest':
      if (flora === 'melanin_black') baseRGB = [35, 36, 40];
      else baseRGB = [32, 74, 46]; // Dark taiga spruce
      break;

    case 'Cryo-Tundra':
    case 'Steppe & Tundra':
      baseRGB = [128, 138, 114];
      break;

    case 'Iron Oxide Regolith & Dune':
      baseRGB = [186, 75, 45]; // Mars rusty regolith
      break;

    case 'Supercritical Basaltic Plain':
      baseRGB = [135, 112, 72];
      break;

    case 'Sulfur Caldera & Basalt Flow':
      baseRGB = [205, 175, 42];
      break;

    default:
      if (flora === 'retinal_purple') baseRGB = [86, 46, 108];
      else if (flora === 'carotenoid_red') baseRGB = [136, 46, 50];
      else baseRGB = [58, 118, 52];
      break;
  }

  return [
    Math.min(255, Math.max(0, Math.round(baseRGB[0] * hs))),
    Math.min(255, Math.max(0, Math.round(baseRGB[1] * hs))),
    Math.min(255, Math.max(0, Math.round(baseRGB[2] * hs))),
    255,
  ];
}

// Helpers
function colorRamp(
  val: number,
  stops: [number, [number, number, number]][],
  alpha = 255
): [number, number, number, number] {
  const v = Math.max(0, Math.min(1, val));
  for (let i = 0; i < stops.length - 1; i++) {
    const s1 = stops[i];
    const s2 = stops[i + 1];
    if (v >= s1[0] && v <= s2[0]) {
      const factor = (v - s1[0]) / (s2[0] - s1[0]);
      const r = Math.round(s1[1][0] + (s2[1][0] - s1[1][0]) * factor);
      const g = Math.round(s1[1][1] + (s2[1][1] - s1[1][1]) * factor);
      const b = Math.round(s1[1][2] + (s2[1][2] - s1[1][2]) * factor);
      return [r, g, b, alpha];
    }
  }
  const last = stops[stops.length - 1][1];
  return [last[0], last[1], last[2], alpha];
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16);
    const g = parseInt(clean[1] + clean[1], 16);
    const b = parseInt(clean[2] + clean[2], 16);
    return [r, g, b];
  }
  const num = parseInt(clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function getPlateHexColor(id: number): string {
  const plateColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#d97706', '#6366f1',
    '#14b8a6', '#f43f5e', '#a855f7', '#64748b', '#0ea5e9'
  ];
  return plateColors[Math.abs(id) % plateColors.length];
}
