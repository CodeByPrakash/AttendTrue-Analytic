// src/components/analytics/HistoryGraph.js
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

export default function HistoryGraph({ data }) {
  const chartData = {
    labels: data.map(item => item.sessionName),
    datasets: [
      {
        label: 'Attendance',
        data: data.map(item => (item.attended ? 1 : 0)), // 1 for attended, 0 for missed
        fill: false,
        borderColor: 'rgba(99, 102, 241, 1)',
        backgroundColor: 'rgba(99, 102, 241, 0.2)',
        pointBackgroundColor: 'rgba(99, 102, 241, 1)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.25,
      },
    ],
  };

  const options = {
    scales: {
      x: {
        ticks: { color: 'rgb(var(--foreground-rgb))' },
        grid: { color: 'rgba(var(--foreground-rgb), 0.08)' },
      },
      y: {
        ticks: {
          color: 'rgb(var(--foreground-rgb))',
          callback: function(value) {
            if (value === 1) return 'Present';
            if (value === 0) return 'Absent';
            return null;
          }
        },
        grid: { color: 'rgba(var(--foreground-rgb), 0.08)' },
        max: 1.1,
        min: -0.1,
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 17, 25, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
      }
    },
  };

  const containerStyles = {
    backgroundColor: 'var(--glass-bg)',
    border: '1px solid var(--glass-border)',
    borderRadius: '16px',
    padding: '1.5rem',
  };

  return (
    <div style={containerStyles}>
      <h3 style={{marginBottom: '1rem', color: 'rgb(var(--foreground-rgb))'}}>Recent Session History</h3>
      <Line data={chartData} options={options} />
    </div>
  );
}
