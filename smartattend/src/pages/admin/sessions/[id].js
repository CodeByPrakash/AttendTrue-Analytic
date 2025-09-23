import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../api/auth/[...nextauth]';
import dbConnect from '../../../lib/couchdb';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminManageSession({ sessionId, courseId, courseName }) {
  const [roster, setRoster] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [toast, setToast] = useState('');

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const [studentsRes, attRes] = await Promise.all([
          fetch(`/api/admin/course-students?courseId=${encodeURIComponent(courseId)}`),
          fetch(`/api/admin/session-attendance?sessionId=${encodeURIComponent(sessionId)}`)
        ]);
        const studentsJson = await studentsRes.json();
        const attJson = await attRes.json();
        if (mounted && studentsRes.ok) setRoster(studentsJson.items || []);
        if (mounted && attRes.ok) setAttendanceMap(attJson.attendance || {});
      } catch (e) {
        setToast('Failed to load data');
      }
    }
    load();
    return () => { mounted = false; };
  }, [sessionId, courseId]);

  async function mark(studentId, status) {
    try {
      const res = await fetch('/api/admin/manual-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, studentId, status })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Update failed');
      setAttendanceMap(m => ({ ...m, [studentId]: { ...(m[studentId] || {}), status, method: 'manual', timestamp: new Date().toISOString() } }));
      setToast('Updated');
    } catch (e) {
      setToast(e.message);
    }
  }

  async function finalize() {
    try {
      const res = await fetch('/api/admin/finalize-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Finalize failed');
      setToast('Session finalized');
    } catch (e) {
      setToast(e.message);
    }
  }

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Manage Session</h1>
        <Link href="/admin/dashboard">&larr; Back</Link>
      </div>
  <p style={{ color: '#666' }}>Session: {sessionId}</p>
      <p style={{ color: '#666' }}>Course: {courseName} ({courseId})</p>
  <button className="form-button" style={{ background: '#ef4444', marginBottom: 10 }} onClick={finalize}>Finalize Session</button>
      {toast && <div className="glass" style={{ padding: 8, borderRadius: 8, marginBottom: 10 }}>{toast}</div>}
      {!roster.length ? (
        <p>No students enrolled for this course.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #ddd' }}>
              <th style={{ textAlign: 'left', padding: 6 }}>Name</th>
              <th style={{ textAlign: 'left', padding: 6 }}>Email</th>
              <th style={{ textAlign: 'left', padding: 6 }}>Status</th>
              <th style={{ textAlign: 'left', padding: 6 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roster.map(s => {
              const st = attendanceMap[s._id]?.status || '—';
              return (
                <tr key={s._id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 6 }}>{s.name}</td>
                  <td style={{ padding: 6 }}>{s.email}</td>
                  <td style={{ padding: 6 }}>{st}</td>
                  <td style={{ padding: 6 }}>
                    <button className="form-button" onClick={() => mark(s._id, 'present')}>Present</button>
                    <button className="form-button" style={{ background: '#f59e0b', marginLeft: 6 }} onClick={() => mark(s._id, 'left_early')}>Left Early</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

export async function getServerSideProps(context) {
  const { id } = context.query; // session id
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const nano = await dbConnect();
  const db = nano.db.use('smartattend');
  try {
    const sDoc = await db.get(id);
    if (!sDoc || sDoc.type !== 'session') return { notFound: true };
    const courseDoc = await db.get(sDoc.courseId).catch(() => null);
    if (!courseDoc) return { notFound: true };
    if (session.user.role !== 'superadmin') {
      const adminDoc = await db.get(session.user.id).catch(() => null);
      const instituteId = adminDoc?.instituteId || '';
      if ((courseDoc.instituteId || '') !== instituteId) {
        return { redirect: { destination: '/admin/dashboard', permanent: false } };
      }
    }
    return { props: { sessionId: id, courseId: sDoc.courseId, courseName: courseDoc.name || courseDoc._id } };
  } catch (e) {
    return { notFound: true };
  }
}
