import React from 'react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts';
import { useAppStore } from '../store';
import type { TelemetryDataPoint } from '../types';

interface ChartData {
  timestamp: string;
  time: string;
  waterTemperature: number;
  airTemperature: number;
  airPressure: number;
  altitude: number | null;
  satellites: number | null;
}

export const SensorGraphs: React.FC = () => {
  const { selectedVehicleId, getSelectedVehicleData, hasViewedGraphs } = useAppStore();
  const vehicleData = getSelectedVehicleData();

  if (!selectedVehicleId || vehicleData.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-dark-muted">
          <div className="text-lg mb-2">No Data Available</div>
          <div className="text-sm">
            {!selectedVehicleId 
              ? 'Select a vehicle to view sensor graphs' 
              : 'No sensor data found for this vehicle'
            }
          </div>
        </div>
      </div>
    );
  }

  const chartData: ChartData[] = vehicleData.map((point: TelemetryDataPoint) => ({
    timestamp: point.timestamp,
    time: new Date(point.timestamp).toLocaleTimeString(),
    waterTemperature: point.waterTemperature,
    airTemperature: point.airTemperature,
    airPressure: point.airPressure,
    altitude: point.altitude ?? null,
    satellites: point.satellites ?? null,
  }));

  const chartConfig = {
    margin: { top: 5, right: 30, left: 20, bottom: 5 },
    className: "text-dark-text",
  };

  const tooltipStyle = {
    backgroundColor: '#1F2937',
    border: '1px solid #374151',
    borderRadius: '8px',
    color: '#F3F4F6'
  };

  const axisStyle = {
    stroke: "#9CA3AF",
    fontSize: 10,
    tick: { fill: '#9CA3AF', fontSize: 10 }
  };

  const ChartWrapper = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div className="card p-3">
      <h3 className="text-sm sm:text-base font-medium text-dark-text mb-2 sm:mb-3">{title}</h3>
      <div className="h-32 sm:h-40 md:h-48 lg:h-56 xl:h-64">
        {children}
      </div>
    </div>
  );

  return (
    <div className="h-full p-2 sm:p-4 overflow-y-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-3 sm:mb-4">
        <h2 className="text-lg sm:text-xl font-semibold text-dark-text mb-1 sm:mb-0">
          Sensor Data - {selectedVehicleId}
        </h2>
        <div className="text-xs sm:text-sm text-dark-muted">
          {vehicleData.length} data points
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Temperature Chart */}
        <ChartWrapper title="Temperature (°C)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} {...chartConfig}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" {...axisStyle} />
              <YAxis {...axisStyle} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9CA3AF' }} />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="waterTemperature" 
                stroke="#06B6D4" 
                strokeWidth={2}
                name="Water Temperature"
                dot={false}
                isAnimationActive={!hasViewedGraphs}
              />
              <Line 
                type="monotone" 
                dataKey="airTemperature" 
                stroke="#F59E0B" 
                strokeWidth={2}
                name="Air Temperature"
                dot={false}
                isAnimationActive={!hasViewedGraphs}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>

        {/* Air Pressure Chart */}
        <ChartWrapper title="Air Pressure (hPa)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} {...chartConfig}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" {...axisStyle} />
              <YAxis {...axisStyle} domain={['dataMin - 5', 'dataMax + 5']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9CA3AF' }} />
              <Line 
                type="monotone" 
                dataKey="airPressure" 
                stroke="#10B981" 
                strokeWidth={2}
                name="Air Pressure"
                dot={false}
                isAnimationActive={!hasViewedGraphs}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>

        {/* Altitude Chart */}
        <ChartWrapper title="Altitude (m)">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} {...chartConfig}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" {...axisStyle} />
              <YAxis {...axisStyle} domain={['dataMin - 1', 'dataMax + 1']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9CA3AF' }} />
              <Line 
                type="monotone" 
                dataKey="altitude" 
                stroke="#8B5CF6" 
                strokeWidth={2}
                name="Altitude"
                dot={false}
                isAnimationActive={!hasViewedGraphs}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>

        {/* Satellites Chart */}
        <ChartWrapper title="GPS Satellites">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} {...chartConfig}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="time" {...axisStyle} />
              <YAxis {...axisStyle} domain={[0, 'dataMax + 2']} />
              <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: '#9CA3AF' }} />
              <Line 
                type="stepAfter" 
                dataKey="satellites" 
                stroke="#EF4444" 
                strokeWidth={2}
                name="Satellites"
                dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
                isAnimationActive={!hasViewedGraphs}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartWrapper>
      </div>
    </div>
  );
};
