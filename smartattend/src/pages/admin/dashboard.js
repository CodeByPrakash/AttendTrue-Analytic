import { getSession, useSession } from 'next-auth/react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import StatsCard from '../../components/analytics/StatsCard';
import DepartmentPieChart from '../../components/analytics/DepartmentPieChart';

export default function AdminDashboard() {
  const { data: session, status } = useSession();
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        const res = await fetch('/api/admin/analytics');
        if (!res.ok) {
          throw new Error('Failed to fetch analytics data');
        }
        const data = await res.json();
        setAnalytics(data);
      } catch (e) {
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };

    if (status === 'authenticated') {
      fetchAnalytics();
    }
  }, [status]);

  if (status === 'loading') {
    return <div style={{ padding: '2rem' }}>Loading...</div>;
  }

  if (status === 'unauthenticated' || !session) {
    return <div style={{ padding: '2rem' }}>Access denied. Please log in.</div>;
  }

  return (
    <div style={{ padding: '2rem' }}>
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
        <h1>Admin Dashboard</h1>
        <div>
          <Link href="/admin/users" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'green', color: 'white', textDecoration: 'none', borderRadius: '5px', marginRight: '1rem' }}>
            Manage Users
          </Link>
          <Link href="/admin/student-approvals" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'blue', color: 'white', textDecoration: 'none', borderRadius: '5px', marginRight: '1rem' }}>
            Student ID Approvals
          </Link>
          <Link href="/admin/register-teacher" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'purple', color: 'white', textDecoration: 'none', borderRadius: '5px', marginRight: '1rem' }}>
            Register Teacher
          </Link>
          {session?.user?.role === 'superadmin' && (
            <Link href="/admin/register-admin" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#0ea5e9', color: 'white', textDecoration: 'none', borderRadius: '5px', marginRight: '1rem' }}>
              Register Admin
            </Link>
          )}
          {session?.user?.role === 'superadmin' && (
            <Link href="/admin/institutes" style={{ padding: '0.75rem 1.5rem', backgroundColor: '#22c55e', color: 'white', textDecoration: 'none', borderRadius: '5px', marginRight: '1rem' }}>
              Manage Institutes
            </Link>
          )}
          <Link href="/admin/approvals" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'orange', color: 'white', textDecoration: 'none', borderRadius: '5px' }}>
            Face Scan Approvals
          </Link>
          <Link href="/logout" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'red', color: 'white', textDecoration: 'none', borderRadius: '5px', marginLeft: '1rem' }}>
            Sign Out
          </Link>
        </div>
      </div>
      <p>Overall analytics and system health.</p>

      {isLoading && <p>Loading analytics...</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}

      {analytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            <StatsCard title="Total Students" value={analytics.totalStudents} />
            <StatsCard title="Total Teachers" value={analytics.totalTeachers} />
            <StatsCard title="Courses Offered" value={analytics.totalCourses} />
            <StatsCard title="Total Attendances" value={analytics.totalAttendances} />
          </div>

          {/* Admin Tools quick access */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginTop: '2rem' }}>
            <Link href="/admin/users" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
              <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Manage Users</h3>
              <p style={{ opacity: 0.9 }}>Search, filter, approve/reject students, toggle active, reset passwords.</p>
            </Link>
            <Link href="/admin/courses" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
              <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Manage Courses</h3>
              <p style={{ opacity: 0.9 }}>Create courses, set weekly schedules, and assign teachers.</p>
            </Link>
            <Link href="/admin/student-approvals" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
              <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Student ID Approvals</h3>
              <p style={{ opacity: 0.9 }}>Review and approve new student registrations.</p>
            </Link>
            <Link href="/admin/register-teacher" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
              <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Register Teacher</h3>
              <p style={{ opacity: 0.9 }}>Create teacher accounts with secure passwords.</p>
            </Link>
            <Link href="/admin/approvals" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
              <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Face Scan Approvals</h3>
              <p style={{ opacity: 0.9 }}>Approve pending face scans to enable biometric login.</p>
            </Link>
            {session?.user?.role === 'superadmin' && (
              <Link href="/admin/register-admin" className="glass-card" style={{ textDecoration: 'none', color: 'inherit', padding: '1.5rem' }}>
                <h3 className="gradient-text" style={{ marginBottom: '0.5rem' }}>Register Admin</h3>
                <p style={{ opacity: 0.9 }}>Create admin accounts and assign them to an institute.</p>
              </Link>
            )}
          </div>

          <div style={{ marginTop: '2rem', maxWidth: '600px', margin: 'auto' }} className="glass-card">
            {analytics.attendanceByBranch && analytics.attendanceByBranch.length > 0 ? (
              <DepartmentPieChart data={analytics.attendanceByBranch} />
            ) : (
              <p>No department data to display.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  // Don't pass session through props to avoid serialization issues
  // The useSession hook will handle client-side session
  return {
    props: {},
  };
}