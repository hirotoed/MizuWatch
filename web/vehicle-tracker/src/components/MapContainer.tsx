import React, { useCallback, useEffect, useState } from 'react';
import { GoogleMap, useJsApiLoader } from '@react-google-maps/api';
import { useAppStore } from '../store';
import { DEFAULT_MAP_OPTIONS, DEFAULT_CENTER } from '../constants/map';
import { VehicleMarker } from './VehicleMarker';
import { WaypointMarker } from './WaypointMarker';
import { TrackPolyline } from './TrackPolyline';

const GOOGLE_MAPS_LIBRARIES: ("places" | "geometry" | "drawing" | "visualization")[] = [];
const MAX_WAYPOINT_MARKERS = 100;

export const MapContainer: React.FC = () => {
  const { 
    selectedVehicleId, 
    vehicleTracks, 
    mapCenter, 
    mapZoom, 
    getLatestDataPoint,
  } = useAppStore();

  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GMAPS_API_KEY || '',
    libraries: GOOGLE_MAPS_LIBRARIES,
  });


  // Auto-center on selected vehicle's latest position
  useEffect(() => {
    if (selectedVehicleId && map) {
      const latestPoint = getLatestDataPoint(selectedVehicleId);
      if (latestPoint) {
        const center = {
          lat: latestPoint.latitude,
          lng: latestPoint.longitude,
        };
        map.panTo(center);
      }
    }
  }, [selectedVehicleId, map, getLatestDataPoint]);

  // Auto-center on first vehicle when data loads
  useEffect(() => {
    if (!selectedVehicleId && Object.keys(vehicleTracks).length > 0 && map) {
      const firstVehicleId = Object.keys(vehicleTracks)[0];
      const latestPoint = getLatestDataPoint(firstVehicleId);
      if (latestPoint) {
        const center = {
          lat: latestPoint.latitude,
          lng: latestPoint.longitude,
        };
        map.panTo(center);
      }
    }
  }, [vehicleTracks, selectedVehicleId, map, getLatestDataPoint]);

  const onLoad = useCallback((map: google.maps.Map) => {
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    setMap(null);
  }, []);



  if (loadError) {
    return (
      <div className="card p-8 flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-2">Failed to load Google Maps</div>
          <div className="text-dark-muted text-sm">
            Please check your API key configuration
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="card p-8 flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-dark-accent border-t-transparent rounded-full mx-auto mb-2"></div>
          <div className="text-dark-muted">Loading map...</div>
        </div>
      </div>
    );
  }

  const selectedLatestPoint = selectedVehicleId
    ? getLatestDataPoint(selectedVehicleId)
    : null;
  const currentCenter = mapCenter
    || (selectedLatestPoint
      ? { lat: selectedLatestPoint.latitude, lng: selectedLatestPoint.longitude }
      : DEFAULT_CENTER);

  return (
    <div className="card overflow-hidden w-full h-full relative">
      <GoogleMap
        mapContainerStyle={{ 
          width: '100%', 
          height: '100%',
          display: 'block'
        }}
        center={currentCenter}
        zoom={mapZoom}
        onLoad={onLoad}
        onUnmount={onUnmount}
        options={DEFAULT_MAP_OPTIONS}
      >
        {/* Render polylines for all vehicles */}
        {Object.entries(vehicleTracks).map(([vehicleId, data]) => (
          <TrackPolyline
            key={vehicleId}
            vehicleId={vehicleId}
            data={data}
            isSelected={vehicleId === selectedVehicleId}
          />
        ))}

        {/* Render markers for latest positions only */}
        {Object.entries(vehicleTracks).map(([vehicleId, data]) => {
          const latestPoint = data[data.length - 1];
          if (!latestPoint) return null;
          
          return (
            <VehicleMarker
              key={vehicleId}
              vehicleId={vehicleId}
              dataPoint={latestPoint}
              isSelected={vehicleId === selectedVehicleId}
            />
          );
        })}

        {/* Render additional waypoint markers for selected vehicle only */}
        {selectedVehicleId && vehicleTracks[selectedVehicleId] && (() => {
          const historicalPoints = vehicleTracks[selectedVehicleId].slice(0, -1);
          const sampleStep = Math.max(1, Math.ceil(historicalPoints.length / MAX_WAYPOINT_MARKERS));
          return historicalPoints
            .filter((_, index) => index % sampleStep === 0 || index === historicalPoints.length - 1)
            .map((dataPoint, index) => (
              <WaypointMarker
                key={`${selectedVehicleId}-waypoint-${index}`}
                vehicleId={selectedVehicleId}
                dataPoint={dataPoint}
                isSelected={true}
                isLatest={false}
              />
            ));
        })()}
      </GoogleMap>
    </div>
  );
};
