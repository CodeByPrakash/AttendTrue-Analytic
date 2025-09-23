import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../api/auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import StatsCard from '../../../components/analytics/StatsCard';
import RankBoard from '../../../components/analytics/RankBoard';
import StatusPieChart from '../../../components/analytics/StatusPieChart';
import HistoryGraph from '../../../components/analytics/HistoryGraph';

export default function AdminViewStudent({ studentMeta }) {
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function run() {
      setLoading(true);
      try {
        const res = await fetch(`/api/admin/students/${encodeURIComponent(studentMeta._id)}/analytics`);
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
  }, [studentMeta._id]);

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0 }}>Student Dashboard (Read-only)</h1>
          <p style={{ margin: 0, color: '#666' }}>{studentMeta.name} · {studentMeta.email}</p>
        </div>
        <Link href="/admin/users">&larr; Back to Users</Link>
      </div>
      {loading && <p>Loading analytics…</p>}
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {analytics && (
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
            <StatsCard title="Attendance Score" value={`${analytics.attendanceScore}%`} />
            <StatsCard title="Current Streak" value={analytics.streak} />
            <StatsCard title="Rank" value={`#${analytics.rank}`} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>
            {analytics?.attendanceHistory?.length > 0 ? (
              <HistoryGraph data={analytics.attendanceHistory} />
            ) : (
              <div>No history to display.</div>
            )}
            {analytics?.statusBreakdown?.length > 0 ? (
              <StatusPieChart data={analytics.statusBreakdown} />
            ) : (
              <div>No status breakdown available.</div>
            )}
          </div>
          <RankBoard leaderboard={analytics.leaderboard} currentUserRank={analytics.rank} currentUserName={studentMeta.name} />
        </div>
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
    if (!doc || doc.type !== 'user' || doc.role !== 'student') {
      return { notFound: true };
    }
    // Institute scoping for admin (superadmin can view all)
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      if (!adminDoc || (adminDoc.instituteId || '') !== (doc.instituteId || '')) {
        return { redirect: { destination: '/admin/dashboard', permanent: false } };
      }
    }
    const studentMeta = { _id: doc._id, name: doc.name || doc.fullName || doc.firstName || doc.email, email: doc.email };
    return { props: { studentMeta } };
  } catch {
    return { notFound: true };
  }
}
