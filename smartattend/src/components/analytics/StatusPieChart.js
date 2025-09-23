import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Users, Clock, UserX, CheckCircle } from 'lucide-react';

const COLORS = {
  present: 'var(--success)',
  late: 'var(--warning)', 
  absent: 'var(--error)',
  excused: 'var(--info)'
};

const GRADIENTS = {
  present: 'url(#presentGradient)',
  late: 'url(#lateGradient)',
  absent: 'url(#absentGradient)',
  excused: 'url(#excusedGradient)'
};

const STATUS_ICONS = {
  present: CheckCircle,
  late: Clock,
  absent: UserX,
  excused: Users
};

export default function StatusPieChart({ data, title = "Attendance Breakdown" }) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  // Transform data for recharts
  const chartData = data.map(item => ({
    name: item._id,
    value: item.count,
    percentage: ((item.count / data.reduce((sum, d) => sum + d.count, 0)) * 100).toFixed(1)
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0];
      return (
        <motion.div
          className="custom-tooltip"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          <div className="tooltip-header">
            <span className="tooltip-label">{data.payload.name}</span>
          </div>
          <div className="tooltip-content">
            <span className="tooltip-value">{data.value} students</span>
            <span className="tooltip-percentage">({data.payload.percentage}%)</span>
          </div>
        </motion.div>
      );
    }
    return null;
  };

  const CustomLegend = ({ payload }) => {
    return (
      <div className="custom-legend">
        {payload.map((entry, index) => {
          const Icon = STATUS_ICONS[entry.value] || Users;
          return (
            <motion.div
              key={`legend-${index}`}
              className="legend-item"
              initial={{ opacity: 0, x: -20 }}
              animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
              transition={{ delay: index * 0.1 + 0.5, duration: 0.4 }}
              whileHover={{ scale: 1.05 }}
            >
              <div className="legend-icon" style={{ color: entry.color }}>
                <Icon size={16} />
              </div>
              <span className="legend-label">{entry.value}</span>
              <span className="legend-value">
                {chartData.find(d => d.name === entry.value)?.value || 0}
              </span>
            </motion.div>
          );
        })}
      </div>
    );
  };

  const AnimatedPie = ({ ...props }) => (
    <motion.div
      initial={{ scale: 0, rotate: -180 }}
      animate={inView ? { scale: 1, rotate: 0 } : { scale: 0, rotate: -180 }}
      transition={{ duration: 1, ease: "backOut" }}
    >
      <Pie {...props} />
    </motion.div>
  );

  return (
    <motion.div
      ref={ref}
      className="status-pie-chart"
      initial={{ opacity: 0, y: 50 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <motion.div
        className="chart-header"
        initial={{ opacity: 0, y: -20 }}
        animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: -20 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <h3 className="chart-title">{title}</h3>
        <div className="total-count">
          <Users size={20} />
          <span>{data.reduce((sum, item) => sum + item.count, 0)} Total</span>
        </div>
      </motion.div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height={350}>
          <PieChart>
            <defs>
              <linearGradient id="presentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(34, 197, 94, 0.8)" />
                <stop offset="100%" stopColor="rgba(34, 197, 94, 0.4)" />
              </linearGradient>
              <linearGradient id="lateGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(251, 191, 36, 0.8)" />
                <stop offset="100%" stopColor="rgba(251, 191, 36, 0.4)" />
              </linearGradient>
              <linearGradient id="absentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(239, 68, 68, 0.8)" />
                <stop offset="100%" stopColor="rgba(239, 68, 68, 0.4)" />
              </linearGradient>
              <linearGradient id="excusedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="rgba(59, 130, 246, 0.8)" />
                <stop offset="100%" stopColor="rgba(59, 130, 246, 0.4)" />
              </linearGradient>
            </defs>
            
            <AnimatedPie
              data={chartData}
              cx="50%"
              cy="50%"
              startAngle={90}
              endAngle={450}
              innerRadius={60}
              outerRadius={120}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={1500}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={GRADIENTS[entry.name] || COLORS[entry.name] || '#8884d8'}
                  stroke="rgba(255, 255, 255, 0.3)"
                  strokeWidth={2}
                />
              ))}
            </AnimatedPie>
            
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <style jsx>{`
        .status-pie-chart {
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 2rem;
          box-shadow: var(--shadow-elegant);
          position: relative;
          overflow: hidden;
        }

        .status-pie-chart::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, 
            rgba(var(--primary-rgb), 0.05), 
            rgba(var(--secondary-rgb), 0.02)
          );
          border-radius: 20px;
          pointer-events: none;
        }

        .chart-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          position: relative;
          z-index: 2;
        }

        .chart-title {
          margin: 0;
          font-size: 1.5rem;
          font-weight: 600;
          color: rgb(var(--foreground-rgb));
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .total-count {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 20px;
          color: rgb(var(--foreground-rgb));
          font-weight: 500;
          border: 1px solid rgba(var(--primary-rgb), 0.2);
        }

        .chart-container {
          position: relative;
          z-index: 2;
        }

        .custom-tooltip {
          background: var(--glass-bg-dark);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 1rem;
          box-shadow: var(--shadow-elegant);
          color: rgb(var(--foreground-rgb));
        }

        .tooltip-header {
          margin-bottom: 0.5rem;
        }

        .tooltip-label {
          font-weight: 600;
          text-transform: capitalize;
        }

        .tooltip-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .tooltip-value {
          font-weight: 500;
        }

        .tooltip-percentage {
          color: var(--text-muted);
          font-size: 0.9rem;
        }

        .custom-legend {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          margin-top: 2rem;
          position: relative;
          z-index: 2;
        }

        .legend-item {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1rem;
          background: var(--glass-bg-light);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .legend-item:hover {
          background: var(--glass-bg);
          transform: translateY(-2px);
          box-shadow: var(--shadow-soft);
        }

        .legend-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 8px;
        }

        .legend-label {
          flex: 1;
          font-weight: 500;
          text-transform: capitalize;
          color: rgb(var(--foreground-rgb));
        }

        .legend-value {
          font-weight: 600;
          color: var(--primary);
        }

        @media (max-width: 768px) {
          .status-pie-chart {
            padding: 1.5rem;
          }

          .chart-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
          }

          .chart-title {
            font-size: 1.25rem;
          }

          .custom-legend {
            grid-template-columns: 1fr;
            gap: 0.75rem;
          }

          .legend-item {
            padding: 0.5rem 0.75rem;
          }
        }
      `}</style>
    </motion.div>
  );
}
