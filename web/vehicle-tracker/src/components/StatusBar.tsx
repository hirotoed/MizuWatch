import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../store';
import { Download, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { 
  exportToCSV, 
  exportToJSON, 
  exportAllVehiclesToCSV, 
  exportAllVehiclesToJSON 
} from '../utils/export';

export const StatusBar: React.FC = () => {
  const { 
    connectionStatus, 
    vehicleTracks, 
    selectedVehicleId,
    getSelectedVehicleData,
    refreshInterval,
    isPaused,
  } = useAppStore();

  const [isExporting, setIsExporting] = useState(false);

  const selectedVehicleData = getSelectedVehicleData();
  const totalVehicles = Object.keys(vehicleTracks).length;
  const totalDataPoints = Object.values(vehicleTracks).reduce((sum, data) => sum + data.length, 0);

  const handleExportSelected = async (format: 'csv' | 'json') => {
    if (!selectedVehicleId || selectedVehicleData.length === 0) {
      alert('No vehicle selected or no data to export');
      return;
    }

    setIsExporting(true);
    try {
      const filename = `${selectedVehicleId}-data`;
      if (format === 'csv') {
        exportToCSV(selectedVehicleData, filename);
      } else {
        exportToJSON(selectedVehicleData, filename);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async (format: 'csv' | 'json') => {
    if (totalDataPoints === 0) {
      alert('No data to export');
      return;
    }

    setIsExporting(true);
    try {
      const filename = 'all-vehicles-data';
      if (format === 'csv') {
        exportAllVehiclesToCSV(vehicleTracks, filename);
      } else {
        exportAllVehiclesToJSON(vehicleTracks, filename);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsExporting(false);
    }
  };

  const getConnectionStatusText = () => {
    if (isPaused) return 'Paused';
    if (connectionStatus.isConnected) return 'Connected';
    return 'Disconnected';
  };

  const getConnectionIcon = () => {
    if (isPaused) return <RefreshCw size={16} className="text-yellow-400" />;
    if (connectionStatus.isConnected) return <Wifi size={16} className="text-green-400" />;
    return <WifiOff size={16} className="text-red-400" />;
  };

  return (
    <motion.div 
      className="card p-4 mt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.2 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-6">
          {/* Connection Status */}
          <div className="flex items-center space-x-2">
            {getConnectionIcon()}
            <span className="text-sm text-dark-muted">
              {getConnectionStatusText()}
            </span>
            {!isPaused && (
              <span className="text-xs text-dark-muted">
                ({refreshInterval}s interval)
              </span>
            )}
          </div>

          {/* Data Stats */}
          <div className="flex items-center space-x-4">
            <div className="text-sm text-dark-muted">
              <span className="font-medium text-dark-text">{totalVehicles}</span> vehicles
            </div>
            <div className="text-sm text-dark-muted">
              <span className="font-medium text-dark-text">{totalDataPoints}</span> data points
            </div>
            {selectedVehicleId && (
              <div className="text-sm text-dark-muted">
                <span className="font-medium text-dark-accent">{selectedVehicleData.length}</span> selected
              </div>
            )}
          </div>
        </div>

        {/* Export Controls */}
        <div className="flex items-center space-x-2">
          {selectedVehicleId && selectedVehicleData.length > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-dark-muted mr-2">Export Selected:</span>
              <button
                onClick={() => handleExportSelected('csv')}
                disabled={isExporting}
                className="btn-secondary text-xs px-2 py-1 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExportSelected('json')}
                disabled={isExporting}
                className="btn-secondary text-xs px-2 py-1 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>JSON</span>
              </button>
            </div>
          )}

          {totalDataPoints > 0 && (
            <div className="flex items-center space-x-1">
              <span className="text-xs text-dark-muted mr-2">Export All:</span>
              <button
                onClick={() => handleExportAll('csv')}
                disabled={isExporting}
                className="btn-secondary text-xs px-2 py-1 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>CSV</span>
              </button>
              <button
                onClick={() => handleExportAll('json')}
                disabled={isExporting}
                className="btn-secondary text-xs px-2 py-1 flex items-center space-x-1"
              >
                <Download size={12} />
                <span>JSON</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Last Update Time */}
      {connectionStatus.lastUpdate && (
        <div className="mt-2 text-xs text-dark-muted">
          Last update: {connectionStatus.lastUpdate.toLocaleString()}
          {connectionStatus.retryCount > 0 && (
            <span className="ml-2 text-red-400">
              (Failed attempts: {connectionStatus.retryCount})
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};