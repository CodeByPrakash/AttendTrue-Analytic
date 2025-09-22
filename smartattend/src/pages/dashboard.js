import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader, ArrowRight, Shield, Users, GraduationCap } from 'lucide-react';

export default function Dashboard() {
  const { data: session, status } = useSession();
  const { isLoaded, isSignedIn, user: clerkUser } = useUser();
  const router = useRouter();
  const [redirecting, setRedirecting] = useState(false);
  const [redirectTarget, setRedirectTarget] = useState('');
  
  useEffect(() => {
    // Handle next-auth session (for teachers/admins and manual students)
    if (session && session.user && session.user.role) {
      const { role } = session.user;
      setRedirecting(true);
      
      if (role === 'admin') {
        setRedirectTarget('Admin Dashboard');
        setTimeout(() => router.push('/admin/dashboard'), 1500);
      } else if (role === 'teacher') {
        setRedirectTarget('Teacher Dashboard');
        setTimeout(() => router.push('/teacher/dashboard'), 1500);
      } else if (role === 'student') { // This is for manual student login
        setRedirectTarget('Student Dashboard');
        setTimeout(() => router.push('/student/dashboard'), 1500);
      }
      return; // Exit if next-auth session is handled
    }

    // Handle Clerk session (for Google students)
    if (isLoaded && isSignedIn && clerkUser) {
      // Assuming Clerk users are always students for now
      setRedirecting(true);
      setRedirectTarget('Student Dashboard');
      setTimeout(() => router.push('/student/dashboard'), 1500);
      return; // Exit if Clerk session is handled
    }

    // If neither session is loaded/authenticated, redirect to login
    if (status === 'unauthenticated' && isLoaded) { // Ensure Clerk is also loaded
      setRedirecting(true);
      setRedirectTarget('Login');
      setTimeout(() => router.push('/login'), 1000);
    }
  }, [session, status, router, isLoaded, isSignedIn, clerkUser]);

  const getRoleIcon = () => {
    if (session?.user?.role === 'admin') return Shield;
    if (session?.user?.role === 'teacher') return Users;
    return GraduationCap;
  };

  const RoleIcon = getRoleIcon();

  return (
    <div className="dashboard-loading">
      <motion.div
        className="loading-container"
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="logo-section"
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.8 }}
        >
          <div className="logo-circle">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Loader size={32} />
            </motion.div>
          </div>
          <h1 className="app-title">SmartAttend</h1>
          <p className="app-subtitle">Intelligent Attendance System</p>
        </motion.div>

        <AnimatePresence mode="wait">
          {redirecting ? (
            <motion.div
              key="redirecting"
              className="redirect-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
            >
              <motion.div
                className="role-indicator"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, duration: 0.5, ease: "backOut" }}
              >
                <RoleIcon size={48} />
              </motion.div>
              
              <motion.h2
                className="redirect-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                Welcome back!
              </motion.h2>
              
              <motion.div
                className="redirect-target"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
              >
                <span>Redirecting to {redirectTarget}</span>
                <motion.div
                  animate={{ x: [0, 10, 0] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <ArrowRight size={20} />
                </motion.div>
              </motion.div>
              
              <motion.div
                className="progress-bar"
                initial={{ width: 0 }}
                animate={{ width: '100%' }}
                transition={{ delay: 0.8, duration: 1.5, ease: "easeInOut" }}
              />
            </motion.div>
          ) : (
            <motion.div
              key="loading"
              className="loading-section"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="loading-dots"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
              >
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="dot"
                    animate={{ 
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5]
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2
                    }}
                  />
                ))}
              </motion.div>
              <p className="loading-text">Initializing your dashboard...</p>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className="background-glow"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </motion.div>

      <style jsx>{`
        .dashboard-loading {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, 
            var(--gradient-primary) 0%, 
            var(--gradient-secondary) 100%
          );
          position: relative;
          overflow: hidden;
        }

        .dashboard-loading::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><pattern id="grain" width="100" height="100" patternUnits="userSpaceOnUse"><circle cx="50" cy="50" r="0.5" fill="rgba(255,255,255,0.1)"/></pattern></defs><rect width="100" height="100" fill="url(%23grain)"/></svg>');
          opacity: 0.3;
        }

        .loading-container {
          text-align: center;
          position: relative;
          z-index: 2;
          max-width: 400px;
          padding: 3rem 2rem;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border-radius: 24px;
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-elegant);
        }

        .logo-section {
          margin-bottom: 3rem;
        }

        .logo-circle {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
          color: white;
          box-shadow: var(--shadow-soft);
        }

        .app-title {
          font-size: 2.5rem;
          font-weight: 700;
          margin: 0 0 0.5rem 0;
          background: linear-gradient(135deg, var(--primary), var(--secondary));
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .app-subtitle {
          font-size: 1rem;
          color: var(--text-muted);
          margin: 0;
          font-weight: 500;
        }

        .redirect-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.5rem;
        }

        .role-indicator {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, 
            rgba(var(--primary-rgb), 0.2), 
            rgba(var(--secondary-rgb), 0.1)
          );
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          border: 2px solid rgba(var(--primary-rgb), 0.3);
        }

        .redirect-title {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 0;
          color: rgb(var(--foreground-rgb));
        }

        .redirect-target {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          font-weight: 500;
          color: var(--text-muted);
        }

        .progress-bar {
          height: 3px;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 2px;
          width: 100%;
          max-width: 200px;
        }

        .loading-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2rem;
        }

        .loading-dots {
          display: flex;
          gap: 0.5rem;
          align-items: center;
        }

        .dot {
          width: 12px;
          height: 12px;
          background: var(--primary);
          border-radius: 50%;
        }

        .loading-text {
          font-weight: 500;
          color: var(--text-muted);
          margin: 0;
        }

        .background-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, 
            rgba(var(--primary-rgb), 0.2) 0%, 
            transparent 70%
          );
          border-radius: 50%;
          pointer-events: none;
          z-index: 1;
        }

        @media (max-width: 768px) {
          .loading-container {
            margin: 1rem;
            padding: 2rem 1.5rem;
            max-width: 350px;
          }

          .app-title {
            font-size: 2rem;
          }

          .logo-circle {
            width: 60px;
            height: 60px;
          }

          .role-indicator {
            width: 60px;
            height: 60px;
          }
        }
      `}</style>
    </div>
  );
}