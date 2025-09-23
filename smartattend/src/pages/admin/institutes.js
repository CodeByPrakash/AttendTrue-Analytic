import { useEffect, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';

export default function InstitutesPage() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [list, setList] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const refresh = async () => {
    setError('');
    try {
      const res = await fetch(`/api/superadmin/institutes?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setList(data.institutes || []);
    } catch (e) {
      setError(e.message);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await fetch('/api/superadmin/institutes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, name })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to create');
      setMessage('Institute created');
      setCode(''); setName('');
      refresh();
    } catch (e) {
      setError(e.message);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    refresh();
  };

  return (
    <div className="container">
      <div className="glass-card" style={{ maxWidth: 800 }}>
        <Link href="/admin/dashboard" style={{ textDecoration: 'underline' }}>&larr; Back to Dashboard</Link>
        <h1 style={{ marginTop: '1rem' }}>Institutes</h1>
        <p>Superadmin can create and search institute IDs.</p>
        {error && <p style={{ color: 'red' }}>{error}</p>}
        {message && <p style={{ color: 'green' }}>{message}</p>}

        <form onSubmit={handleCreate} style={{ marginTop: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="form-label">Institute Code (ID)</label>
              <input className="form-input" value={code} onChange={e => setCode(e.target.value)} required placeholder="e.g., INSTITUTE_123" />
            </div>
            <div>
              <label className="form-label">Name</label>
              <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="Optional display name" />
            </div>
          </div>
          <button type="submit" className="form-button" style={{ marginTop: 12 }}>Create Institute</button>
        </form>

        <form onSubmit={handleSearch} style={{ marginTop: 24, display: 'flex', gap: 8 }}>
          <input className="form-input" style={{ maxWidth: 280 }} placeholder="Search by code or name" value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="form-button" type="submit">Search</button>
        </form>

        <div style={{ marginTop: 16 }}>
          {list.length === 0 ? <p>No institutes found.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ textAlign: 'left', padding: 8 }}>Code</th>
                  <th style={{ textAlign: 'left', padding: 8 }}>Name</th>
                </tr>
              </thead>
              <tbody>
                {list.map((i) => (
                  <tr key={i.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <td style={{ padding: 8 }}>{i.code}</td>
                    <td style={{ padding: 8 }}>{i.name}</td>
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
  if (!session || !session.user || session.user.role !== 'superadmin') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
