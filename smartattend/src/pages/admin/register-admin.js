import { useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';

export default function RegisterAdminPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [instituteId, setInstituteId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  const searchInstitutes = async (term) => {
    const q = String(term || '').trim();
    if (!q) { setSuggestions([]); return; }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/superadmin/institutes?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (res.ok) setSuggestions(data.institutes || []);
    } catch {}
    setIsSearching(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/register-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, instituteId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to register admin');
      setMessage(data.message || 'Admin registered successfully');
      setName('');
      setEmail('');
      setPassword('');
      setInstituteId('');
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 520, margin: '2rem auto' }}>
      <Link href="/admin/dashboard" style={{ textDecoration: 'underline' }}>&larr; Back to Dashboard</Link>
      <h1>Register New Admin</h1>
      <p style={{ opacity: 0.8 }}>Superadmin can register admins and assign them to an institute.</p>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>Full Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} style={{ width: '100%', padding: '0.5rem' }} />
        </div>
        <div style={{ marginBottom: '1rem', position: 'relative' }}>
          <label>Institute ID</label>
          <input
            type="text"
            value={instituteId}
            onChange={(e) => { setInstituteId(e.target.value); searchInstitutes(e.target.value); }}
            required
            placeholder="Search or enter institute code"
            style={{ width: '100%', padding: '0.5rem' }}
          />
          {suggestions.length > 0 && (
            <div style={{ position: 'absolute', zIndex: 10, background: 'white', border: '1px solid #ddd', width: '100%', maxHeight: 200, overflow: 'auto' }}>
              {suggestions.map(s => (
                <div key={s.id} style={{ padding: '0.5rem', cursor: 'pointer' }}
                     onClick={() => { setInstituteId(s.code); setSuggestions([]); }}>
                  <strong>{s.code}</strong>{s.name ? ` – ${s.name}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}
        <button type="submit" disabled={isLoading} style={{ padding: '0.75rem 1.5rem', cursor: 'pointer' }}>
          {isLoading ? 'Registering...' : 'Register Admin'}
        </button>
      </form>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !session.user || session.user.role !== 'superadmin') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
