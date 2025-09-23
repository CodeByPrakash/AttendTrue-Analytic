import { useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import { QRCodeCanvas } from 'qrcode.react';
import dbConnect from '../../lib/couchdb';

export default function CreateSessionPage({ courses }) {
  const [courseId, setCourseId] = useState(courses[0]?._id || '');
  const [duration, setDuration] = useState(10);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState('');
  const [roster, setRoster] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleCreateSession = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSessionData(null);
    // Try to capture teacher's geolocation to enable geofencing
    let networkInfo = { userAgent: navigator.userAgent, platform: navigator.platform };
    try {
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (navigator.geolocation) {
        const pos = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 10000 });
        });
        networkInfo.geolocation = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          timestamp: pos.timestamp
        };
      }
    } catch (_) {
      // Geolocation optional
    }

    const res = await fetch('/api/teacher/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ courseId, duration, networkInfo }),
    });

    const data = await res.json();

    if (!res.ok) {
      setError(data.message || 'Something went wrong');
    } else {
      setSessionData(data);
    }
    setIsLoading(false);
  };

  const qrCodeValue = sessionData ? JSON.stringify({ sessionKey: sessionData.sessionId }) : '';

  // Load roster and attendance when session created
  useEffect(() => {
    async function load() {
      if (!sessionData) return;
      try {
        const [studentsRes, attRes] = await Promise.all([
          fetch(`/api/teacher/students?courseId=${encodeURIComponent(courseId)}`),
          fetch(`/api/teacher/session-attendance?sessionId=${encodeURIComponent(sessionData.sessionId)}`)
        ]);
        const studentsJson = await studentsRes.json();
        const attJson = await attRes.json();
        if (studentsRes.ok) setRoster(studentsJson.items || []);
        if (attRes.ok) setAttendanceMap(attJson.attendance || {});
      } catch (e) {
        console.error('Load roster/attendance failed', e);
      }
    }
    load();
  }, [sessionData, courseId]);

  async function mark(studentId, status) {
    try {
      const res = await fetch('/api/teacher/manual-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionData.sessionId, studentId, status })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Update failed');
      // refresh single student status
      setAttendanceMap(m => ({ ...m, [studentId]: { ...(m[studentId] || {}), status, method: 'manual', timestamp: new Date().toISOString() } }));
    } catch (e) {
      setError(e.message);
    }
  }

  async function finalize() {
    try {
      const res = await fetch('/api/teacher/finalize-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: sessionData.sessionId })
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.message || 'Finalize failed');
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="container">
      <div className="glass-card" style={{maxWidth: '800px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem'}}>
        {/* Form Section */}
        <div>
          <button onClick={() => router.back()}>&larr; Back</button>
          <h1 style={{marginTop: '1rem'}}>Create Session</h1>
          <form onSubmit={handleCreateSession}>
            <label className="form-label" htmlFor="course">Course</label>
            <select id="course" value={courseId} onChange={(e) => setCourseId(e.target.value)} required className="form-select">
              {courses.map(course => (
                <option key={course._id} value={course._id}>{course.name}</option>
              ))}
            </select>
            
            <label className="form-label" htmlFor="duration">Duration (minutes)</label>
            <input id="duration" type="number" value={duration} onChange={(e) => setDuration(e.target.value)} min="1" required className="form-input" />
            
            <button type="submit" disabled={isLoading} className="form-button">
              {isLoading ? 'Creating...' : 'Generate Session Code'}
            </button>
            {error && <p className="form-error">{error}</p>}
          </form>
        </div>

  {/* QR Code and Session Code Display Section */}
        <div style={{textAlign: 'center', borderLeft: '1px solid var(--glass-border)', paddingLeft: '2rem'}}>
          <h2>Session Details</h2>
          {sessionData ? (
            <div>
              <p style={{margin: '1rem 0'}}>Scan the QR code or enter the code below.</p>
              <div style={{background: 'white', padding: '1rem', borderRadius: '8px', display: 'inline-block'}}>
                <QRCodeCanvas value={qrCodeValue} size={200} />
              </div>
              <div style={{marginTop: '1.5rem'}}>
                <label className="form-label">Session Code</label>
                <input type="text" readOnly value={sessionData.sessionId} className="form-input" style={{textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem'}} />
              </div>
              <p>Expires at: {new Date(sessionData.endTime).toLocaleTimeString()}</p>
              <button className="form-button" style={{ marginTop: '0.75rem', background: '#ef4444' }} onClick={finalize}>Finalize Session</button>
            </div>
          ) : (
            <p style={{marginTop: '2rem'}}>Your session code will appear here once generated.</p>
          )}
          {sessionData && (
            <div style={{ marginTop: '2rem', textAlign: 'left' }}>
              <h3>Manual Attendance (Fallback)</h3>
              <p style={{ color: '#666' }}>Mark students as present or left early.</p>
              {!roster.length ? <p>No enrolled students found for this course.</p> : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid #ddd' }}>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Email</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Status</th>
                      <th style={{ textAlign: 'left', padding: '6px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {roster.map(s => {
                      const st = attendanceMap[s._id]?.status || '—';
                      return (
                        <tr key={s._id} style={{ borderBottom: '1px solid #eee' }}>
                          <td style={{ padding: '6px' }}>{s.name}</td>
                          <td style={{ padding: '6px' }}>{s.email}</td>
                          <td style={{ padding: '6px' }}>{st}</td>
                          <td style={{ padding: '6px' }}>
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
          )}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  const teacherId = session?.user?.id;

  if (!session || !teacherId || session.user.role !== 'teacher') {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    };
  }

  try {
    const nano = await dbConnect();
    const db = nano.db.use('smartattend');
    
    const coursesResult = await db.find({
      selector: {
        type: 'course',
        teacherId: teacherId
      }
    });

    return {
      props: {
        session,
        courses: coursesResult.docs,
      },
    };
  } catch (error) {
    console.error("Error fetching courses for teacher:", error);
    return {
      props: {
        session,
        courses: [],
      },
    };
  }
}