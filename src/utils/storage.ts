import { PlanetData } from '../types';
import { PRESET_PLANETS } from './presets';

const STORAGE_KEY_WORLDS = 'astroforge_worlds_v1';
const STORAGE_KEY_ACTIVE = 'astroforge_active_world_id';

export interface SyncStatus {
  isOnline: boolean;
  lastSyncedAt: number | null;
  syncInProgress: boolean;
  syncCode: string | null;
  error: string | null;
}

export function loadStoredWorlds(): PlanetData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WORLDS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Failed to parse stored worlds from localStorage:', err);
  }

  // Default initial set from presets
  const initial = [
    PRESET_PLANETS.earth_like,
    PRESET_PLANETS.mars_like,
    PRESET_PLANETS.super_earth,
    PRESET_PLANETS.oceanic,
    PRESET_PLANETS.desert,
  ];
  saveStoredWorlds(initial);
  return initial;
}

export function saveStoredWorlds(worlds: PlanetData[]) {
  try {
    localStorage.setItem(STORAGE_KEY_WORLDS, JSON.stringify(worlds));
  } catch (err) {
    console.error('Failed to save worlds to localStorage:', err);
  }
}

export function getActiveWorldId(): string {
  return localStorage.getItem(STORAGE_KEY_ACTIVE) || PRESET_PLANETS.earth_like.id;
}

export function setActiveWorldId(id: string) {
  localStorage.setItem(STORAGE_KEY_ACTIVE, id);
}

// Multi-device Cloud Sync API client
export async function pushWorldToCloud(world: PlanetData): Promise<{ success: boolean; lastModified: number; error?: string }> {
  try {
    const res = await fetch(`/api/sync/${encodeURIComponent(world.id)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ world, clientVersion: '1.0' }),
    });
    if (!res.ok) {
      throw new Error(`Sync failed with status: ${res.status}`);
    }
    const data = await res.json();
    return { success: true, lastModified: data.lastModified };
  } catch (err: any) {
    return { success: false, lastModified: Date.now(), error: err.message || 'Offline or server unreachable' };
  }
}

export async function fetchWorldFromCloud(worldId: string): Promise<{ success: boolean; world?: PlanetData; error?: string }> {
  try {
    const res = await fetch(`/api/sync/${encodeURIComponent(worldId)}`);
    if (!res.ok) {
      throw new Error(`World ${worldId} not found on cloud server`);
    }
    const data = await res.json();
    return { success: true, world: data.world };
  } catch (err: any) {
    return { success: false, error: err.message || 'Failed to fetch from cloud' };
  }
}

// Export / Import JSON
export function exportWorldToJsonFile(world: PlanetData) {
  const jsonStr = JSON.stringify(world, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${world.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_survey.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseWorldFromJsonFile(file: File): Promise<PlanetData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const parsed = JSON.parse(text);
        if (!parsed.id || !parsed.name || !parsed.radiusEarth) {
          throw new Error('Invalid planetary simulation schema');
        }
        resolve(parsed);
      } catch (err: any) {
        reject(new Error(`Failed to parse planet file: ${err.message}`));
      }
    };
    reader.onerror = () => reject(new Error('Failed reading file'));
    reader.readAsText(file);
  });
}
