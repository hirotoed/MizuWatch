import React from 'react';
import { Marker } from '@react-google-maps/api';
import type { TelemetryDataPoint } from '../types';
import { useAppStore } from '../store';

interface WaypointMarkerProps {
  vehicleId: string;
  dataPoint: TelemetryDataPoint;
  isSelected: boolean;
  isLatest: boolean;
}

// Color palette for different vehicles (improved colors)
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

export const WaypointMarker: React.FC<WaypointMarkerProps> = ({
  vehicleId,
  dataPoint,
  isSelected,
  isLatest,
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

  // Create different marker styles for waypoints vs current position
  const markerIcon = isLatest ? {
    // Current position marker (larger, animated)
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: vehicleColor,
    fillOpacity: 1,
    strokeColor: '#0d1117',
    strokeWeight: 3,
    scale: isSelected ? 14 : 10,
  } : {
    // Waypoint marker (smaller, subtle)
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: vehicleColor,
    fillOpacity: 0.7,
    strokeColor: '#0d1117',
    strokeWeight: 1,
    scale: isSelected ? 6 : 4,
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
      animation={isSelected && isLatest ? google.maps.Animation.BOUNCE : undefined}
      zIndex={isLatest ? 1000 : (isSelected ? 500 : 100)}
    />
  );
};
