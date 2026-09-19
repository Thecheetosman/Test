import { StarSystemData, MoonData, PlanetData } from '../types';

export const G_CONST = 6.6743e-11; // m^3 kg^-1 s^-2
export const C_LIGHT = 299792.458; // km/s
export const AU_KM = 149597870.7; // 1 AU in km
export const LY_KM = 9.4607e12; // 1 light year in km
export const EARTH_RADIUS_KM = 6371.0;
export const EARTH_MASS_KG = 5.972e24;
export const SOLAR_LUMINOSITY_WATTS = 3.828e26;

// Gravitational and Physical Characteristics
export function calculateSurfaceGravity(massEarth: number, radiusEarth: number): number {
  if (radiusEarth <= 0) return 1.0;
  return massEarth / (radiusEarth * radiusEarth);
}

export function calculateEscapeVelocity(massEarth: number, radiusEarth: number): number {
  if (radiusEarth <= 0) return 11.2;
  return 11.186 * Math.sqrt(massEarth / radiusEarth);
}

export function calculateDensity(massEarth: number, radiusEarth: number): number {
  if (radiusEarth <= 0) return 5.51;
  return 5.515 * (massEarth / Math.pow(radiusEarth, 3));
}
export const calculatePlanetDensity = calculateDensity;

// Kopparapu et al. Habitable Zone Boundaries (in AU)
export function calculateHabitableZone(luminositySolar: number): { innerAU: number; outerAU: number } {
  const innerAU = Math.sqrt(luminositySolar / 1.107);
  const outerAU = Math.sqrt(luminositySolar / 0.356);
  return {
    innerAU: Number(innerAU.toFixed(3)),
    outerAU: Number(outerAU.toFixed(3)),
  };
}

// Solar Flux and Equilibrium Temperatures
export function calculateInsolationFlux(luminositySolar: number, semiMajorAxisAU: number): number {
  if (semiMajorAxisAU <= 0) return 1361;
  return 1361 * (luminositySolar / (semiMajorAxisAU * semiMajorAxisAU));
}

export function calculateEquilibriumTempK(luminositySolar: number, semiMajorAxisAU: number, albedo: number): number {
  if (semiMajorAxisAU <= 0) return 255;
  const clampedAlbedo = Math.max(0, Math.min(0.95, albedo));
  return 278.5 * Math.pow(luminositySolar / (semiMajorAxisAU * semiMajorAxisAU), 0.25) * Math.pow(1 - clampedAlbedo, 0.25);
}

export function calculateAtmosphericGreenhouseWarming(pressureAtm: number, gases: { name: string; percentage: number; greenhouseEffect: number }[]): number {
  let greenhouseSum = 0;
  for (const gas of gases) {
    greenhouseSum += (gas.percentage / 100) * gas.greenhouseEffect;
  }
  // Logarithmic pressure and greenhouse dependency
  const baseWarming = 33 * (greenhouseSum / 0.05);
  const pressureFactor = Math.pow(Math.max(0.001, pressureAtm), 0.35);
  return Math.min(450, Math.max(0, baseWarming * pressureFactor));
}

export function calculateScaleHeightKm(tempK: number, surfaceGravityG: number, meanMolarMassGmol: number = 28.97): number {
  if (surfaceGravityG <= 0) return 8.5;
  // H = (R * T) / (M * g)
  const gMs2 = surfaceGravityG * 9.80665;
  const H_meters = (8.31446 * tempK) / ((meanMolarMassGmol / 1000) * gMs2);
  return Number((H_meters / 1000).toFixed(2));
}

export function calculateOrbitalPeriodDays(semiMajorAxisAU: number, starMassSolar: number): number {
  if (starMassSolar <= 0 || semiMajorAxisAU <= 0) return 365.25;
  // P^2 = a^3 / M
  const years = Math.sqrt(Math.pow(semiMajorAxisAU, 3) / starMassSolar);
  return Number((years * 365.256).toFixed(2));
}

// Great-Circle Surface Distance (Haversine)
export function calculateGreatCircleDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  planetRadiusEarth: number
): number {
  const R = planetRadiusEarth * EARTH_RADIUS_KM;
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// Travel Time Calculations
export function calculateSurfaceTravelTime(
  distanceKm: number,
  mode: 'suborbital_rocket' | 'hypersonic_craft' | 'vactrain_maglev' | 'ground_rover' | 'ocean_vessel'
): { hours: number; speedKmh: number; deltaVKms?: number; description: string } {
  switch (mode) {
    case 'suborbital_rocket': {
      // Suborbital ballistic flight: ~45 mins nominal coast, plus ascent/descent
      const flightHours = Math.max(0.4, (distanceKm / 24000) * 0.75 + 0.35);
      return {
        hours: Number(flightHours.toFixed(2)),
        speedKmh: 27000,
        deltaVKms: 6.8,
        description: 'Ballistic exoatmospheric arc trajectory',
      };
    }
    case 'hypersonic_craft': {
      const speed = 4500; // Mach 4.2 cruise
      const hours = distanceKm / speed + 0.3; // boarding/ascent
      return {
        hours: Number(hours.toFixed(2)),
        speedKmh: speed,
        description: 'Scramjet atmospheric waverider cruise',
      };
    }
    case 'vactrain_maglev': {
      const speed = 1200; // Evacuated tube maglev
      return {
        hours: Number((distanceKm / speed).toFixed(2)),
        speedKmh: speed,
        description: 'Planetary subsurface superconducting vacuum tube',
      };
    }
    case 'ground_rover': {
      const speed = 75; // Rugged exploration rover
      return {
        hours: Number((distanceKm / speed).toFixed(2)),
        speedKmh: speed,
        description: 'Heavy exploration wheeled/tracked vehicle',
      };
    }
    case 'ocean_vessel': {
      const speed = 55; // Nuclear/hydrofoil oceanic transport (~30 knots)
      return {
        hours: Number((distanceKm / speed).toFixed(2)),
        speedKmh: speed,
        description: 'Autonomous planetary oceanic hydrofoil',
      };
    }
  }
}

// Relativistic Brachistochrone (Constant Acceleration Flip-and-Burn)
export function calculateBrachistochroneTransit(
  distanceKm: number,
  accelG: number = 1.0
): { shipDays: number; coordinateDays: number; maxSpeedC: number } {
  const a = accelG * 9.80665 * 1e-3; // km / s^2
  const c = C_LIGHT; // km / s
  const d = distanceKm;

  // Non-relativistic threshold for short interplanetary distances
  // t = 2 * sqrt(d / a) in seconds
  const tSecClassical = 2 * Math.sqrt(d / a);
  const vMaxClassical = a * (tSecClassical / 2);

  if (vMaxClassical < 0.1 * c) {
    const days = tSecClassical / 86400;
    return {
      shipDays: Number(days.toFixed(2)),
      coordinateDays: Number(days.toFixed(2)),
      maxSpeedC: Number((vMaxClassical / c).toFixed(4)),
    };
  }

  // Full relativistic equations for high-fractional C and interstellar transits:
  // tau (ship time) = (2 * c / a) * acosh(1 + (a * d) / (2 * c^2))
  const arg = 1 + (a * d) / (2 * c * c);
  const tauSeconds = (2 * c / a) * Math.acosh(arg);

  // Coordinate time t = 2 * sqrt((d / 2c)^2 + (d / a))
  const coordSeconds = 2 * Math.sqrt(Math.pow(d / (2 * c), 2) + d / a);

  // Max velocity at turnover: beta = sqrt(1 - (1 / (1 + a*d/(2c^2))^2))
  const gamma = 1 + (a * d) / (2 * c * c);
  const beta = Math.sqrt(1 - 1 / (gamma * gamma));

  return {
    shipDays: Number((tauSeconds / 86400).toFixed(2)),
    coordinateDays: Number((coordSeconds / 86400).toFixed(2)),
    maxSpeedC: Number(beta.toFixed(4)),
  };
}

// Apparent Angular Diameters in Sky (arcminutes)
export function calculateAngularDiameterArcmin(diameterKm: number, distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const radians = 2 * Math.atan(diameterKm / (2 * distanceKm));
  return Number(((radians * 180 * 60) / Math.PI).toFixed(1));
}

// Eclipse Assessment: Can moon produce total solar eclipse?
export function assessEclipseCapability(
  starRadiusSolar: number,
  planetSemiMajorAxisAU: number,
  moonRadiusEarth: number,
  moonDistanceKm: number
): { canTotalEclipse: boolean; starArcmin: number; moonArcmin: number; ratio: number } {
  const starDiameterKm = starRadiusSolar * 1392700;
  const planetDistanceKm = planetSemiMajorAxisAU * AU_KM;
  const moonDiameterKm = moonRadiusEarth * 12742;

  const starArcmin = calculateAngularDiameterArcmin(starDiameterKm, planetDistanceKm);
  const moonArcmin = calculateAngularDiameterArcmin(moonDiameterKm, moonDistanceKm);
  const ratio = starArcmin > 0 ? moonArcmin / starArcmin : 0;

  return {
    canTotalEclipse: ratio >= 1.0,
    starArcmin,
    moonArcmin,
    ratio: Number(ratio.toFixed(3)),
  };
}
