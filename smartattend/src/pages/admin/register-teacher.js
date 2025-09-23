import { useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function RegisterTeacherPage({ sessionRole }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instituteId, setInstituteId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);

    const res = await fetch('/api/admin/register-teacher', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, instituteId: sessionRole === 'superadmin' ? instituteId : undefined }),
    });

    const data = await res.json();
    setIsLoading(false);

    if (!res.ok) {
      setError(data.message || 'Something went wrong');
    } else {
      setMessage(data.message || 'Teacher registered successfully!');
      setName('');
      setEmail('');
      setPassword('');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto', padding: '2rem' }}>
      <Link href="/admin/dashboard" style={{ textDecoration: 'underline' }}>&larr; Back to Dashboard</Link>
      <h1>Register New Teacher</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            style={{ width: '100%', padding: '0.5rem' }}
          />
        </div>
        {sessionRole === 'superadmin' && (
          <div style={{ marginBottom: '1rem' }}>
            <label>Institute ID</label>
            <input
              type="text"
              value={instituteId}
              onChange={(e) => setInstituteId(e.target.value)}
              required
              placeholder="Enter target institute ID"
              style={{ width: '100%', padding: '0.5rem' }}
            />
          </div>
        )}
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
          {isLoading ? 'Registering...' : 'Register Teacher'}
        </button>
      </form>
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

  return {
    props: { session, sessionRole: session.user.role },
  };
}