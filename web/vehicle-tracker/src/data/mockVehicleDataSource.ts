import type { TelemetryDataPoint, VehicleTracks } from '../types';
import { DataSourceError, type VehicleDataSource } from './types';

interface MockVehicleDefinition {
  vehicleId: string;
  center: { latitude: number; longitude: number };
  phase: number;
  waterTemperature: number;
  airTemperature: number;
}

const POINT_COUNT = 36;
const SAMPLE_INTERVAL_MS = 30_000;

const MOCK_VEHICLES: MockVehicleDefinition[] = [
  {
    vehicleId: 'MIZU_001',
    center: { latitude: 35.6846, longitude: 139.7528 },
    phase: 0,
    waterTemperature: 22.4,
    airTemperature: 26.8,
  },
  {
    vehicleId: 'MIZU_002',
    center: { latitude: 35.6818, longitude: 139.7582 },
    phase: 1.7,
    waterTemperature: 21.9,
    airTemperature: 26.2,
  },
  {
    vehicleId: 'MIZU_003',
    center: { latitude: 35.6789, longitude: 139.7491 },
    phase: 3.4,
    waterTemperature: 23.1,
    airTemperature: 27.1,
  },
];

function round(value: number, digits: number): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function createTrack(vehicle: MockVehicleDefinition, now: number): TelemetryDataPoint[] {
  return Array.from({ length: POINT_COUNT }, (_, index) => {
    const step = index + vehicle.phase;
    const progress = index / (POINT_COUNT - 1);

    return {
      timestamp: new Date(now - (POINT_COUNT - 1 - index) * SAMPLE_INTERVAL_MS).toISOString(),
      vehicleId: vehicle.vehicleId,
      latitude: round(vehicle.center.latitude + Math.sin(step / 5) * 0.0024 + progress * 0.0012, 6),
      longitude: round(vehicle.center.longitude + Math.cos(step / 6) * 0.0032 - progress * 0.0008, 6),
      altitude: round(1.8 + Math.sin(step / 4) * 0.35, 1),
      satellites: 8 + (index % 4),
      waterTemperature: round(vehicle.waterTemperature + Math.sin(step / 7) * 0.45, 1),
      airPressure: round(1012.8 + Math.cos(step / 8) * 1.6, 1),
      airTemperature: round(vehicle.airTemperature + Math.sin(step / 6) * 0.8, 1),
      humidity: round(68 + Math.cos(step / 5) * 5, 1),
    };
  });
}

export const mockVehicleDataSource: VehicleDataSource = {
  id: 'mock',
  label: 'Mock data',

  async getAllVehicles(): Promise<VehicleTracks> {
    try {
      const now = Date.now();
      return Object.fromEntries(
        MOCK_VEHICLES.map((vehicle) => [vehicle.vehicleId, createTrack(vehicle, now)]),
      );
    } catch (error) {
      const detail = error instanceof Error ? `: ${error.message}` : '';
      throw new DataSourceError(`Failed to create mock vehicle data${detail}`);
    }
  },
};
