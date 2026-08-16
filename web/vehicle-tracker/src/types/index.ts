export interface TelemetryRow {
  timestamp: string;
  vehicle_id: string;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    satellites: number;
    gnss_timestamp?: string;
    fix_status?: 'valid' | 'no_fix';
    hdop?: number;
  };
  sensors: {
    water_temperature: number;
    ph?: number;
    ec?: number;
    air_pressure: number;
    air_temperature: number;
    humidity?: number;
  };
}

export interface TelemetryDataPoint {
  timestamp: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  satellites?: number;
  gnssTimestamp?: string;
  fixStatus?: 'valid' | 'no_fix';
  hdop?: number;
  waterTemperature: number;
  ph?: number;
  ec?: number;
  airPressure: number;
  airTemperature: number;
  humidity?: number;
  batteryVoltage?: number;
  communicationStatus?: 'online' | 'buffered' | 'unknown';
  measurementStatus?: 'ok' | 'stabilizing' | 'partial' | 'sensor_error';
  qualityFlag?: 'A' | 'B' | 'C';
}

export type VehicleTracks = Record<string, TelemetryDataPoint[]>;

export interface ConnectionStatus {
  isConnected: boolean;
  lastUpdate: Date | null;
  retryCount: number;
  sourceLabel: string;
}

export interface MapOptions {
  center: google.maps.LatLngLiteral;
  zoom: number;
  styles: google.maps.MapTypeStyle[];
  disableDefaultUI: boolean;
  gestureHandling: 'greedy' | 'cooperative' | 'none' | 'auto';
}

export interface ExportFormat {
  type: 'csv' | 'json';
  filename: string;
}
