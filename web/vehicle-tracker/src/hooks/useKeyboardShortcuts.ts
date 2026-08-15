import { useEffect } from 'react';
import { useAppStore } from '../store';
import { exportAllVehiclesToCSV } from '../utils/export';

export function useKeyboardShortcuts() {
  const { 
    vehicleTracks,
    selectedVehicleId,
    setSelectedVehicle,
    setPaused,
    isPaused,
    getVehicleIds,
  } = useAppStore();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement || 
          event.target instanceof HTMLSelectElement) {
        return;
      }

      const vehicleIds = getVehicleIds();
      const currentIndex = selectedVehicleId ? vehicleIds.indexOf(selectedVehicleId) : -1;

      switch (event.key) {
        case '[':
        case 'ArrowLeft':
          event.preventDefault();
          if (vehicleIds.length > 0) {
            const prevIndex = currentIndex <= 0 ? vehicleIds.length - 1 : currentIndex - 1;
            setSelectedVehicle(vehicleIds[prevIndex]);
          }
          break;

        case ']':
        case 'ArrowRight':
          event.preventDefault();
          if (vehicleIds.length > 0) {
            const nextIndex = currentIndex >= vehicleIds.length - 1 ? 0 : currentIndex + 1;
            setSelectedVehicle(vehicleIds[nextIndex]);
          }
          break;

        case 'p':
        case 'P':
          if (event.ctrlKey || event.metaKey) return; // Don't interfere with Ctrl+P (print)
          event.preventDefault();
          setPaused(!isPaused);
          break;

        case 'e':
        case 'E':
          if (event.ctrlKey || event.metaKey) return; // Don't interfere with Ctrl+E
          event.preventDefault();
          if (Object.keys(vehicleTracks).length > 0) {
            try {
              exportAllVehiclesToCSV(vehicleTracks);
            } catch (error) {
              console.error('Export failed:', error);
            }
          }
          break;

        case 'Escape':
          event.preventDefault();
          useAppStore.getState().setSidePanelOpen(false);
          break;

        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9': {
          event.preventDefault();
          const index = parseInt(event.key) - 1;
          if (vehicleIds[index]) {
            setSelectedVehicle(vehicleIds[index]);
          }
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedVehicleId, vehicleTracks, isPaused, setSelectedVehicle, setPaused, getVehicleIds]);
}