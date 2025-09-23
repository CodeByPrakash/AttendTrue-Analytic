import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggleButton() {
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check for saved theme preference or system preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');
    const shouldUseDark = savedTheme ? savedTheme === 'dark' : prefersDark;
    document.documentElement.setAttribute('data-theme', shouldUseDark ? 'dark' : 'light');
    setIsDarkMode(shouldUseDark);

    // Optional: respond to system changes if user hasn't set an explicit theme
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemChange = (e) => {
      const userSet = localStorage.getItem('theme');
      if (userSet) return; // don't override explicit choice
      const nextIsDark = e.matches;
      document.documentElement.setAttribute('data-theme', nextIsDark ? 'dark' : 'light');
      setIsDarkMode(nextIsDark);
    };
    media.addEventListener?.('change', handleSystemChange);
    return () => media.removeEventListener?.('change', handleSystemChange);
  }, []);

  const toggleTheme = () => {
    const next = !isDarkMode;
    document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
    localStorage.setItem('theme', next ? 'dark' : 'light');
    setIsDarkMode(next);
  };

  if (!mounted) return null;

  return (
    <motion.button
      onClick={toggleTheme}
      className="theme-toggle-button"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      <div className="toggle-content">
        <AnimatePresence mode="wait">
          {isDarkMode ? (
            <motion.div
              key="sun"
              initial={{ rotate: -180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 180, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="icon-wrapper"
            >
              <Sun size={18} />
            </motion.div>
          ) : (
            <motion.div
              key="moon"
              initial={{ rotate: 180, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -180, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="icon-wrapper"
            >
              <Moon size={18} />
            </motion.div>
          )}
        </AnimatePresence>
        <motion.span
          key={isDarkMode ? 'light' : 'dark'}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="theme-text"
        >
          {isDarkMode ? 'Light' : 'Dark'}
        </motion.span>
      </div>
      
      <style jsx>{`
        .theme-toggle-button {
          position: fixed;
          top: 1.5rem;
          right: 1.5rem;
          z-index: 1000;
          padding: 0.75rem 1.25rem;
          cursor: pointer;
          border-radius: 50px;
          border: none;
          background: transparent;
          backdrop-filter: none;
          color: rgb(var(--foreground-rgb));
          font-size: 0.9rem;
          font-weight: 500;
          box-shadow: none;
          transition: all 0.3s ease;
          overflow: hidden;
          position: relative;
        }
        
        /* Remove any hover/active background visuals */
        .theme-toggle-button:hover,
        .theme-toggle-button:focus,
        .theme-toggle-button:active {
          background: transparent !important;
          box-shadow: none !important;
        }
        .theme-toggle-button { -webkit-tap-highlight-color: transparent; }
        .theme-toggle-button:focus { outline: none; }
        .theme-toggle-button, .theme-toggle-button * { user-select: none; }
        
        .toggle-content {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          position: relative;
          z-index: 1;
        }
        
        .icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .theme-text {
          display: block;
          min-width: 35px;
          text-align: left;
        }
        
        @media (max-width: 768px) {
          .theme-toggle-button {
            top: 1rem;
            right: 1rem;
            padding: 0.6rem 1rem;
            font-size: 0.8rem;
          }
          
          .theme-text {
            display: none;
          }
        }
      `}</style>
    </motion.button>
  );
}
