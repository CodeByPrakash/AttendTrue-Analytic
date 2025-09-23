import Link from 'next/link';

export default function UsersTable({ viewerRole = 'admin', items, onApprove, onReject, onToggleActive, onResetPassword, onDelete }) {
  return (
    <div className="glass" style={{ padding: '1rem', borderRadius: 12 }}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Registered</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u._id} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {u.profileImageUrl ? <img src={u.profileImageUrl} alt="avatar" width={28} height={28} style={{ borderRadius: '50%' }} /> : <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />}
                    <div>{u.name || '-'}</div>
                  </div>
                </td>
                <td>{u.email}</td>
                <td style={{ textTransform: 'capitalize' }}>{u.role}</td>
                <td>{u.role === 'student' ? (u.approvalStatus || 'pending') : (u.isActive ? 'active' : 'inactive')}</td>
                <td>{u.registeredAt ? new Date(u.registeredAt).toLocaleDateString() : '-'}</td>
                <td>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {/* View dashboard quick links */}
                    {u.role === 'student' && (
                      <Link href={`/admin/student/${encodeURIComponent(u._id)}`} className="form-button" style={{ padding: '0.4rem 0.7rem', background: '#2563eb' }}>View Dashboard</Link>
                    )}
                    {u.role === 'teacher' && (
                      <Link href={`/admin/teacher/${encodeURIComponent(u._id)}`} className="form-button" style={{ padding: '0.4rem 0.7rem', background: '#2563eb' }}>View Dashboard</Link>
                    )}
                    {u.role === 'student' && (() => {
                      const status = (u.approvalStatus || 'pending').toLowerCase();
                      const approveDisabled = status === 'approved';
                      const rejectDisabled = status === 'rejected';
                      return (
                        <>
                          <button
                            className="form-button"
                            onClick={() => onApprove?.(u)}
                            disabled={approveDisabled}
                            title={approveDisabled ? 'Already approved' : 'Approve student'}
                            style={{ padding: '0.4rem 0.7rem', opacity: approveDisabled ? 0.6 : 1, cursor: approveDisabled ? 'not-allowed' : 'pointer' }}
                          >
                            Approve
                          </button>
                          <button
                            className="form-button"
                            onClick={() => onReject?.(u)}
                            disabled={rejectDisabled}
                            title={rejectDisabled ? 'Already rejected' : 'Reject student'}
                            style={{ padding: '0.4rem 0.7rem', background: '#ef4444', opacity: rejectDisabled ? 0.6 : 1, cursor: rejectDisabled ? 'not-allowed' : 'pointer' }}
                          >
                            Reject
                          </button>
                        </>
                      );
                    })()}
                    {/* Restrict actions on admin/superadmin rows to superadmin only */}
                    {(u.role === 'admin' || u.role === 'superadmin') ? (
                      viewerRole === 'superadmin' && (
                        <>
                          <button className="form-button" onClick={() => onToggleActive?.(u)} style={{ padding: '0.4rem 0.7rem', background: u.isActive ? '#6b7280' : undefined }}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                          <button className="form-button" onClick={() => onResetPassword?.(u)} style={{ padding: '0.4rem 0.7rem', background: '#f59e0b' }}>Reset PW</button>
                          {u.role === 'admin' && (
                            <button className="form-button" onClick={() => onDelete?.(u)} style={{ padding: '0.4rem 0.7rem', background: '#ef4444' }}>Delete</button>
                          )}
                        </>
                      )
                    ) : (
                      <>
                        <button className="form-button" onClick={() => onToggleActive?.(u)} style={{ padding: '0.4rem 0.7rem', background: u.isActive ? '#6b7280' : undefined }}>{u.isActive ? 'Deactivate' : 'Activate'}</button>
                        <button className="form-button" onClick={() => onResetPassword?.(u)} style={{ padding: '0.4rem 0.7rem', background: '#f59e0b' }}>Reset PW</button>
                        <button className="form-button" onClick={() => onDelete?.(u)} style={{ padding: '0.4rem 0.7rem', background: '#ef4444' }}>Delete</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length === 0 && <div style={{ padding: '1rem', opacity: 0.8 }}>No users found for this filter.</div>}
    </div>
  );
}
