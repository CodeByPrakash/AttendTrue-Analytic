import { Pie } from 'react-chartjs-2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';

ChartJS.register(ArcElement, Tooltip, Legend);

export default function SubjectPieChart({ data }) {
  const chartData = {
    labels: data.map(item => item.name),
    datasets: [
      {
        label: 'Sessions Attended',
        data: data.map(item => item.attended),
        backgroundColor: [
          'rgba(99, 102, 241, 0.85)',
          'rgba(6, 182, 212, 0.85)',
          'rgba(59, 130, 246, 0.85)',
          'rgba(34, 197, 94, 0.85)',
          'rgba(251, 191, 36, 0.85)',
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
        position: 'top',
        labels: {
          color: 'rgb(var(--foreground-rgb))'
        }
      },
      title: {
        display: true,
        text: 'Attendance by Subject',
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
    cutout: '50%'
  };

  return <Pie data={chartData} options={options} />;
}
