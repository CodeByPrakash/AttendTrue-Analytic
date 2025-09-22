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
    
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.body.classList.add('dark-mode');
      setIsDarkMode(true);
    }
  }, []);

  const toggleTheme = () => {
    if (isDarkMode) {
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    }
    setIsDarkMode(!isDarkMode);
  };

  if (!mounted) return null;

  return (
    <motion.button
      onClick={toggleTheme}
      className="theme-toggle-button"
      whileHover={{ 
        scale: 1.05,
        boxShadow: '0 10px 30px rgba(var(--primary-rgb), 0.3)'
      }}
      whileTap={{ scale: 0.95 }}
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
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          color: rgb(var(--foreground-rgb));
          font-size: 0.9rem;
          font-weight: 500;
          box-shadow: var(--shadow-elegant);
          transition: all 0.3s ease;
          overflow: hidden;
          position: relative;
        }
        
        .theme-toggle-button::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(45deg, 
            rgba(var(--primary-rgb), 0.1), 
            rgba(var(--secondary-rgb), 0.1)
          );
          border-radius: inherit;
          opacity: 0;
          transition: opacity 0.3s ease;
        }
        
        .theme-toggle-button:hover::before {
          opacity: 1;
        }
        
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
