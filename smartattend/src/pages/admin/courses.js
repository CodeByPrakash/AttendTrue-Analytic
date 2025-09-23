import { getServerSession } from 'next-auth/next';
import { authOptions } from '../api/auth/[...nextauth]';
import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminCoursesPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [form, setForm] = useState({ name: '', code: '', teacherId: '', schedule: [] });
  const [newSlot, setNewSlot] = useState({ day: 'Mon', start: '09:00', end: '10:00' });

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/courses');
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Failed to load courses');
      setItems(json.items || []);
    } catch (e) {
      setToast(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function createCourse(e) {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, schedule: form.schedule })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message || 'Create failed');
      setToast('Course created');
      setForm({ name: '', code: '', teacherId: '', schedule: [] });
      load();
    } catch (e) {
      setToast(e.message);
    }
  }

  function addSlot(e) {
    e.preventDefault();
    setForm(f => ({ ...f, schedule: [...(f.schedule || []), { ...newSlot }] }));
  }

  function removeSlot(index) {
    setForm(f => ({ ...f, schedule: f.schedule.filter((_, i) => i !== index) }));
  }

  async function remove(courseId) {
    if (!confirm('Delete this course?')) return;
    const res = await fetch(`/api/admin/courses/${encodeURIComponent(courseId)}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setToast(json.message || 'Delete failed');
    setToast('Deleted');
    load();
  }

  return (
    <div className="container">
      <div style={{ width: '100%', maxWidth: 1000 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1>Courses</h1>
          <Link href="/admin/dashboard" className="gradient-text">&larr; Back</Link>
        </div>

        <form onSubmit={createCourse} className="glass" style={{ padding: 12, borderRadius: 12, marginBottom: 16, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8 }}>
          <input className="form-input" placeholder="Name" value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input className="form-input" placeholder="Code" value={form.code} onChange={(e) => setForm(f => ({ ...f, code: e.target.value }))} required />
          <input className="form-input" placeholder="Teacher ID (user:teacher@email)" value={form.teacherId} onChange={(e) => setForm(f => ({ ...f, teacherId: e.target.value }))} required />
          <button className="form-button" type="submit">Add</button>
        </form>

        <div className="glass" style={{ padding: 12, borderRadius: 12, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>Weekly Schedule</h3>
          <form onSubmit={addSlot} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <select className="form-input" value={newSlot.day} onChange={(e) => setNewSlot(s => ({ ...s, day: e.target.value }))}>
              {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => <option key={d} value={d}>{d}</option>)}
            </select>
            <input type="time" className="form-input" value={newSlot.start} onChange={(e) => setNewSlot(s => ({ ...s, start: e.target.value }))} required />
            <input type="time" className="form-input" value={newSlot.end} onChange={(e) => setNewSlot(s => ({ ...s, end: e.target.value }))} required />
            <button className="form-button" type="submit">Add Slot</button>
          </form>
          {form.schedule?.length > 0 && (
            <table style={{ width: '100%', marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Day</th>
                  <th style={{ textAlign: 'left' }}>Start</th>
                  <th style={{ textAlign: 'left' }}>End</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {form.schedule.map((slot, i) => (
                  <tr key={i}>
                    <td>{slot.day}</td>
                    <td>{slot.start}</td>
                    <td>{slot.end}</td>
                    <td><button className="form-button" style={{ background: '#ef4444' }} onClick={() => removeSlot(i)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {loading ? 'Loading…' : (
          <div className="glass" style={{ padding: 12, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left' }}>
                  <th>Name</th>
                  <th>Code</th>
                  <th>Teacher</th>
                  <th>Students</th>
                  <th>Schedule</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => (
                  <tr key={c._id} style={{ borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <td>{c.name}</td>
                    <td>{c.code}</td>
                    <td>{c.teacherId}</td>
                    <td>{Array.isArray(c.students) ? c.students.length : 0}</td>
                    <td>{Array.isArray(c.schedule) && c.schedule.length ? c.schedule.map(s => `${s.day} ${s.start}-${s.end}`).join(', ') : '—'}</td>
                    <td>
                      <button className="form-button" style={{ background: '#ef4444' }} onClick={() => remove(c._id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {toast && <div className="glass" style={{ marginTop: 12, padding: 10, borderRadius: 12 }}>{toast}</div>}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const session = await getServerSession(context.req, context.res, authOptions);
  if (!session || !session.user || (session.user.role !== 'admin' && session.user.role !== 'superadmin')) {
    return { redirect: { destination: '/login', permanent: false } };
  }
  return { props: {} };
}
