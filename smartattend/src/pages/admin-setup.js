import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function AdminSetup() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [adminExists, setAdminExists] = useState(null);

  useEffect(() => {
    // Check if admin already exists
    const checkAdminExists = async () => {
      try {
        const response = await fetch('/api/admin/register-first-admin', {
          method: 'HEAD'
        });
        setAdminExists(response.status === 403);
      } catch (err) {
        setAdminExists(false);
      }
    };
    checkAdminExists();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    // Validation
    if (!formData.name || !formData.email || !formData.password) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/admin/register-first-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setMessage('Admin account created successfully! You can now log in.');
        // Redirect to login page after 3 seconds
        setTimeout(() => {
          router.push('/login');
        }, 3000);
      } else {
        setError(data.message || 'Setup failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (adminExists === null) {
    return (
      <div className="container">
        <div className="auth-form">
          <h1>Loading...</h1>
          <p>Checking system status...</p>
        </div>
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="container">
        <div className="auth-form">
          <h1>System Already Setup</h1>
          <p style={{ color: '#666', marginBottom: '2rem', textAlign: 'center' }}>
            An administrator account already exists. Please contact your existing administrator for access.
          </p>
          <Link href="/login" className="form-button">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="auth-form">
        <h1>🚀 Welcome to SmartAttend</h1>
        <p style={{ color: '#666', marginBottom: '2rem', textAlign: 'center' }}>
          Set up your first administrator account to get started.
        </p>

        <form onSubmit={handleSubmit}>
          <div>
            <label htmlFor="name">Full Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className="form-input"
              placeholder="System Administrator"
              required
            />
          </div>

          <div>
            <label htmlFor="email">Email Address *</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleInputChange}
              className="form-input"
              placeholder="admin@yourschool.edu"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <label htmlFor="password">Password *</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleInputChange}
                className="form-input"
                required
                minLength="8"
                placeholder="Minimum 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword">Confirm Password *</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                className="form-input"
                required
                minLength="8"
                placeholder="Confirm password"
              />
            </div>
          </div>

          {error && (
            <div style={{ color: 'red', marginBottom: '1rem', textAlign: 'center' }}>
              {error}
            </div>
          )}

          {message && (
            <div style={{ 
              color: 'green', 
              marginBottom: '1rem', 
              textAlign: 'center',
              background: 'rgba(0, 255, 0, 0.1)',
              padding: '1rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 255, 0, 0.3)'
            }}>
              {message}
              <br />
              <small>Redirecting to login...</small>
            </div>
          )}

          <button 
            type="submit" 
            className="form-button"
            disabled={loading}
          >
            {loading ? 'Creating Admin Account...' : 'Setup Admin Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '2rem' }}>
          <p><Link href="/">← Back to Home</Link></p>
        </div>

        <div style={{ 
          marginTop: '2rem', 
          padding: '1rem', 
          background: 'rgba(0, 123, 255, 0.1)', 
          borderRadius: '8px',
          fontSize: '0.9rem',
          border: '1px solid rgba(0, 123, 255, 0.3)'
        }}>
          <h4>🔒 Security Note:</h4>
          <p>This setup page is only available when no admin accounts exist. After creating the first admin, this page will be automatically disabled for security.</p>
        </div>
      </div>
    </div>
  );
}