import type { GASResponse, VehicleData, TelemetryDataPoint, VehicleTracks } from '../types';

const GAS_ENDPOINT = import.meta.env.VITE_GAS_ENDPOINT;
const LEGACY_GAS_ENDPOINTS = (import.meta.env.VITE_LEGACY_GAS_ENDPOINTS || '')
  .split(',')
  .map((entry) => {
    const separatorIndex = entry.indexOf('|');
    if (separatorIndex < 1) return null;

    const vehicleId = entry.slice(0, separatorIndex).trim();
    const endpoint = entry.slice(separatorIndex + 1).trim();
    return vehicleId && endpoint ? { vehicleId, endpoint } : null;
  })
  .filter((entry): entry is { vehicleId: string; endpoint: string } => entry !== null);

if (!GAS_ENDPOINT) {
  console.warn('VITE_GAS_ENDPOINT not configured. Please set it in your .env file.');
}

export class GASApiError extends Error {
  status?: number;
  responseBody?: string;

  constructor(message: string, status?: number, responseBody?: string) {
    super(message);
    this.name = 'GASApiError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

interface LegacyTelemetryDataPoint {
  time?: string;
  tmp?: number | string;
  hum?: number | string;
  prs?: number | string;
  wtmp?: number | string;
  waterTemp?: number | string;
  Lat?: number | string;
  Lng?: number | string;
}

function hasValidCoordinates(point: Pick<TelemetryDataPoint, 'latitude' | 'longitude'>): boolean {
  const { latitude, longitude } = point;
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && latitude >= -90
    && latitude <= 90
    && longitude >= -180
    && longitude <= 180
    && !(latitude === 0 && longitude === 0);
}

async function requestGAS<T>(endpoint: string, action: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(endpoint);
  url.searchParams.set('action', action);
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new GASApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
    }

    const responseBody = await response.text();

    try {
      return JSON.parse(responseBody) as T;
    } catch {
      const summary = responseBody.trim().slice(0, 120) || '(empty response)';
      throw new GASApiError(
        `GAS API returned a non-JSON response: ${summary}`,
        response.status,
        responseBody,
      );
    }
  } catch (error) {
    if (error instanceof GASApiError) {
      throw error;
    }

    throw new GASApiError(
      error instanceof Error ? error.message : 'Network error'
    );
  }
}

async function fetchGAS<T extends object>(endpoint: string, action: string, params: Record<string, string> = {}): Promise<GASResponse<T>> {
  const data = await requestGAS<GASResponse<T>>(endpoint, action, params);

  if (data.status === 'error') {
    throw new GASApiError(data.message || 'Unknown error from GAS API');
  }

  return data;
}

async function getLegacyVehicleData(endpoint: string, vehicleId: string): Promise<TelemetryDataPoint[]> {
  const legacyData = await requestGAS<LegacyTelemetryDataPoint[]>(endpoint, 'getData');

  if (!Array.isArray(legacyData)) {
    throw new GASApiError('Legacy GAS API returned an unexpected data format');
  }

  const toNumber = (value: number | string | undefined): number => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const data = legacyData
    .map((point): TelemetryDataPoint => ({
      timestamp: point.time || new Date().toISOString(),
      vehicleId,
      latitude: toNumber(point.Lat),
      longitude: toNumber(point.Lng),
      waterTemperature: toNumber(point.wtmp ?? point.waterTemp),
      airPressure: toNumber(point.prs),
      airTemperature: toNumber(point.tmp),
      humidity: toNumber(point.hum),
    }))
    .filter(hasValidCoordinates)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return data;
}

export async function getAllVehicles(): Promise<VehicleTracks> {
  if (!GAS_ENDPOINT) {
    throw new GASApiError('GAS endpoint not configured');
  }

  try {
    const response = await fetchGAS<{ vehicles: VehicleData[] }>(GAS_ENDPOINT, 'getAllVehicles');

    const tracks: VehicleTracks = {};

    if (response.vehicles) {
      response.vehicles.forEach(vehicle => {
        tracks[vehicle.vehicleId] = vehicle.data.filter(hasValidCoordinates);
      });
    }

    return tracks;
  } catch (error) {
    if (error instanceof GASApiError && error.responseBody?.trim() === 'No Data') {
      console.info('The configured GAS endpoint uses the legacy getData API. Applying compatibility mapping.');

      const configuredEndpoints = LEGACY_GAS_ENDPOINTS.length > 0
        ? LEGACY_GAS_ENDPOINTS
        : [{ vehicleId: 'DRONE_001', endpoint: GAS_ENDPOINT }];
      const results = await Promise.allSettled(
        configuredEndpoints.map(async ({ vehicleId, endpoint }) => ({
          vehicleId,
          data: await getLegacyVehicleData(endpoint, vehicleId),
        })),
      );
      const tracks: VehicleTracks = {};

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          tracks[result.value.vehicleId] = result.value.data;
        } else {
          console.error('Failed to load a legacy vehicle endpoint:', result.reason);
        }
      });

      if (Object.keys(tracks).length === 0) {
        throw new GASApiError('All configured legacy GAS endpoints failed');
      }

      return tracks;
    }

    throw error;
  }
}

// These functions require the current multi-vehicle GAS contract.
export async function getVehicle(vehicleId: string): Promise<TelemetryDataPoint[]> {
  if (!GAS_ENDPOINT) throw new GASApiError('GAS endpoint not configured');
  const response = await fetchGAS<{ data: TelemetryDataPoint[] }>(GAS_ENDPOINT, 'getVehicle', { vehicleId });
  return response.data || [];
}

export async function getVehicleList(): Promise<string[]> {
  if (!GAS_ENDPOINT) throw new GASApiError('GAS endpoint not configured');
  const response = await fetchGAS<{
    vehicles: Array<{ vehicleId: string; dataCount: number }> 
  }>(GAS_ENDPOINT, 'getVehicleList');
  
  return response.vehicles?.map(v => v.vehicleId) || [];
}

export async function postTelemetryData(data: Record<string, unknown>): Promise<void> {
  if (!GAS_ENDPOINT) {
    throw new GASApiError('GAS endpoint not configured');
  }

  try {
    const response = await fetch(GAS_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      throw new GASApiError(`HTTP ${response.status}: ${response.statusText}`, response.status);
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new GASApiError(result.message || 'Unknown error from GAS API');
    }
  } catch (error) {
    if (error instanceof GASApiError) {
      throw error;
    }
    
    throw new GASApiError(
      error instanceof Error ? error.message : 'Network error'
    );
  }
}
