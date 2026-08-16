import { useEffect } from 'react';
import { TopBar } from './components/TopBar';
import { VehicleTabs } from './components/VehicleTabs';
import { ViewToggle } from './components/ViewToggle';
import { MapContainer } from './components/MapContainer';
import { SensorGraphs } from './components/SensorGraphs';
import { SidePanel } from './components/SidePanel';
import { StatusBar } from './components/StatusBar';
import { useVehicleData } from './hooks/useVehicleData';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useAppStore } from './store';

function App() {
  const { vehicleTracks, error, isLoading } = useVehicleData();
  const { setSelectedVehicle, selectedVehicleId, getVehicleIds, currentView } = useAppStore();

  // Enable keyboard shortcuts
  useKeyboardShortcuts();

  // Auto-select first vehicle when data loads
  useEffect(() => {
    const vehicleIds = getVehicleIds();
    if (vehicleIds.length > 0 && !selectedVehicleId) {
      setSelectedVehicle(vehicleIds[0]);
    }
  }, [vehicleTracks, selectedVehicleId, setSelectedVehicle, getVehicleIds]);

  return (
    <div className="min-h-screen bg-dark-bg">
      <div className="h-screen flex flex-col max-w-full">
        {/* Header section */}
        <div className="flex-shrink-0 p-2 sm:p-4 pb-0">
          <TopBar />
          <div className="flex items-center justify-between mb-2 lg:mb-4">
            <div className="flex-1">
              <VehicleTabs />
            </div>
            <div className="ml-4">
              <ViewToggle />
            </div>
          </div>
        </div>
        
        {/* Main content area */}
        <div className="flex-1 flex p-2 sm:p-4 pt-1 sm:pt-2 gap-2 sm:gap-4 min-h-0 overflow-hidden">
          <div className="flex-1 min-w-0 min-h-0">
            {currentView === 'map' ? <MapContainer /> : <SensorGraphs />}
          </div>
          
          {/* Side panel with responsive width - only show for map view */}
          {currentView === 'map' && (
            <div className="hidden xl:block w-80 2xl:w-96 flex-shrink-0">
              <SidePanel isDesktop={true} />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex-shrink-0 p-2 sm:p-4 pt-0">
          <StatusBar />
        </div>
        
        {/* Mobile/tablet side panel as overlay - only show for map view */}
        {currentView === 'map' && (
          <div className="xl:hidden">
            <SidePanel isDesktop={false} />
          </div>
        )}
        
        {/* Loading overlay */}
        {isLoading && Object.keys(vehicleTracks).length === 0 && (
          <div className="fixed inset-0 bg-dark-bg/80 flex items-center justify-center z-50">
            <div className="card p-8 text-center">
              <div className="animate-spin w-12 h-12 border-2 border-dark-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <div className="text-dark-text">Loading vehicle data...</div>
            </div>
          </div>
        )}
        
        {/* Error state */}
        {error && Object.keys(vehicleTracks).length === 0 && (
          <div className="fixed inset-0 bg-dark-bg/80 flex items-center justify-center z-50">
            <div className="card p-8 text-center max-w-md">
              <div className="text-red-400 mb-4">Failed to load data</div>
              <div className="text-dark-muted text-sm mb-4">
                {error.message || 'Unknown error occurred'}
              </div>
              <div className="text-dark-muted text-xs">
                The configured vehicle data source could not provide vehicle data.
              </div>
            </div>
          </div>
        )}
        
        {/* Help overlay */}
        <div className="fixed bottom-2 left-2 text-xs text-dark-muted">
          <div>Shortcuts: [/] switch tabs • P pause • E export • ESC close panel</div>
        </div>
      </div>
    </div>
  );
}

export default App;
