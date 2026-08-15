import { describe, expect, it } from 'vitest';
import { DataSourceError } from './types';
import { parseVehicleTracks } from './supabaseVehicleDataSource';

const laterPoint = {
  timestamp: '2026-08-15T01:00:00.000Z',
  vehicleId: 'MIZU_001',
  latitude: 33,
  longitude: 130,
  waterTemperature: 24.8,
  airPressure: 1012.4,
  airTemperature: 28.4,
};

describe('parseVehicleTracks', () => {
  it('validates the API contract and sorts each track ascending', () => {
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
});

