import { mockVehicleDataSource } from './mockVehicleDataSource';
import { isSupabaseDataSource } from './supabaseClient';
import { supabaseVehicleDataSource } from './supabaseVehicleDataSource';

export const vehicleDataSource = isSupabaseDataSource
  ? supabaseVehicleDataSource
  : mockVehicleDataSource;

export type { VehicleDataSource } from './types';
export { DataSourceError } from './types';
