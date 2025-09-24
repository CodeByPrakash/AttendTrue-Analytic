import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getAuthenticatedUser } from '../../lib/auth-helper';
import { gatherNetworkInfo, validateNetworkInfoQuality } from '../../utils/networkDetection';
import jsQR from 'jsqr';

// Note: We use native camera + jsQR instead of a 3rd-party QR component

let faceapi;
if (typeof window !== 'undefined') {
  import('face-api.js').then(api => {
    faceapi = api;
  });
}

export default function JoinSessionPage({ user, hasProfileImage, needsReverification }) {
  const router = useRouter();
  
  const [mode, setMode] = useState('choice');
  const [step, setStep] = useState('scan');
  const [feedback, setFeedback] = useState('Choose how you want to join the session.');
  const [sessionKey, setSessionKey] = useState('');
  const [networkInfo, setNetworkInfo] = useState(null);
  const [requiredSsid, setRequiredSsid] = useState('');
  const [requireSameNetwork, setRequireSameNetwork] = useState(false);
  const [networkGateVisible, setNetworkGateVisible] = useState(false);
  const [checkingNet, setCheckingNet] = useState(false);
  const [networkOk, setNetworkOk] = useState(false);
  const [isGatheringNetwork, setIsGatheringNetwork] = useState(false);
  const [validationQuality, setValidationQuality] = useState(null);
  const videoRef = useRef(); // face scan video
  const canvasRef = useRef();
  const faceScanRafRef = useRef(null);
  const faceStreamRef = useRef(null);
  const modelsLoadedRef = useRef(false);
  const qrVideoRef = useRef(null); // QR scan video
  const qrCanvasRef = useRef(null);
  const qrScanIntervalRef = useRef(null);
  const qrStreamRef = useRef(null);
  const fileInputRef = useRef(null);
  const [qrUploadFallback, setQrUploadFallback] = useState(false);
  const [modelsStatus, setModelsStatus] = useState('');

  useEffect(() => {
    // Best-effort eager model preload; detection will also ensure loading at runtime
    const loadModels = async () => {
      try {
        // Ensure faceapi is available
        if (!faceapi) {
          const mod = await import('face-api.js');
          faceapi = mod;
        }
        const MODEL_URL = '/models';
        // Prefer tiny models for mobile performance
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        modelsLoadedRef.current = true;
        setModelsStatus('models-ready');
      } catch (err) {
        // Non-blocking; runtime will retry
        setModelsStatus('models-load-error');
      }
    };
    loadModels();
  }, []);

  const ensureModelsLoaded = async () => {
    if (modelsLoadedRef.current) return true;
    try {
      if (!faceapi) {
        const mod = await import('face-api.js');
        faceapi = mod;
      }
      const MODEL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
      ]);
      modelsLoadedRef.current = true;
      setModelsStatus('models-ready');
      return true;
    } catch (e) {
      setModelsStatus('models-load-error');
      return false;
    }
  };

  const validateAndProceed = async (scannedSessionKey) => {
    setFeedback('Validating session...');
    try {
      const res = await fetch('/api/student/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: scannedSessionKey }),
      });
      const meta = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(meta?.message || 'Session validation failed.');
      }

      setSessionKey(scannedSessionKey);
      // Read required network from session meta for UI hint
      try {
        const netReq = meta?.session?.validationRequirements?.network;
        if (netReq?.requireSamePublicIp) {
          setRequireSameNetwork(true);
          setRequiredSsid(netReq?.ssid || '');
          setNetworkGateVisible(true);
        } else {
          setRequireSameNetwork(false);
          setNetworkGateVisible(false);
          setNetworkOk(true);
        }
      } catch {}
      if (needsReverification) {
        setStep('promptToReverify');
        setFeedback('Your face scan is older than 6 months. Please go to your profile to re-verify.');
      } else if (hasProfileImage) {
        setStep('faceScan');
        setFeedback('Session validated. Please verify your face.');
      } else {
        setStep('promptToSetImage');
        setFeedback('Session validated. You must set a profile picture for verification.');
      }
    } catch (e) {
      setFeedback(e.message);
      setMode('choice'); // Go back to choice on error
    }
  };

  const parseScannedText = (text) => {
    try {
      let code = String(text || '').trim();
      if (!code) return '';
      if (code.startsWith('{') || code.startsWith('[')) {
        const parsed = JSON.parse(code);
        code = parsed.sessionKey || '';
      }
      return code;
    } catch {
      return '';
    }
  };

  const stopQrCamera = () => {
    if (qrScanIntervalRef.current) {
      clearInterval(qrScanIntervalRef.current);
      qrScanIntervalRef.current = null;
    }
    const stream = qrStreamRef.current;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
    }
    qrStreamRef.current = null;
    if (qrVideoRef.current) {
      try { qrVideoRef.current.pause(); } catch {}
      qrVideoRef.current.srcObject = null;
    }
  };

  const startQrCamera = async () => {
    setFeedback('Initializing camera for QR scan...');
    try {
      const constraints = {
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      const stream = await getUserMediaSafe(constraints);
      qrStreamRef.current = stream;
      if (qrVideoRef.current) {
        qrVideoRef.current.srcObject = stream;
        await qrVideoRef.current.play().catch(() => {});
      }
      // Start scanning loop at ~5fps for performance
      qrScanIntervalRef.current = setInterval(() => {
        try {
          const video = qrVideoRef.current;
          if (!video || video.readyState < 2) return; // HAVE_CURRENT_DATA
          const canvas = qrCanvasRef.current || document.createElement('canvas');
          if (!qrCanvasRef.current) qrCanvasRef.current = canvas;
          const width = video.videoWidth || 640;
          const height = video.videoHeight || 480;
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, width, height);
          const imageData = ctx.getImageData(0, 0, width, height);
          const result = jsQR(imageData.data, width, height, { inversionAttempts: 'dontInvert' });
          if (result && result.data) {
            const code = parseScannedText(result.data);
            if (code) {
              stopQrCamera();
              validateAndProceed(code);
            }
          }
        } catch (err) {
          // Non-fatal per-frame errors
        }
      }, 200);
      setFeedback('Point the QR code inside the box.');
    } catch (err) {
      console.error('QR camera error:', err);
      setFeedback('Could not access camera. On mobile, camera requires HTTPS or localhost. You can also upload a QR photo below.');
      setQrUploadFallback(true);
    }
  };

  const handleCodeSubmit = (e) => {
    e.preventDefault();
    if (sessionKey) {
      validateAndProceed(sessionKey);
    } else {
      setFeedback('Please enter a session code.');
    }
  };

  const gatherNetworkInformation = async () => {
    setIsGatheringNetwork(true);
    setFeedback('Gathering network information for validation...');
    
    try {
      const networkData = await gatherNetworkInfo();
      const quality = validateNetworkInfoQuality(networkData);
      
      setNetworkInfo(networkData);
      setValidationQuality(quality);
      
      if (!quality.isAcceptable) {
        setFeedback('⚠️ Limited network validation available. Some features may require manual input.');
      } else {
        setFeedback('✅ Network information gathered successfully.');
      }
      
      return networkData;
    } catch (error) {
      console.error('Network gathering failed:', error);
      setFeedback('❌ Could not gather network information. Manual validation may be required.');
      return null;
    } finally {
      setIsGatheringNetwork(false);
    }
  };

  const proceedToAttendanceMarking = async () => {
    setFeedback('Marking attendance with multi-factor validation...');
    
    try {
      // Gather fresh network info if not already available
      const currentNetworkInfo = networkInfo || await gatherNetworkInformation();
      
      const res = await fetch('/api/student/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sessionId: sessionKey,
          method: 'multi-factor',
          networkInfo: currentNetworkInfo,
          biometricData: user.faceDescriptor ? { verified: true } : null
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          // Session expired or missing; send back to login
          router.push('/login?error=SessionExpired');
          return;
        }
        throw new Error(result.message || 'Attendance marking failed');
      }

      setFeedback(`✅ ${result.message}`);
      
      // Show validation details if available
      if (result.validationDetails) {
        setTimeout(() => {
          alert(`Attendance marked successfully!\n\nValidation Details:\n${JSON.stringify(result.validationDetails, null, 2)}`);
          router.push('/student/dashboard');
        }, 2000);
      } else {
        setTimeout(() => router.push('/student/dashboard'), 2000);
      }

    } catch (error) {
      setFeedback(`❌ ${error.message}`);
      console.error('Attendance marking error:', error);
    }
  };

  const checkNetworkMatches = async () => {
    setCheckingNet(true);
    try {
      // Best-effort ping to reflect current public IP; server enforces on submit
      await fetch('/api/network/echo', { cache: 'no-store' }).catch(() => {});
      setNetworkOk(true);
      setNetworkGateVisible(false);
      // If face scan is the next step, inform the user; otherwise proceed with proximity-only
      if (step === 'faceScan') {
        setFeedback('Network confirmed. Proceeding to face scan...');
        // face scan flow will continue via handleVideoOnPlay
      } else {
        setFeedback('Network confirmed. Proceeding...');
        // Proceed using multi-factor (network) without biometrics
        proceedToAttendanceMarking();
      }
    } finally {
      setCheckingNet(false);
    }
  };

  const stopFaceCamera = () => {
    if (faceScanRafRef.current) {
      cancelAnimationFrame(faceScanRafRef.current);
      faceScanRafRef.current = null;
    }
    const stream = faceStreamRef.current;
    if (stream && typeof stream.getTracks === 'function') {
      stream.getTracks().forEach(t => {
        try { t.stop(); } catch {}
      });
    }
    faceStreamRef.current = null;
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch {}
      videoRef.current.srcObject = null;
    }
  };

  const startFaceScan = async () => {
    try {
      setFeedback('Preparing face scan...');
      const ok = await ensureModelsLoaded();
      if (!ok) {
        setFeedback('Face models failed to load. Check your network and try again.');
        return;
      }
      // Prefer front camera on phones
      const constraints = {
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      };
      const stream = await getUserMediaSafe(constraints);
      faceStreamRef.current = stream;
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play().catch(() => {});

      // Align canvas to video
      const videoEl = videoRef.current;
      const canvasEl = canvasRef.current;
      const setupCanvas = () => {
        if (!videoEl || !canvasEl) return;
        const w = videoEl.videoWidth || 640;
        const h = videoEl.videoHeight || 480;
        canvasEl.width = w;
        canvasEl.height = h;
      };
      setupCanvas();

      const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 192, scoreThreshold: 0.5 });
      const ctx = canvasEl?.getContext('2d') || null;

      const loop = async () => {
        if (!videoRef.current || !canvasRef.current) return; // component unmounted
        try {
          const v = videoRef.current;
          if (v.readyState < 2) {
            faceScanRafRef.current = requestAnimationFrame(loop);
            return;
          }
          // Clear and draw current frame lightly for UX
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
          const detection = await faceapi
            .detectSingleFace(v, options)
            .withFaceLandmarks(true)
            .withFaceDescriptor();

          if (detection && detection.descriptor && detection.descriptor.length === 128) {
            // Draw box for feedback
            if (ctx && detection.detection) {
              const box = detection.detection.box;
              ctx.strokeStyle = '#4ade80';
              ctx.lineWidth = 3;
              ctx.strokeRect(box.x, box.y, box.width, box.height);
            }
            setFeedback('Face detected. Verifying...');
            // Stop loop and submit
            cancelAnimationFrame(faceScanRafRef.current);
            faceScanRafRef.current = null;
            const net = networkInfo || await gatherNetworkInformation();
            await submitAttendanceWithBiometrics(Array.from(detection.descriptor), net);
            // After submission, stop camera
            stopFaceCamera();
            return;
          } else {
            setFeedback('Looking for your face. Hold steady and ensure good lighting.');
          }
        } catch (err) {
          // Soft-fail and continue the loop
        }
        faceScanRafRef.current = requestAnimationFrame(loop);
      };
      faceScanRafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      setFeedback('Could not access camera for face scan. Ensure HTTPS and grant permission.');
    }
  };

  useEffect(() => {
    if (step === 'faceScan') {
      startFaceScan();
    } else {
      stopFaceCamera();
    }
    return () => {
      if (step !== 'faceScan') return;
      stopFaceCamera();
    };
  }, [step]);

  // Proactively inform the user if the context is insecure (no HTTPS/localhost)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocalhost = host === 'localhost' || host === '127.0.0.1';
      if (!window.isSecureContext && !isLocalhost) {
        setQrUploadFallback(true);
        setFeedback('Camera requires HTTPS or localhost. Upload a photo of the QR, enter the code manually, or open this page over HTTPS.');
      }
    }
  }, []);

  // Start/stop QR camera based on UI state
  useEffect(() => {
    if (mode === 'qr' && step === 'scan') {
      startQrCamera();
    } else {
      stopQrCamera();
    }
    return () => stopQrCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, step]);

  const handleVideoOnPlay = async () => {
    // Kept for compatibility; actual detection runs via startFaceScan loop
  };

  const submitAttendanceWithBiometrics = async (descriptor, net) => {
    try {
      const res = await fetch('/api/student/mark-attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: sessionKey,
          method: 'multi-factor',
          networkInfo: net,
          biometricData: { verified: true, faceDescriptor: descriptor }
        })
      });
      const result = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          router.push('/login?error=SessionExpired');
          return;
        }
        throw new Error(result.message || 'Attendance marking failed');
      }
      setFeedback(`✅ ${result.message}`);
      setTimeout(() => router.push('/student/dashboard'), 1500);
    } catch (e) {
      setFeedback(`❌ ${e.message}`);
    }
  };

  // Utilities: safe getUserMedia and QR photo upload
  function ensureMediaDevices() {
    if (typeof navigator === 'undefined') return;
    if (!navigator.mediaDevices) navigator.mediaDevices = {};
    if (!navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia = function (constraints) {
        const getUM = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
        if (!getUM) {
          return Promise.reject(new Error('getUserMedia not supported'));
        }
        return new Promise((resolve, reject) => getUM.call(navigator, constraints, resolve, reject));
      };
    }
  }

  async function getUserMediaSafe(constraints) {
    ensureMediaDevices();
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not available');
    }
    // Mobile browsers require secure context (HTTPS) or localhost
    const isSecure = typeof window !== 'undefined' && (window.isSecureContext || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    if (!isSecure) {
      throw new Error('Insecure context: use HTTPS or localhost for camera');
    }
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  async function handleQrPhotoUpload(e) {
    try {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const result = jsQR(imageData.data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
        if (result && result.data) {
          const code = parseScannedText(result.data);
          if (code) {
            validateAndProceed(code);
            setFeedback('QR decoded from photo. Validating...');
          } else {
            setFeedback('Could not read a valid session code from the image.');
          }
        } else {
          setFeedback('No QR code found in the image.');
        }
      };
      img.onerror = () => setFeedback('Failed to load the selected image.');
      const reader = new FileReader();
      reader.onload = (ev) => {
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('QR photo upload error:', err);
      setFeedback('Could not decode the QR image.');
    }
  }

  return (
    <div className="container">
      <div className="glass-card" style={{maxWidth: '550px'}}>
        <button onClick={() => router.back()}>&larr; Back</button>
        <h1 style={{textAlign: 'center'}}>Join Session</h1>
        <p style={{textAlign: 'center', marginBottom: '2rem'}}>{feedback}</p>

        {mode === 'choice' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '1rem'}}>
            <button className="form-button" onClick={() => { setMode('qr'); setFeedback('Point the QR code inside the box.'); }}>
              Scan QR Code
            </button>
            <button className="form-button" onClick={() => { setMode('code'); setFeedback('Enter the code from your teacher.'); }}>
              Enter Session Code
            </button>
          </div>
        )}

        {mode === 'qr' && step === 'scan' && (
          <div className="scanner-container" style={{ position: 'relative' }}>
            <video
              ref={qrVideoRef}
              autoPlay
              playsInline
              muted
              style={{ width: '100%', maxWidth: 500, borderRadius: 12 }}
            />
            {/* Optional canvas for debugging; we use an offscreen canvas for jsQR */}
            <div className="viewfinder" style={{
              position: 'absolute',
              top: '10%', left: '10%', right: '10%', bottom: '10%',
              border: '3px solid rgba(255,255,255,0.8)', borderRadius: 16,
              pointerEvents: 'none'
            }} />
            {qrUploadFallback && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: '#777', marginBottom: 8 }}>No camera? Upload a photo of the QR code:</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleQrPhotoUpload}
                />
              </div>
            )}
          </div>
        )}

        {mode === 'code' && step === 'scan' && (
          <form onSubmit={handleCodeSubmit}>
            <input type="text" className="form-input" placeholder="Enter session code..." value={sessionKey} onChange={(e) => setSessionKey(e.target.value)} />
            <button type="submit" className="form-button">Submit Code</button>
          </form>
        )}

        {step === 'faceScan' && (
          <div style={{position: 'relative', width: 'fit-content', margin: 'auto'}}>
            <video ref={videoRef} autoPlay muted onPlay={handleVideoOnPlay} width="500" height="375" />
            <canvas ref={canvasRef} style={{position: 'absolute', top: 0, left: 0}} />
          </div>
        )}

        {(step === 'promptToSetImage' || step === 'promptToReverify') && (
          <div style={{textAlign: 'center'}}>
            <p style={{marginBottom: '1.5rem'}}>{feedback}</p>
            <Link href="/student/profile" className="form-button">
              Go to Profile
            </Link>
          </div>
        )}

        {networkGateVisible && !networkOk && (
          <div style={{ marginTop: '1.5rem', padding: '1rem', border: '1px dashed var(--glass-border)', borderRadius: 12 }}>
            <h3 style={{ marginBottom: 6 }}>Connect to the class Wi‑Fi</h3>
            <p style={{ color: '#666', marginBottom: 10 }}>
              Please connect to {requiredSsid ? <b>{requiredSsid}</b> : 'the required network'} and then continue.
            </p>
            <button className="form-button" onClick={checkNetworkMatches} disabled={checkingNet}>
              I am connected, continue
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const user = await getAuthenticatedUser(context);

  if (!user || user.role !== 'student') {
    return { redirect: { destination: '/login' } };
  }

  // Consider face usable for verification when approved descriptor exists under biometrics
  const hasProfileImage = !!(user.faceScanStatus === 'approved' && user.biometrics && Array.isArray(user.biometrics.faceDescriptor) && user.biometrics.faceDescriptor.length > 0);
  
  let needsReverification = false;
  if (user.faceScanTimestamp) {
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    if (new Date(user.faceScanTimestamp) < sixMonthsAgo) {
      needsReverification = true;
    }
  }

  return { 
    props: { 
      user: JSON.parse(JSON.stringify(user)),
      hasProfileImage,
      needsReverification
    } 
  };
}