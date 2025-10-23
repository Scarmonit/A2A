import React from 'react';

interface MetricsCardProps {
  title: string;
  value: string | number | undefined;
  icon?: string;
  color?: string;
  subtitle?: string;
}

export const MetricsCard: React.FC<MetricsCardProps> = ({ 
  title, 
  value, 
  icon = '📊', 
  color = 'border-blue-500',
  subtitle
}) => {
  const displayValue = value !== undefined && value !== null ? value : 'N/A';

  return (
    <div className={`bg-gray-800 rounded-lg p-6 border-2 ${color} shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-gray-400 text-sm uppercase tracking-wide font-medium">{title}</p>
          <p className="text-3xl font-bold mt-2 text-white">{displayValue}</p>
          {subtitle && (
            <p className="text-gray-500 text-xs mt-1">{subtitle}</p>
          )}
        </div>
        <div className="text-4xl ml-4">{icon}</div>
      </div>
    </div>
  );
};
