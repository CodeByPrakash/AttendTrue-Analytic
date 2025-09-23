import { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Scan, CheckCircle, AlertCircle, Loader } from 'lucide-react';

export default function FaceScanner({ onFaceDetected, feedbackMessage }) {
  const videoRef = useRef();
  const canvasRef = useRef();
  const streamRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [cameraStatus, setCameraStatus] = useState('initializing');
  const [detectionStatus, setDetectionStatus] = useState('waiting');

  const stopCamera = () => {
    try {
      const videoEl = videoRef.current;
      const stream = streamRef.current || (videoEl && videoEl.srcObject);
      if (stream && typeof stream.getTracks === 'function') {
        stream.getTracks().forEach((t) => {
          try { t.stop(); } catch {}
        });
      }
      if (videoEl) {
        try { videoEl.pause(); } catch {}
        videoEl.srcObject = null;
      }
      streamRef.current = null;
      setIsScanning(false);
      setCameraStatus('stopped');
    } catch {}
  };

  useEffect(() => {
    const startVideo = () => {
      setCameraStatus('connecting');
      navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
        .then(stream => {
          if (videoRef.current) {
            streamRef.current = stream;
            videoRef.current.srcObject = stream;
            setCameraStatus('ready');
            // Start scanning animation
            setIsScanning(true);
            // Simulate scan progress
            progressIntervalRef.current = setInterval(() => {
              setScanProgress(prev => {
                if (prev >= 100) {
                  if (progressIntervalRef.current) {
                    clearInterval(progressIntervalRef.current);
                    progressIntervalRef.current = null;
                  }
                  return 100;
                }
                return prev + 2;
              });
            }, 100);
          }
        })
        .catch(err => {
          console.error("Camera Error:", err);
          setCameraStatus('error');
        });
    };
    startVideo();

    // Cleanup function to stop the camera when the component is unmounted
    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      stopCamera();
    };
  }, []);

  const handleVideoPlay = async () => {
    setDetectionStatus('detecting');
    // This function is passed in as a prop to handle the detection logic
    const maybePromise = onFaceDetected(videoRef, canvasRef);
    // If the handler returns a Promise, stop camera once it resolves/rejects
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.finally(() => {
        stopCamera();
      });
    }
  };

  // Heuristic: if feedback indicates success, proactively stop camera
  useEffect(() => {
    if (!feedbackMessage) return;
    const text = String(feedbackMessage).toLowerCase();
    if (text.includes('saved') || text.includes('success') || text.includes('detected')) {
      stopCamera();
    }
  }, [feedbackMessage]);

  const getStatusIcon = () => {
    switch (cameraStatus) {
      case 'connecting':
        return <Loader className="animate-spin" size={24} />;
      case 'ready':
        return <Camera size={24} />;
      case 'error':
        return <AlertCircle size={24} />;
      default:
        return <Scan size={24} />;
    }
  };

  const getStatusColor = () => {
    switch (cameraStatus) {
      case 'connecting':
        return 'var(--warning)';
      case 'ready':
        return 'var(--success)';
      case 'error':
        return 'var(--error)';
      default:
        return 'var(--primary)';
    }
  };

  return (
    <motion.div 
      className="face-scanner-container"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      <div className="scanner-header">
        <motion.div 
          className="status-indicator"
          animate={{ color: getStatusColor() }}
          transition={{ duration: 0.3 }}
        >
          {getStatusIcon()}
          <span className="status-text">
            {cameraStatus === 'connecting' && 'Connecting to camera...'}
            {cameraStatus === 'ready' && 'Camera ready'}
            {cameraStatus === 'error' && 'Camera error'}
            {cameraStatus === 'initializing' && 'Initializing...'}
          </span>
        </motion.div>
        
        <motion.div 
          className="scan-progress"
          initial={{ width: 0 }}
          animate={{ width: `${scanProgress}%` }}
          transition={{ duration: 0.2 }}
        />
      </div>

      <motion.div 
        className="video-container"
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.3 }}
      >
        {/* Scanning overlay */}
        <AnimatePresence>
          {isScanning && (
            <motion.div
              className="scanning-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <motion.div
                className="scan-line"
                animate={{ 
                  y: [0, 375, 0],
                  opacity: [0.3, 1, 0.3]
                }}
                transition={{ 
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
              />
              
              {/* Corner brackets */}
              <div className="scan-corners">
                <motion.div 
                  className="corner top-left"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                <motion.div 
                  className="corner top-right"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                />
                <motion.div 
                  className="corner bottom-left"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                />
                <motion.div 
                  className="corner bottom-right"
                  animate={{ 
                    scale: [1, 1.1, 1],
                    opacity: [0.7, 1, 0.7]
                  }}
                  transition={{ duration: 1.5, repeat: Infinity, delay: 0.6 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <video
          ref={videoRef}
          autoPlay
          muted
          onPlay={handleVideoPlay}
          className="scanner-video"
        />
        <canvas 
          ref={canvasRef} 
          className="detection-canvas"
        />
      </motion.div>

      <AnimatePresence mode="wait">
        {feedbackMessage && (
          <motion.div
            key={feedbackMessage}
            className="feedback-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4 }}
          >
            <div className="message-content">
              {feedbackMessage.includes('success') || feedbackMessage.includes('detected') ? 
                <CheckCircle className="message-icon success" size={20} /> :
                <AlertCircle className="message-icon warning" size={20} />
              }
              <span>{feedbackMessage}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .face-scanner-container {
          position: relative;
          width: fit-content;
          margin: auto;
          padding: 1.5rem;
          background: var(--glass-bg);
          backdrop-filter: blur(20px);
          border-radius: 20px;
          border: 1px solid var(--glass-border);
          box-shadow: var(--shadow-elegant);
        }

        .scanner-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 1rem;
          padding: 0.75rem 1rem;
          background: rgba(var(--primary-rgb), 0.1);
          border-radius: 12px;
          position: relative;
          overflow: hidden;
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 500;
          font-size: 0.9rem;
        }

        .status-text {
          color: rgb(var(--foreground-rgb));
        }

        .scan-progress {
          position: absolute;
          bottom: 0;
          left: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--primary), var(--secondary));
          border-radius: 0 0 12px 12px;
        }

        .video-container {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: var(--shadow-soft);
        }

        .scanner-video {
          width: 100%;
          max-width: 640px;
          height: auto;
          display: block;
          border-radius: 16px;
        }

        .detection-canvas {
          position: absolute;
          top: 0;
          left: 0;
          border-radius: 16px;
        }

        .scanning-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          pointer-events: none;
          z-index: 2;
        }

        .scan-line {
          position: absolute;
          left: 0;
          right: 0;
          height: 2px;
          background: linear-gradient(90deg, 
            transparent, 
            var(--primary), 
            var(--secondary), 
            var(--primary), 
            transparent
          );
          box-shadow: 0 0 10px var(--primary);
        }

        .scan-corners {
          position: absolute;
          top: 20px;
          left: 20px;
          right: 20px;
          bottom: 20px;
        }

        .corner {
          position: absolute;
          width: 30px;
          height: 30px;
          border: 3px solid var(--primary);
        }

        .corner.top-left {
          top: 0;
          left: 0;
          border-right: none;
          border-bottom: none;
          border-top-left-radius: 8px;
        }

        .corner.top-right {
          top: 0;
          right: 0;
          border-left: none;
          border-bottom: none;
          border-top-right-radius: 8px;
        }

        .corner.bottom-left {
          bottom: 0;
          left: 0;
          border-right: none;
          border-top: none;
          border-bottom-left-radius: 8px;
        }

        .corner.bottom-right {
          bottom: 0;
          right: 0;
          border-left: none;
          border-top: none;
          border-bottom-right-radius: 8px;
        }

        .feedback-message {
          margin-top: 1rem;
          padding: 1rem;
          background: var(--glass-bg-dark);
          border-radius: 12px;
          border: 1px solid var(--glass-border);
          text-align: center;
        }

        .message-content {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          font-weight: 500;
        }

        .message-icon.success {
          color: var(--success);
        }

        .message-icon.warning {
          color: var(--warning);
        }

        @media (max-width: 768px) {
          .face-scanner-container {
            padding: 1rem;
            margin: 0.5rem;
          }

          .scanner-video {
            max-width: 100%;
          }

          .scan-corners {
            top: 10px;
            left: 10px;
            right: 10px;
            bottom: 10px;
          }

          .corner {
            width: 20px;
            height: 20px;
            border-width: 2px;
          }
        }
      `}</style>
    </motion.div>
  );
}
