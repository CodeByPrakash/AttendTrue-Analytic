import { Doughnut } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function DepartmentPieChart({ data }) {
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        label: 'Total Attendances',
        data: data.map(item => item.count),
        backgroundColor: [
          'rgba(99, 102, 241, 0.85)', // primary indigo
          'rgba(6, 182, 212, 0.85)',  // cyan
          'rgba(59, 130, 246, 0.85)', // blue
          'rgba(34, 197, 94, 0.85)',  // green
          'rgba(251, 191, 36, 0.85)', // amber
        ],
        borderColor: 'rgba(255, 255, 255, 0.9)',
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          color: 'rgb(var(--foreground-rgb))'
        }
      },
      title: {
        display: true,
        text: 'Attendance by Department',
        color: 'rgb(var(--foreground-rgb))',
        font: {
          size: 18
        }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 17, 25, 0.9)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
      }
    },
    cutout: '55%'
  };

  return <Doughnut data={chartData} options={options} />;
}
