import { describe, expect, it } from 'vitest';
import { DataSourceError } from './types';
import { parseVehicleTracks } from './supabaseVehicleDataSource';

const laterPoint = {
  timestamp: '2026-08-15T01:00:00.000Z',
  vehicleId: 'MIZU_001',
  latitude: 33,
  longitude: 130,
  satellites: 10,
  gnssTimestamp: '2026-08-15T01:00:00.000Z',
  fixStatus: 'valid' as const,
  hdop: 0.9,
  waterTemperature: 24.8,
  ph: 7.12,
  ec: 326.4,
  airPressure: 1012.4,
  airTemperature: 28.4,
  batteryVoltage: 3.9,
  communicationStatus: 'online' as const,
  measurementStatus: 'ok' as const,
};

describe('parseVehicleTracks', () => {
  it('validates the v1 API contract and sorts each track ascending', () => {
    const earlierPoint = { ...laterPoint, timestamp: '2026-08-15T00:00:00.000Z' };
    const tracks = parseVehicleTracks({ MIZU_001: [laterPoint, earlierPoint] });

    expect(tracks.MIZU_001).toEqual([earlierPoint, laterPoint]);
  });

  it('keeps an authorized vehicle with no readings', () => {
    expect(parseVehicleTracks({ MIZU_002: [] })).toEqual({ MIZU_002: [] });
  });

  it('rejects a point whose vehicleId does not match its track key', () => {
    expect(() => parseVehicleTracks({ MIZU_002: [laterPoint] })).toThrow(DataSourceError);
  });

  it('rejects out-of-range v1 water quality fields', () => {
    expect(() => parseVehicleTracks({
      MIZU_001: [{ ...laterPoint, ph: 15, ec: 0 }],
    })).toThrow(DataSourceError);
  });
});
