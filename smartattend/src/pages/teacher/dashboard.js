import { useSession, getSession, signOut } from 'next-auth/react';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import StatusPieChart from '../../components/analytics/StatusPieChart';
import CoursePerformanceBarChart from '../../components/analytics/CoursePerformanceBarChart';

export default function TeacherDashboard() {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status]);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch('/api/teacher/analytics');
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return <div>Loading...</div>;
  }

  if (!session || session.user.role !== 'teacher') {
    return <div>Access denied</div>;
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Teacher Dashboard</h1>
        <div className="flex gap-4">
          <Link href="/teacher/create-session" className="btn btn-primary">
            Create Session
          </Link>
          <button 
            onClick={() => signOut()} 
            className="btn btn-secondary"
          >
            Sign Out
          </button>
        </div>
      </div>

      {analytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem', marginTop: '2rem', alignItems: 'flex-start' }}>
            <div className="glass-card">
              <h2>Course Performance</h2>
              {analytics.attendanceByCourse?.length > 0 ? (
                <CoursePerformanceBarChart data={analytics.attendanceByCourse} />
              ) : (
                <p>No attendance data available yet.</p>
              )}
            </div>
            <div className="glass-card">
              <h2>Status Breakdown</h2>
              {analytics.statusBreakdown?.length > 0 ? (
                <StatusPieChart data={analytics.statusBreakdown} />
              ) : (
                <p>No status data available yet.</p>
              )}
            </div>
          </div>

          <div style={{ marginTop: '3rem' }}>
            <h2>At-Risk Students (&lt;75% Attendance)</h2>
            {analytics.atRiskStudents?.length > 0 ? (
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '2px solid #ddd'}}>
                    <th style={{padding: '8px', textAlign: 'left'}}>Student Name</th>
                    <th style={{padding: '8px', textAlign: 'left'}}>Course</th>
                    <th style={{padding: '8px', textAlign: 'left'}}>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.atRiskStudents.map((student, index) => (
                    <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                      <td style={{padding: '8px'}}>{student.studentName}</td>
                      <td style={{padding: '8px'}}>{student.courseName}</td>
                      <td style={{padding: '8px'}}>{student.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No students are currently at risk. Great job!</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getSession(context);

  if (!session || session.user.role !== 'teacher') {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  return {
    props: { session },
  };
}