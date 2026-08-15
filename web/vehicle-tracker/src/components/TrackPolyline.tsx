import React from 'react';
import { Polyline } from '@react-google-maps/api';
import type { TelemetryDataPoint } from '../types';
import { useAppStore } from '../store';

interface TrackPolylineProps {
  vehicleId: string;
  data: TelemetryDataPoint[];
  isSelected: boolean;
}

// Color palette for different vehicles (matching WaypointMarker)
const VEHICLE_COLORS = [
  '#58a6ff', // Blue
  '#7c3aed', // Purple  
  '#f59e0b', // Amber
  '#10b981', // Emerald
  '#ef4444', // Red
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#84cc16', // Lime
];

export const TrackPolyline: React.FC<TrackPolylineProps> = ({
  vehicleId,
  data,
  isSelected,
}) => {
  const { getVehicleIds } = useAppStore();
  
  if (data.length < 2) return null;

  const path = data.map(point => ({
    lat: point.latitude,
    lng: point.longitude,
  }));

  // Get consistent color for this vehicle
  const vehicleIds = getVehicleIds();
  const vehicleIndex = vehicleIds.indexOf(vehicleId);
  const vehicleColor = VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];

  const polylineOptions: google.maps.PolylineOptions = {
    path,
    geodesic: true,
    strokeColor: vehicleColor,
    strokeOpacity: isSelected ? 0.9 : 0.6,
    strokeWeight: isSelected ? 4 : 2,
    zIndex: isSelected ? 100 : 50,
  };

  return <Polyline options={polylineOptions} />;
};
