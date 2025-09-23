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
  const [isGatheringNetwork, setIsGatheringNetwork] = useState(false);
  const [validationQuality, setValidationQuality] = useState(null);
  const videoRef = useRef(); // face scan video
  const canvasRef = useRef();
  const qrVideoRef = useRef(null); // QR scan video
  const qrCanvasRef = useRef(null);
  const qrScanIntervalRef = useRef(null);
  const qrStreamRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      if (faceapi && faceapi.nets?.ssdMobilenetv1?.loadFromUri) {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
      }
    };
    loadModels();
  }, []);

  const validateAndProceed = async (scannedSessionKey) => {
    setFeedback('Validating session...');
    try {
      const res = await fetch('/api/student/validate-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionKey: scannedSessionKey }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Session validation failed.');
      }

      setSessionKey(scannedSessionKey);
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
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
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
      setFeedback('Could not access camera. Please enable permissions and use a secure origin (https or localhost).');
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

  const startVideo = () => {
    navigator.mediaDevices.getUserMedia({ video: {} })
      .then(stream => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(err => setFeedback('Could not access camera. Please enable permissions.'));
  };

  useEffect(() => {
    if (step === 'faceScan') {
      startVideo();
    }
  }, [step]);

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
    try {
      if (!faceapi || !videoRef.current) return;
      const videoEl = videoRef.current;
      const displaySize = { width: videoEl.videoWidth, height: videoEl.videoHeight };
      if (canvasRef.current) faceapi.matchDimensions(canvasRef.current, displaySize);
      const detection = await faceapi
        .detectSingleFace(videoEl)
        .withFaceLandmarks()
        .withFaceDescriptor();
      if (detection && detection.descriptor && detection.descriptor.length === 128) {
        setFeedback('Face detected. Proceeding with validation...');
        // After detection, proceed to gather network info and submit attendance
        const net = networkInfo || await gatherNetworkInformation();
        await submitAttendanceWithBiometrics(Array.from(detection.descriptor), net);
      } else {
        setFeedback('No face detected. Please ensure good lighting and try again.');
      }
    } catch (e) {
      console.error('Face scan error:', e);
      setFeedback('Face scan failed. Please try again.');
    }
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
      if (!res.ok) throw new Error(result.message || 'Attendance marking failed');
      setFeedback(`✅ ${result.message}`);
      setTimeout(() => router.push('/student/dashboard'), 1500);
    } catch (e) {
      setFeedback(`❌ ${e.message}`);
    }
  };

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