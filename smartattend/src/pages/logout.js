import { useEffect } from 'react';
import { useSession, signOut as nextAuthSignOut } from 'next-auth/react';
import { useRouter } from 'next/router';

export default function LogoutPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  useEffect(() => {
    const performLogout = async () => {
      // Check for a NextAuth session first
      if (sessionStatus === 'authenticated') {
        // The callbackUrl tells NextAuth where to go after signing out.
        await nextAuthSignOut({ redirect: false, callbackUrl: '/login' });
        router.push('/login');
      } 
      // If no session is found, just redirect to login
      else {
        router.push('/login');
      }
    };

    // We wait for the session status to be determined before acting.
    if (sessionStatus !== 'loading') {
      performLogout();
    }
  }, [sessionStatus, router]);

  const styles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    fontFamily: 'sans-serif',
    fontSize: '1.5rem',
  };

  return (
    <div style={styles}>
      <p>Signing you out...</p>
    </div>
  );
}
