import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAppStore } from '../store';
import { X } from 'lucide-react';
import type { TelemetryDataPoint } from '../types';

interface SidePanelProps {
  isDesktop?: boolean;
}

export const SidePanel: React.FC<SidePanelProps> = ({ isDesktop = false }) => {
  const { 
    selectedDataPoint, 
    isSidePanelOpen, 
    setSidePanelOpen,
  } = useAppStore();

  if (!selectedDataPoint || (!isDesktop && !isSidePanelOpen)) return null;

  if (isDesktop) {
    // Desktop: Static side panel
    return (
      <div className="h-full bg-dark-surface border border-dark-muted/20 rounded-lg overflow-y-auto">
        <div className="p-4 lg:p-6">
          <div className="flex items-center justify-between mb-4 lg:mb-6">
            <h2 className="text-base lg:text-lg font-semibold text-dark-text">
              Sensor Details
            </h2>
          </div>
          <SidePanelContent selectedDataPoint={selectedDataPoint} />
        </div>
      </div>
    );
  }

  // Mobile: Overlay panel
  return (
    <AnimatePresence>
      {isSidePanelOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          className="fixed right-0 top-0 h-full w-full sm:w-96 bg-dark-surface border-l border-dark-muted/20 shadow-2xl z-50 overflow-y-auto"
        >
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-dark-text">
                Sensor Details
              </h2>
              <button
                onClick={() => setSidePanelOpen(false)}
                className="p-2 rounded-inner hover:bg-dark-bg transition-colors"
              >
                <X size={20} className="text-dark-muted" />
              </button>
            </div>
            <SidePanelContent selectedDataPoint={selectedDataPoint} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// Extracted content component to avoid duplication
const SidePanelContent: React.FC<{ selectedDataPoint: TelemetryDataPoint }> = ({ selectedDataPoint }) => (
  <div className="space-y-6">
    {/* Vehicle Info */}
    <div className="card p-4">
      <h3 className="font-medium text-dark-text mb-3">Vehicle Information</h3>
      <div className="space-y-2">
        <div className="flex justify-between">
          <span className="text-dark-muted">Vehicle ID:</span>
          <span className="font-mono text-dark-text">{selectedDataPoint.vehicleId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-dark-muted">Timestamp:</span>
          <span className="font-mono text-dark-text text-sm">
            {new Date(selectedDataPoint.timestamp).toLocaleString()}
          </span>
        </div>
      </div>
    </div>

    {/* GPS Data */}
    <div className="card p-4">
      <h3 className="font-medium text-dark-text mb-3">GPS Data</h3>
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-dark-muted">Latitude:</span>
          <span className="font-mono text-dark-text">
            {selectedDataPoint.latitude.toFixed(6)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dark-muted">Longitude:</span>
          <span className="font-mono text-dark-text">
            {selectedDataPoint.longitude.toFixed(6)}°
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dark-muted">Altitude:</span>
          <span className="font-mono text-dark-text">
            {selectedDataPoint.altitude == null
              ? 'データなし'
              : `${selectedDataPoint.altitude.toFixed(1)} m`}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-dark-muted">Satellites:</span>
          <span className="font-mono text-dark-text">
            {selectedDataPoint.satellites == null
              ? 'データなし'
              : selectedDataPoint.satellites}
          </span>
        </div>
      </div>
    </div>

    {/* Sensor Data */}
    <div className="card p-4">
      <h3 className="font-medium text-dark-text mb-3">Sensor Readings</h3>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-dark-muted">Water Temperature:</span>
          <div className="text-right">
            <span className="font-mono text-dark-text text-lg">
              {selectedDataPoint.waterTemperature.toFixed(1)}°C
            </span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-dark-muted">Air Pressure:</span>
          <div className="text-right">
            <span className="font-mono text-dark-text text-lg">
              {selectedDataPoint.airPressure.toFixed(2)}
            </span>
            <span className="text-dark-muted text-sm ml-1">hPa</span>
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-dark-muted">Air Temperature:</span>
          <div className="text-right">
            <span className="font-mono text-dark-text text-lg">
              {selectedDataPoint.airTemperature.toFixed(1)}°C
            </span>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-dark-muted">Humidity:</span>
          <div className="text-right">
            <span className="font-mono text-dark-text text-lg">
              {selectedDataPoint.humidity == null
                ? 'データなし'
                : `${selectedDataPoint.humidity.toFixed(1)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>

    {/* Raw Data */}
    <div className="card p-4">
      <h3 className="font-medium text-dark-text mb-3">Raw Data</h3>
      <pre className="text-xs font-mono text-dark-muted bg-dark-bg p-3 rounded-inner overflow-x-auto">
        {JSON.stringify(selectedDataPoint, null, 2)}
      </pre>
    </div>
  </div>
);
