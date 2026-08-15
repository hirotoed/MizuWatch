import type { TelemetryDataPoint, VehicleTracks } from '../types';
import { DataSourceError, type VehicleDataSource } from './types';
import { getSupabaseClient } from './supabaseClient';

interface TracksApiResponse {
  data?: unknown;
  error?: { code?: string; message?: string };
  requestId?: string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isTelemetryDataPoint(value: unknown, vehicleId: string): value is TelemetryDataPoint {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.timestamp === 'string' &&
    !Number.isNaN(Date.parse(point.timestamp)) &&
    point.vehicleId === vehicleId &&
    isFiniteNumber(point.latitude) &&
    point.latitude >= -90 && point.latitude <= 90 &&
    isFiniteNumber(point.longitude) &&
    point.longitude >= -180 && point.longitude <= 180 &&
    isFiniteNumber(point.waterTemperature) &&
    isFiniteNumber(point.airPressure) &&
    isFiniteNumber(point.airTemperature) &&
    (point.altitude === undefined || isFiniteNumber(point.altitude)) &&
    (point.satellites === undefined || (isFiniteNumber(point.satellites) && Number.isInteger(point.satellites))) &&
    (point.humidity === undefined || isFiniteNumber(point.humidity))
  );
}

export function parseVehicleTracks(value: unknown): VehicleTracks {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new DataSourceError('The tracks API returned an invalid data object');
  }

  const tracks: VehicleTracks = {};
  for (const [vehicleId, candidateTrack] of Object.entries(value)) {
    if (!Array.isArray(candidateTrack) || !candidateTrack.every((point) => isTelemetryDataPoint(point, vehicleId))) {
      throw new DataSourceError(`The tracks API returned invalid telemetry for ${vehicleId}`);
    }
    tracks[vehicleId] = [...candidateTrack].sort(
      (left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp),
    );
  }
  return tracks;
}

export const supabaseVehicleDataSource: VehicleDataSource = {
  id: 'supabase',
  label: 'MizuWatch API',

  async getAllVehicles(): Promise<VehicleTracks> {
    try {
      const supabase = getSupabaseClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!sessionData.session) throw new DataSourceError('Sign in is required to load vehicle data');

      const to = new Date();
      const from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      const endpoint = new URL(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/tracks-v1`);
      endpoint.searchParams.set('from', from.toISOString());
      endpoint.searchParams.set('to', to.toISOString());

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? '',
        },
      });
      const body = await response.json() as TracksApiResponse;
      if (!response.ok) {
        const detail = body.error?.message ?? `HTTP ${response.status}`;
        const requestId = body.requestId ? ` (request ${body.requestId})` : '';
        throw new DataSourceError(`${detail}${requestId}`);
      }
      return parseVehicleTracks(body.data);
    } catch (error) {
      if (error instanceof DataSourceError) throw error;
      const detail = error instanceof Error ? `: ${error.message}` : '';
      throw new DataSourceError(`Failed to load vehicle data from MizuWatch API${detail}`);
    }
  },
};

