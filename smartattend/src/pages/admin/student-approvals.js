import { useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';

export default function StudentApprovalsPage({ initialPendingStudents }) {
  const [pendingStudents, setPendingStudents] = useState(initialPendingStudents);
  const [message, setMessage] = useState('');

  const handleApproval = async (studentId, action) => {
    setMessage('Processing...');
    const res = await fetch('/api/admin/student-approvals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, action }),
    });
    const data = await res.json();
    setMessage(data.message);
    setPendingStudents(pendingStudents.filter(student => student._id !== studentId));
  };

  return (
    <div className="container">
      <div className="glass-card" style={{maxWidth: '1000px'}}>
        <Link href="/admin/dashboard">&larr; Back to Dashboard</Link>
        <h1 style={{marginTop: '1rem'}}>New Student Approvals</h1>
        <p>Review and approve or reject new student accounts.</p>
        {message && <p style={{textAlign: 'center', margin: '1rem 0'}}>{message}</p>}

        <div style={{marginTop: '2rem'}}>
          {pendingStudents.length === 0 ? (
            <p>No pending student approvals.</p>
          ) : (
            pendingStudents.map(student => (
              <div key={student._id} style={{display: 'grid', gridTemplateColumns: '50px 1fr 1fr auto', alignItems: 'center', gap: '1rem', padding: '1rem', borderBottom: '1px solid var(--glass-border)'}}>
                <img src={student.profileImageUrl || '/images/default-avatar.png'} alt="Profile" style={{width: '50px', height: '50px', borderRadius: '50%'}} />
                <div>
                  <strong>{student.name}</strong><br />
                  <small>{student.email}</small><br />
                  <small>Student ID: {student.studentId}</small>
                </div>
                <div>
                  <strong>{student.department}</strong><br />
                  <small>Phone: {student.phone || 'N/A'}</small><br />
                  <small>Registered: {new Date(student.registeredAt).toLocaleDateString()}</small>
                </div>
                <div>
                  <button onClick={() => handleApproval(student._id, 'approve')} className="form-button" style={{background: 'green', marginRight: '1rem'}}>Approve</button>
                  <button onClick={() => handleApproval(student._id, 'reject')} className="form-button" style={{background: 'red'}}>Reject</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const { req, res } = context;
  const session = await getServerSession(req, res, authOptions);
  if (!session || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { redirect: { destination: '/login' } };
  }

  const base = process.env.NEXTAUTH_URL || `http://${req.headers.host}`;
  const apiRes = await fetch(`${base}/api/admin/student-approvals`, {
    headers: { Cookie: req.headers.cookie || '' },
  });
  const initialPendingStudents = await apiRes.json();

  return { props: { initialPendingStudents } };
}
