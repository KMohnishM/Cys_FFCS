import React from 'react';

type ChartProps = {
  data: {
    label: string;
    value: number;
    color?: string;
  }[];
  title?: string;
  type: 'bar' | 'pie' | 'line';
  height?: number;
};

const AnalyticsCharts: React.FC<ChartProps> = ({ 
  data, 
  title, 
  type = 'bar', 
  height = 200
}) => {
  // Get max value for scaling
  const maxValue = Math.max(...data.map(d => d.value), 1);
  
  // Default colors if none provided
  const defaultColors = [
    'bg-cyscom',
    'bg-purple-500',
    'bg-amber-500',
    'bg-emerald-500',
    'bg-rose-500',
    'bg-indigo-500',
    'bg-lime-500',
    'bg-pink-500',
  ];
  
  if (type === 'bar') {
    return (
      <div className="cyber-chart">
        {title && <h3 className="text-sm font-medium text-slate-300 mb-2">{title}</h3>}
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="mb-2">
              <div className="flex justify-between text-xs text-slate-400 mb-1">
                <span>{item.label}</span>
                <span>{item.value}</span>
              </div>
              <div className="w-full bg-black/40 h-6 rounded-sm overflow-hidden border border-slate-800">
                <div 
                  className={`h-full ${item.color || defaultColors[index % defaultColors.length]} cyber-bar-animation`} 
                  style={{ 
                    width: `${Math.max(1, (item.value / maxValue) * 100)}%`,
                    animation: `growWidth 1s ease-out forwards, glowPulse ${1 + (index * 0.2)}s infinite alternate` 
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  if (type === 'pie') {
    // A simplified pie chart using CSS conic gradient
    const total = data.reduce((acc, item) => acc + item.value, 0);
    let currentAngle = 0;
    const segments = data.map((item, i) => {
      const startAngle = currentAngle;
      const angle = (item.value / total) * 360;
      currentAngle += angle;
      const endAngle = currentAngle;
      
      return {
        ...item,
        startAngle,
        endAngle,
        color: item.color || defaultColors[i % defaultColors.length]
      };
    });
    
    // Generate conic gradient
    const conicGradient = segments.map(segment => {
      return `${segment.color.replace('bg-', '')} ${segment.startAngle}deg ${segment.endAngle}deg`;
    }).join(', ');
    
    return (
      <div className="text-center">
        {title && <h3 className="text-sm font-medium text-slate-300 mb-2">{title}</h3>}
        <div className="flex items-center justify-center">
          <div 
            className="cyber-pie-chart relative"
            style={{
              width: height * 0.8,
              height: height * 0.8,
              borderRadius: '50%',
              background: `conic-gradient(${conicGradient})`,
              boxShadow: '0 0 15px rgba(0, 180, 216, 0.4)'
            }}
          >
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="bg-black/60 w-3/5 h-3/5 rounded-full flex items-center justify-center">
                <span className="text-xs text-white">{total}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mt-3">
          {data.map((item, i) => (
            <div key={i} className="flex items-center gap-1 text-xs">
              <div 
                className={`w-3 h-3 rounded-sm ${item.color || defaultColors[i % defaultColors.length]}`}
              ></div>
              <span className="text-slate-300">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  
  // Simple line chart (placeholder for a more complex one)
  return (
    <div>
      {title && <h3 className="text-sm font-medium text-slate-300 mb-2">{title}</h3>}
      <div className="text-xs text-slate-500 text-center py-4">
        Line chart visualization would require a more complex implementation
      </div>
    </div>
  );
};

export default AnalyticsCharts;