import { useState, useEffect, useRef } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';
import dynamic from 'next/dynamic';

const FaceScanner = dynamic(() => import('../../components/FaceScanner'), { ssr: false });
let faceapi;

export default function ApprovalsPage({ initialPendingScans }) {
  const [pendingScans, setPendingScans] = useState(initialPendingScans?.pending || initialPendingScans || []);
  const [recent, setRecent] = useState(initialPendingScans?.recent || []);
  const [message, setMessage] = useState('');
  const [q, setQ] = useState('');
  const [isRescanning, setIsRescanning] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [selectedStudent, setSelectedStudent] = useState(null);
  const scanIntervalRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    const loadFaceApi = async () => {
      try {
        const mod = await import('face-api.js');
        if (!mounted) return;
        faceapi = mod;
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
          faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
          faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
        ]);
      } catch (e) {
        console.error('Failed to load face-api models', e);
      }
    };
    loadFaceApi();
    return () => { mounted = false; if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; } };
  }, []);

  const handleApproval = async (studentId, action) => {
    setMessage('Processing...');
    const res = await fetch('/api/admin/approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action }),
    });
    const data = await res.json();
    setMessage(data.message);
    // Refresh the list
    setPendingScans((prev) => prev.filter(scan => scan._id !== studentId));
    // Re-query recent for a live update
    try {
      const res2 = await fetch(`/api/admin/approvals?q=${encodeURIComponent(q)}`);
      const j = await res2.json();
      if (res2.ok && j && typeof j === 'object') {
        setRecent(j.recent || []);
      }
    } catch {}
  };

  const handleRescanRequest = async (studentId) => {
    // Deprecated flow replaced by manual capture
    const student = pendingScans.find(s => s._id === studentId);
    if (!student) return;
    setSelectedStudent(student);
    setFeedback('Position the face in frame...');
    setIsRescanning(true);
  };

  async function search() {
    try {
      const res = await fetch(`/api/admin/approvals?q=${encodeURIComponent(q)}`);
      const j = await res.json();
      if (!res.ok) throw new Error(j.message || 'Search failed');
      setPendingScans(j.pending || []);
      setRecent(j.recent || []);
    } catch (e) {
      setMessage(e.message);
    }
  }

  return (
    <div className="container">
      <div className="glass-card" style={{maxWidth: '900px'}}>
        <Link href="/admin/dashboard">&larr; Back to Dashboard</Link>
        <h1 style={{marginTop: '1rem'}}>Face Scan Approvals</h1>
        <p>Review and approve or reject new face scans submitted by students.</p>
        {message && <p style={{textAlign: 'center', margin: '1rem 0'}}>{message}</p>}

        <div style={{ display: 'flex', gap: 8, marginTop: '1rem' }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or email" className="form-input" style={{ maxWidth: 300 }} />
          <button className="form-button" onClick={search}>Search</button>
        </div>

        <div style={{marginTop: '2rem'}}>
          {pendingScans.length === 0 ? (
            <p>No pending approvals.</p>
          ) : (
            pendingScans.map(student => (
              <div key={student._id} style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', borderBottom: '1px solid var(--glass-border)'}}>
                <div style={{display: 'flex', alignItems: 'center'}}>
                  {student.profileImageUrl ? (
                    <img src={student.profileImageUrl} alt="Profile" style={{width: '50px', height: '50px', borderRadius: '50%', marginRight: '1rem'}} />
                  ) : (
                    <div style={{width: '50px', height: '50px', borderRadius: '50%', marginRight: '1rem', background: '#e5e7eb', display: 'grid', placeItems: 'center'}}>👤</div>
                  )}
                  <div>
                    <strong>{student.name}</strong>
                    <br />
                    <small>{student.email}</small>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => handleApproval(student._id, 'approve')} className="form-button" style={{background: 'green'}}>Approve</button>
                  <button onClick={() => handleApproval(student._id, 'reject')} className="form-button" style={{background: 'red'}}>Reject</button>
                  <button onClick={() => handleRescanRequest(student._id)} className="form-button" style={{background: '#6b7280'}}>Manual Capture</button>
                </div>
              </div>
            ))
          )}
        </div>

        {isRescanning && (
          <div className="modal">
            <div className="glass-card" style={{ maxWidth: 720 }}>
              <h3>Manual Face Capture for {selectedStudent?.name}</h3>
              <FaceScanner onFaceDetected={async (videoRef) => {
                setFeedback('Detecting face...');
                return new Promise((resolve) => {
                  if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
                  scanIntervalRef.current = setInterval(async () => {
                    try {
                      if (!videoRef.current || !faceapi) return;
                      const det = await faceapi
                        .detectSingleFace(videoRef.current)
                        .withFaceLandmarks()
                        .withFaceDescriptor();
                      if (det) {
                        const descriptor = Array.from(det.descriptor);
                        setFeedback('Face captured. Approving...');
                        if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
                        const res = await fetch('/api/admin/approvals', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ studentId: selectedStudent._id, action: 'approve', descriptor })
                        });
                        const j = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          setMessage(j.message || 'Failed to approve with manual capture');
                        } else {
                          setMessage(j.message || 'Approved');
                          setPendingScans((prev) => prev.filter(s => s._id !== selectedStudent._id));
                          try {
                            const r = await fetch(`/api/admin/approvals?q=${encodeURIComponent(q)}`);
                            const data = await r.json();
                            if (r.ok) setRecent(data.recent || []);
                          } catch {}
                        }
                        setIsRescanning(false);
                        setSelectedStudent(null);
                        resolve();
                      } else {
                        setFeedback('No face detected. Please center your face.');
                      }
                    } catch (e) {
                      setFeedback('Error during capture');
                    }
                  }, 700);
                });
              }} feedbackMessage={feedback} />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
                <button className="form-button" onClick={() => { if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; } setIsRescanning(false); setSelectedStudent(null); }}>Cancel</button>
              </div>
            </div>
          </div>
        )}

        <div style={{marginTop: '2rem'}}>
          <h2 style={{fontSize: '1.1rem'}}>Recent Reviews</h2>
          {recent.length === 0 ? <p>No recent approvals yet.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Student</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Email</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Status</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Reviewed At</th>
                </tr>
              </thead>
              <tbody>
                {recent.map(r => (
                  <tr key={r._id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: 8 }}>{r.name}</td>
                    <td style={{ padding: 8 }}>{r.email}</td>
                    <td style={{ padding: 8, textTransform: 'capitalize' }}>{r.status}</td>
                    <td style={{ padding: 8 }}>{r.reviewedAt ? new Date(r.reviewedAt).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { redirect: { destination: '/login', permanent: false } };
  }

  // Fetch initial data server-side using internal call
  let initialPendingScans = [];
  try {
    const base = process.env.NEXTAUTH_URL || `http://${context.req.headers.host}`;
    const res = await fetch(`${base}/api/admin/approvals`, {
      headers: { cookie: context.req.headers.cookie || '' }
    });
    initialPendingScans = await res.json();
  } catch (e) {
    initialPendingScans = { pending: [], recent: [] };
  }

  return { props: { initialPendingScans } };
}
