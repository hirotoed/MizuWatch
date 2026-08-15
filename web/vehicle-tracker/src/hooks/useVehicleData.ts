import useSWR from 'swr';
import { getAllVehicles, GASApiError } from '../api/gas';
import { useAppStore } from '../store';
import type { VehicleTracks } from '../types';
import { useEffect } from 'react';

export function useVehicleData() {
  const { 
    refreshInterval, 
    isPaused, 
    setVehicleTracks, 
    setConnectionStatus,
    vehicleTracks 
  } = useAppStore();

  const { data, error, isLoading, mutate } = useSWR<VehicleTracks>(
    isPaused ? null : 'vehicle-data',
    getAllVehicles,
    {
      refreshInterval: refreshInterval * 1000,
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      onSuccess: (data) => {
        setVehicleTracks(data);
        setConnectionStatus({
          isConnected: true,
          lastUpdate: new Date(),
          retryCount: 0,
        });
      },
      onError: (error: GASApiError) => {
        console.error('Failed to fetch vehicle data:', error);
        setConnectionStatus({
          isConnected: false,
          retryCount: (useAppStore.getState().connectionStatus.retryCount || 0) + 1,
        });
      },
    }
  );

  // Check for disconnection based on last update time
  useEffect(() => {
    const checkConnection = () => {
      const { connectionStatus } = useAppStore.getState();
      if (connectionStatus.lastUpdate) {
        const timeSinceUpdate = Date.now() - connectionStatus.lastUpdate.getTime();
        const threshold = refreshInterval * 3 * 1000; // 3x refresh interval
        
        if (timeSinceUpdate > threshold && connectionStatus.isConnected) {
          setConnectionStatus({ isConnected: false });
        }
      }
    };

    const interval = setInterval(checkConnection, 1000);
    return () => clearInterval(interval);
  }, [refreshInterval, setConnectionStatus]);

  return {
    vehicleTracks: data || vehicleTracks,
    error,
    isLoading,
    refetch: mutate,
  };
}
