import React from 'react';
import { Marker } from '@react-google-maps/api';
import type { TelemetryDataPoint } from '../types';
import { useAppStore } from '../store';

interface VehicleMarkerProps {
  vehicleId: string;
  dataPoint: TelemetryDataPoint;
  isSelected: boolean;
}

// Color palette for different vehicles (matching TrackPolyline and WaypointMarker)
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

export const VehicleMarker: React.FC<VehicleMarkerProps> = ({
  vehicleId,
  dataPoint,
  isSelected,
}) => {
  const { setSelectedDataPoint, setSelectedVehicle, getVehicleIds } = useAppStore();

  const handleMarkerClick = () => {
    setSelectedVehicle(vehicleId);
    setSelectedDataPoint(dataPoint);
  };

  // Get consistent color for this vehicle
  const vehicleIds = getVehicleIds();
  const vehicleIndex = vehicleIds.indexOf(vehicleId);
  const vehicleColor = VEHICLE_COLORS[vehicleIndex % VEHICLE_COLORS.length];

  // Create custom marker icon
  const markerIcon = {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: vehicleColor,
    fillOpacity: 1,
    strokeColor: '#0d1117',
    strokeWeight: 3,
    scale: isSelected ? 14 : 10,
  };

  return (
    <Marker
      position={{
        lat: dataPoint.latitude,
        lng: dataPoint.longitude,
      }}
      onClick={handleMarkerClick}
      icon={markerIcon}
      title={`${vehicleId} - ${new Date(dataPoint.timestamp).toLocaleString()}`}
      animation={isSelected ? google.maps.Animation.BOUNCE : undefined}
      zIndex={isSelected ? 1000 : 100}
    />
  );
};
