import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { TrendingUp, TrendingDown, Minus, ArrowUpRight } from 'lucide-react';

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue, 
  color = 'primary',
  delay = 0,
  animateValue = true
}) {
  const { ref, inView } = useInView({
    threshold: 0.1,
    triggerOnce: true
  });

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend === 'up') return <TrendingUp size={16} />;
    if (trend === 'down') return <TrendingDown size={16} />;
    return <Minus size={16} />;
  };

  const getTrendColor = () => {
    if (trend === 'up') return 'var(--success)';
    if (trend === 'down') return 'var(--error)';
    return 'var(--text-muted)';
  };

  const cardVariants = {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.9
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        delay: delay,
        ease: "easeOut"
      }
    }
  };

  const valueVariants = {
    hidden: { scale: 0 },
    visible: { 
      scale: 1,
      transition: {
        duration: 0.8,
        delay: delay + 0.3,
        ease: "backOut"
      }
    }
  };

  const iconVariants = {
    hidden: { rotate: -180, opacity: 0 },
    visible: { 
      rotate: 0, 
      opacity: 1,
      transition: {
        duration: 0.5,
        delay: delay + 0.2
      }
    }
  };

  return (
    <motion.div
      ref={ref}
      className={`stats-card stats-card-${color}`}
      variants={cardVariants}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      whileHover={{ 
        y: -8,
        scale: 1.02,
        transition: { duration: 0.3 }
      }}
    >
      <div className="card-header">
        <div className="title-section">
          {Icon && (
            <motion.div
              className="card-icon"
              variants={iconVariants}
              initial="hidden"
              animate={inView ? "visible" : "hidden"}
            >
              <Icon size={24} />
            </motion.div>
          )}
          <h3 className="card-title">{title}</h3>
        </div>
        
        {trend && (
          <motion.div
            className="trend-indicator"
            style={{ color: getTrendColor() }}
            initial={{ opacity: 0, x: 20 }}
            animate={inView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
            transition={{ delay: delay + 0.4, duration: 0.4 }}
          >
            {getTrendIcon()}
            {trendValue && <span className="trend-value">{trendValue}</span>}
          </motion.div>
        )}
      </div>

      <motion.div
        className="card-value"
        variants={animateValue ? valueVariants : {}}
        initial={animateValue ? "hidden" : false}
        animate={inView && animateValue ? "visible" : false}
      >
        {value}
      </motion.div>

      <motion.div
        className="card-glow"
        animate={{
          opacity: [0.3, 0.6, 0.3],
          scale: [1, 1.05, 1]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeInOut"
        }}
      />

      <style jsx>{`
        .stats-card {
          position: relative;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border: 1px solid var(--glass-border);
          border-radius: 20px;
          padding: 2rem;
          text-align: center;
          overflow: hidden;
          box-shadow: var(--shadow-elegant);
          transition: all 0.3s ease;
        }

        .stats-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: linear-gradient(135deg, 
            rgba(var(--primary-rgb), 0.1), 
            rgba(var(--secondary-rgb), 0.05)
          );
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .stats-card:hover::before {
          opacity: 1;
        }

        .stats-card-primary {
          --card-color: var(--primary);
        }

        .stats-card-secondary {
          --card-color: var(--secondary);
        }

        .stats-card-success {
          --card-color: var(--success);
        }

        .stats-card-warning {
          --card-color: var(--warning);
        }

        .stats-card-error {
          --card-color: var(--error);
        }

        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1.5rem;
          position: relative;
          z-index: 2;
        }

        .title-section {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }

        .card-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 48px;
          height: 48px;
          background: linear-gradient(135deg, 
            rgba(var(--primary-rgb), 0.2), 
            rgba(var(--secondary-rgb), 0.1)
          );
          border-radius: 12px;
          color: var(--card-color, var(--primary));
          border: 1px solid rgba(var(--primary-rgb), 0.2);
        }

        .card-title {
          margin: 0;
          font-size: 1rem;
          font-weight: 500;
          color: rgb(var(--foreground-rgb));
          text-align: left;
          opacity: 0.8;
        }

        .trend-indicator {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.875rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          background: rgba(var(--background-rgb), 0.5);
          border-radius: 20px;
          backdrop-filter: blur(10px);
        }

        .trend-value {
          font-size: 0.75rem;
        }

        .card-value {
          font-size: 3rem;
          font-weight: 700;
          background: linear-gradient(135deg, 
            var(--card-color, var(--primary)), 
            var(--secondary)
          );
          background-clip: text;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          margin: 0;
          line-height: 1;
          position: relative;
          z-index: 2;
        }

        .card-glow {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 100%;
          height: 100%;
          background: radial-gradient(circle, 
            rgba(var(--primary-rgb), 0.1) 0%, 
            transparent 70%
          );
          border-radius: 20px;
          pointer-events: none;
          z-index: 1;
        }

        @media (max-width: 768px) {
          .stats-card {
            padding: 1.5rem;
          }

          .card-header {
            margin-bottom: 1rem;
          }

          .title-section {
            flex-direction: column;
            align-items: flex-start;
            gap: 0.5rem;
          }

          .card-icon {
            width: 40px;
            height: 40px;
          }

          .card-value {
            font-size: 2.5rem;
          }

          .trend-indicator {
            position: absolute;
            top: 1rem;
            right: 1rem;
          }
        }
      `}</style>
    </motion.div>
  );
}
