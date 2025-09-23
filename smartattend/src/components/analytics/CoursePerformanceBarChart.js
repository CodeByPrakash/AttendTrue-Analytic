import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function CoursePerformanceBarChart({ data }) {
  const chartData = {
    labels: data.map(item => item.courseName),
    datasets: [
      {
        label: 'Overall Attendance Rate (%)',
        data: data.map(item => {
          const totalPossible = item.totalStudentsInCourse * item.totalSessions;
          return totalPossible > 0 ? ((item.presentCount / totalPossible) * 100).toFixed(1) : 0;
        }),
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgba(99, 102, 241, 1)',
        borderWidth: 2,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    indexAxis: 'y', // Horizontal bar chart
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: 'Attendance Rate by Course',
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
    scales: {
      x: {
        ticks: { color: 'rgb(var(--foreground-rgb))' },
        grid: { color: 'rgba(var(--foreground-rgb), 0.08)' },
        max: 100,
      },
      y: {
        ticks: { color: 'rgb(var(--foreground-rgb))' },
        grid: { color: 'rgba(var(--foreground-rgb), 0.08)' },
      },
    },
  };

  return <Bar data={chartData} options={options} />;
}
