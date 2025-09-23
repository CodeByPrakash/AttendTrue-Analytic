import { useEffect, useMemo, useState } from 'react';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import Link from 'next/link';
import FiltersBar from '../../components/admin/FiltersBar';
import UsersTable from '../../components/admin/UsersTable';
import ConfirmModal from '../../components/admin/ConfirmModal';

export default function AdminUsersPage({ viewerRole = 'admin' }) {
  const [filters, setFilters] = useState({ role: '', status: '', search: '', page: 1, limit: 20 });
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({ items: [], total: 0, page: 1, limit: 20 });
  const [toast, setToast] = useState('');
  const [confirm, setConfirm] = useState({ open: false, onConfirm: null, title: '', message: '' });

  const query = useMemo(() => new URLSearchParams({
    ...(filters.role ? { role: filters.role } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.search ? { search: filters.search } : {}),
    page: String(filters.page),
    limit: String(filters.limit)
  }).toString(), [filters]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users?${query}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load');
      setData(json);
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [query]);

  function updateFilters(partial) {
    setFilters(prev => ({ ...prev, ...partial, page: 1 }));
  }

  async function mutate(method, url, body) {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || 'Request failed');
    setToast(json.message || 'Done');
    fetchUsers();
  }

  return (
    <div className="container">
      <div style={{ width: '100%', maxWidth: 1100 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1>Manage Users</h1>
          <Link href="/admin/dashboard" className="gradient-text">&larr; Back to Dashboard</Link>
        </div>

  <FiltersBar viewerRole={viewerRole} role={filters.role} status={filters.status} search={filters.search} limit={filters.limit} onChange={updateFilters} />

        <div style={{ margin: '12px 0' }}>{loading ? 'Loading…' : `Total: ${data.total}`}</div>

        <UsersTable
          viewerRole={viewerRole}
          items={data.items}
          onApprove={(u) => mutate('PATCH', `/api/admin/users/${encodeURIComponent(u._id)}`, { approvalStatus: 'approved' })}
          onReject={(u) => mutate('PATCH', `/api/admin/users/${encodeURIComponent(u._id)}`, { approvalStatus: 'rejected' })}
          onToggleActive={(u) => mutate('PATCH', `/api/admin/users/${encodeURIComponent(u._id)}`, { isActive: !u.isActive })}
          onResetPassword={(u) => setConfirm({
            open: true,
            title: `Reset password for ${u.email}?`,
            message: 'A temporary new password will be set.',
            onConfirm: async () => {
              setConfirm({ open: false });
              await mutate('POST', `/api/admin/users/reset-password`, { id: u._id, newPassword: generateTempPassword() });
            }
          })}
          onDelete={(u) => setConfirm({
            open: true,
            title: `Delete ${u.email}?`,
            message: 'This action cannot be undone.',
            onConfirm: async () => {
              setConfirm({ open: false });
              await mutate('DELETE', `/api/admin/users/${encodeURIComponent(u._id)}`);
            }
          })}
        />

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
          <button className="form-button" onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page <= 1}>Previous</button>
          <div>Page {filters.page} of {Math.max(1, Math.ceil((data.total || 0) / (filters.limit || 20)))}</div>
          <button className="form-button" onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={(filters.page * filters.limit) >= (data.total || 0)}>Next</button>
        </div>

        {toast && (
          <div className="glass" style={{ marginTop: 16, padding: 12, borderRadius: 12 }} onAnimationEnd={() => setToast('')}>
            {toast}
          </div>
        )}
      </div>
      <ConfirmModal open={confirm.open} title={confirm.title} message={confirm.message} onCancel={() => setConfirm({ open: false })} onConfirm={confirm.onConfirm} />
    </div>
  );
}

function generateTempPassword() {
  // Simple temp password generator: 12 chars with mixed types
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@$%*?';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: { viewerRole: session.user.role } };
}
