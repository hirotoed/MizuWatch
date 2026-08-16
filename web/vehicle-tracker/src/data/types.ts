import type { VehicleTracks } from '../types';

export interface VehicleDataSource {
  readonly id: string;
  readonly label: string;
  getAllVehicles(): Promise<VehicleTracks>;
}

export class DataSourceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DataSourceError';
  }
}
