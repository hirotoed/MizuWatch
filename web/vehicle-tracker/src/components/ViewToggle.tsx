import React from 'react';
import { MapPin, BarChart3 } from 'lucide-react';
import { useAppStore } from '../store';
import { motion } from 'framer-motion';

export const ViewToggle: React.FC = () => {
  const { currentView, setCurrentView } = useAppStore();

  const toggleView = (view: 'map' | 'graphs') => {
    setCurrentView(view);
  };

  return (
    <div className="flex bg-dark-surface border border-dark-muted/30 rounded-card p-1">
      <motion.button
        onClick={() => toggleView('map')}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-card transition-all duration-150 text-sm font-medium
          ${currentView === 'map' 
            ? 'bg-dark-accent text-white shadow-sm' 
            : 'text-dark-muted hover:text-dark-text hover:bg-dark-muted/10'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <MapPin size={16} />
        Map
      </motion.button>
      
      <motion.button
        onClick={() => toggleView('graphs')}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-card transition-all duration-150 text-sm font-medium
          ${currentView === 'graphs' 
            ? 'bg-dark-accent text-white shadow-sm' 
            : 'text-dark-muted hover:text-dark-text hover:bg-dark-muted/10'
          }
        `}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <BarChart3 size={16} />
        Graphs
      </motion.button>
    </div>
  );
};