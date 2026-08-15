export interface TelemetryRow {
  timestamp: string;
  vehicle_id: string;
  gps: {
    latitude: number;
    longitude: number;
    altitude: number;
    satellites: number;
  };
  sensors: {
    water_temperature: number;
    air_pressure: number;
    air_temperature: number;
  };
}

export interface VehicleData {
  vehicleId: string;
  data: TelemetryDataPoint[];
}

export interface TelemetryDataPoint {
  timestamp: string;
  vehicleId: string;
  latitude: number;
  longitude: number;
  altitude?: number;
  satellites?: number;
  waterTemperature: number;
  airPressure: number;
  airTemperature: number;
  humidity?: number;
}

export type VehicleTracks = Record<string, TelemetryDataPoint[]>;

export type GASResponse<T extends object = Record<string, never>> = {
  status: 'success' | 'error';
  message?: string;
  timestamp: string;
} & T;

export interface ConnectionStatus {
  isConnected: boolean;
  lastUpdate: Date | null;
  retryCount: number;
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
