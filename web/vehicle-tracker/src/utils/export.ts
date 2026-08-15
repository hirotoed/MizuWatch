import Papa from 'papaparse';
import type { TelemetryDataPoint, VehicleTracks } from '../types';

export function exportToCSV(data: TelemetryDataPoint[], filename: string = 'vehicle-data') {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const csv = Papa.unparse(data, {
    header: true,
    columns: [
      'timestamp',
      'vehicleId',
      'latitude',
      'longitude',
      'altitude',
      'satellites',
      'waterTemperature',
      'airPressure',
      'airTemperature',
      'humidity',
    ],
  });

  downloadFile(csv, `${filename}.csv`, 'text/csv');
}

export function exportToJSON(data: TelemetryDataPoint[], filename: string = 'vehicle-data') {
  if (data.length === 0) {
    throw new Error('No data to export');
  }

  const json = JSON.stringify(data, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

export function exportAllVehiclesToCSV(vehicleTracks: VehicleTracks, filename: string = 'all-vehicles-data') {
  const allData: TelemetryDataPoint[] = [];
  
  Object.values(vehicleTracks).forEach(vehicleData => {
    allData.push(...vehicleData);
  });

  // Sort by timestamp
  allData.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  exportToCSV(allData, filename);
}

export function exportAllVehiclesToJSON(vehicleTracks: VehicleTracks, filename: string = 'all-vehicles-data') {
  if (Object.keys(vehicleTracks).length === 0) {
    throw new Error('No data to export');
  }

  const exportData = {
    exportedAt: new Date().toISOString(),
    totalVehicles: Object.keys(vehicleTracks).length,
    totalDataPoints: Object.values(vehicleTracks).reduce((sum, data) => sum + data.length, 0),
    vehicles: vehicleTracks,
  };

  const json = JSON.stringify(exportData, null, 2);
  downloadFile(json, `${filename}.json`, 'application/json');
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
