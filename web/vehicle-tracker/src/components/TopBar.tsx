import React from 'react';
import { useAppStore } from '../store';
import { motion } from 'framer-motion';
import { Info } from 'lucide-react';

export const TopBar: React.FC = () => {
  const { 
    refreshInterval, 
    setRefreshInterval, 
    isPaused, 
    setPaused,
    connectionStatus,
    selectedDataPoint,
    setSidePanelOpen,
  } = useAppStore();

  const intervalOptions = [5, 10, 30, 60];

  return (
    <motion.div 
      className="card p-4 mb-4"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-dark-text">
            Vehicle Tracker
          </h1>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus.isConnected ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-dark-muted">
              {connectionStatus.isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Info button for devices without persistent sidebar */}
          {selectedDataPoint && (
            <button
              onClick={() => setSidePanelOpen(true)}
              className="xl:hidden btn btn-secondary p-2"
              title="Show sensor details"
            >
              <Info size={16} />
            </button>
          )}
          
          <div className="hidden sm:flex items-center space-x-2">
            <label className="text-sm text-dark-muted">Refresh:</label>
            <select
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(Number(e.target.value))}
              className="input text-sm"
            >
              {intervalOptions.map(interval => (
                <option key={interval} value={interval}>
                  {interval}s
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setPaused(!isPaused)}
            className={`btn ${isPaused ? 'btn-primary' : 'btn-secondary'} text-sm px-3 py-2`}
          >
            {isPaused ? 'Resume' : 'Pause'}
          </button>
        </div>
      </div>
      
      {connectionStatus.lastUpdate && (
        <div className="mt-2 text-xs text-dark-muted">
          Last update: {connectionStatus.lastUpdate.toLocaleTimeString()}
          {connectionStatus.retryCount > 0 && (
            <span className="ml-2 text-red-400">
              (Retries: {connectionStatus.retryCount})
            </span>
          )}
        </div>
      )}
    </motion.div>
  );
};