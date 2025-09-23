import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';

const handleAnimationComplete = () => {
  console.log('All letters have animated!');
};
const headingStyles = {
    fontSize: '2rem',
    lineHeight: '1.1',
    marginBottom: '2rem',
  };

  const textStyles = {
    fontSize: '1.2rem',
    color: 'rgba(var(--foreground-rgb), 0.8)',
    marginBottom: '3rem',
  };

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (router.query.error) {
      const errorMessages = {
        CredentialsSignin: 'Invalid email or password. Please try again.',
        default: 'An unknown error occurred during login.',
      };
      setError(errorMessages[router.query.error] || errorMessages.default);
    }
  }, [router.query.error]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      let callbackUrl = '/dashboard';
      if (role === 'student') callbackUrl = '/student/dashboard';
      else if (role === 'teacher') callbackUrl = '/teacher/dashboard';
      else if (role === 'admin') callbackUrl = '/admin/dashboard';
      else if (role === 'superadmin') callbackUrl = '/admin/dashboard';

      const result = await signIn('credentials', {
        email,
        password,
        role,
        callbackUrl,
        redirect: false, // Handle redirect manually
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        // Successful login, redirect to the appropriate dashboard
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error('Login error:', error);
      setError('An unexpected error occurred during login.');
    }
  };

  return (
    <div className="container">
      <h1 style={headingStyles}>Welcome to SmartAttend</h1>
      <div className="glass-card login-card">
        <h1>Login</h1>
        <form onSubmit={handleSubmit}>
          <div>
            <label className="form-label" htmlFor="role">Role</label>
            <select id="role" value={role} onChange={(e) => setRole(e.target.value)} required className="form-select">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Super Admin</option>
            </select>
          </div>
          <div>
            <label className="form-label" htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="form-input"
            />
          </div>
          {error && <p className="form-error">{error}</p>}
          <button type="submit" className="form-button">
            Login
          </button>
        </form>
        <div className="link-group"><br/>
          <p>
            Student? <Link href="/student-register">Register here</Link>
          </p><br />
          <p>
            Teacher/Admin? Contact your administrator for account setup.
          </p>
        </div>
      </div>
      <style jsx>{`
        /* Responsive widths for the login card */
        .login-card { width: 100%; max-width: 380px; }
        @media (min-width: 640px) { /* tablet */
          .login-card { max-width: 720px; }
        }
        @media (min-width: 1024px) { /* desktop */
          .login-card { max-width: 900px; }
        }
        @media (min-width: 1280px) { /* large desktop */
          .login-card { max-width: 1040px; }
        }
      `}</style>
    </div>
  );
}