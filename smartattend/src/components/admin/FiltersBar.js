export default function FiltersBar({ viewerRole = 'admin', role, status, search, limit, onChange }) {
  return (
    <div className="glass" style={{ padding: '1rem', borderRadius: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <select className="form-select" value={role} onChange={(e) => onChange({ role: e.target.value })} style={{ maxWidth: 200 }}>
        <option value="">All Roles</option>
        <option value="student">Students</option>
        <option value="teacher">Teachers</option>
        {viewerRole === 'superadmin' && <option value="admin">Admins</option>}
      </select>
      <select className="form-select" value={status} onChange={(e) => onChange({ status: e.target.value })} style={{ maxWidth: 200 }}>
        <option value="">All Status</option>
        <option value="approved">Approved</option>
        <option value="pending">Pending</option>
        <option value="rejected">Rejected</option>
        <option value="inactive">Inactive</option>
      </select>
      <input className="form-input" placeholder="Search name, email, id..." value={search} onChange={(e) => onChange({ search: e.target.value })} style={{ flex: 1, minWidth: 200 }} />
      <select className="form-select" value={String(limit)} onChange={(e) => onChange({ limit: e.target.value })} style={{ maxWidth: 120 }}>
        <option value="10">10</option>
        <option value="20">20</option>
        <option value="50">50</option>
        <option value="100">100</option>
      </select>
    </div>
  );
}
