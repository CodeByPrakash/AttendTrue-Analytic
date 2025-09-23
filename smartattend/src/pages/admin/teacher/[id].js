import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../api/auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import StatusPieChart from '../../../components/analytics/StatusPieChart';
import CoursePerformanceBarChart from '../../../components/analytics/CoursePerformanceBarChart';

export default function AdminViewTeacher({ teacherMeta }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/teachers/${encodeURIComponent(teacherMeta._id)}/analytics`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.message || 'Failed to load analytics');
        if (active) setAnalytics(json);
      } catch (e) {
        if (active) setError(e.message);
      } finally {
        if (active) setLoading(false);
      }
    }
    run();
    return () => { active = false; };
  }, [teacherMeta._id]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Teacher Dashboard (Read-only)</h1>
          <p style={{ margin: 0, color: '#666' }}>{teacherMeta.name} · {teacherMeta.email}</p>
        </div>
        <Link href="/admin/users">&larr; Back to Users</Link>
      </div>
      {loading && <p>Loading analytics…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {analytics && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'flex-start' }}>
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
          <div style={{ marginTop: 24 }}>
            <h2>At-Risk Students (&lt;75% Attendance)</h2>
            {analytics.atRiskStudents?.length > 0 ? (
              <table style={{width: '100%', borderCollapse: 'collapse'}}>
                <thead>
                  <tr style={{borderBottom: '2px solid #ddd'}}>
                    <th style={{padding: 8, textAlign: 'left'}}>Student Name</th>
                    <th style={{padding: 8, textAlign: 'left'}}>Course</th>
                    <th style={{padding: 8, textAlign: 'left'}}>Attendance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.atRiskStudents.map((student, index) => (
                    <tr key={index} style={{borderBottom: '1px solid #eee'}}>
                      <td style={{padding: 8}}>{student.studentName}</td>
                      <td style={{padding: 8}}>{student.courseName}</td>
                      <td style={{padding: 8}}>{student.attendanceRate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No students are currently at risk.</p>
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
    return { redirect: { destination: '/login', permanent: false } };
  }
  const { id } = context.query; // user doc id
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');
  try {
    const doc = await db.get(id);
    if (!doc || doc.type !== 'user' || doc.role !== 'teacher') {
      return { notFound: true };
    }
    // Institute scoping for admin (superadmin can view all)
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      if (!adminDoc || (adminDoc.instituteId || '') !== (doc.instituteId || '')) {
        return { redirect: { destination: '/admin/dashboard', permanent: false } };
      }
    }
    const teacherMeta = { _id: doc._id, name: doc.name || doc.fullName || doc.firstName || doc.email, email: doc.email };
    return { props: { teacherMeta } };
  } catch {
    return { notFound: true };
  }
}
