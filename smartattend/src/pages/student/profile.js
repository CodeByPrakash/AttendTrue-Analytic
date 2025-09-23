import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { getAuthenticatedUser } from '../../lib/auth-helper';

const FaceScanner = dynamic(() => import('../../components/FaceScanner'), { ssr: false });
let faceapi;

export default function ProfilePage({ user, authType }) {
  const scanIntervalRef = useRef(null);
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    rollNo: user?.rollNo || '',
    registrationNo: user?.registrationNo || '',
    section: user?.section || '',
    branch: user?.branch || '',
    address: user?.address || '',
    phoneNumber: user?.phoneNumber || '',
    profileImageUrl: user?.profileImageUrl || '',
    faceDescriptor: user?.faceDescriptor || [],
  });
  // Biometric PIN (ATM-style) local state; not persisted directly
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [isRegisteringFace, setIsRegisteringFace] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');
  const [imageBase64, setImageBase64] = useState('');
  const router = useRouter();

  useEffect(() => {
    const loadFaceApi = async () => {
      faceapi = await import('face-api.js');
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri('/models'),
        faceapi.nets.faceLandmark68Net.loadFromUri('/models'),
        faceapi.nets.faceRecognitionNet.loadFromUri('/models'),
      ]);
    };
    loadFaceApi();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageBase64(reader.result);
        setFormData((prev) => ({ ...prev, profileImageUrl: '' }));
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFaceRegistration = async (videoRef, canvasRef) => {
    setFeedback('Please look directly at the camera...');
    return new Promise((resolve) => {
      // Clear any previous scan loop
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      scanIntervalRef.current = setInterval(async () => {
        if (!videoRef.current || !canvasRef.current) return;

        const detections = await faceapi
          .detectSingleFace(videoRef.current)
          .withFaceLandmarks()
          .withFaceDescriptor();
        if (detections) {
          setFeedback('Face detected! Saving...');
          setFormData((prev) => ({ ...prev, faceDescriptor: Array.from(detections.descriptor) }));
          if (scanIntervalRef.current) {
            clearInterval(scanIntervalRef.current);
            scanIntervalRef.current = null;
          }
          setTimeout(() => {
            setIsRegisteringFace(false);
            setFeedback('Face scan saved. Click "Save All Changes" to confirm.');
            resolve();
          }, 300);
        } else {
          setFeedback('No face detected. Please position yourself in the center.');
        }
      }, 700);
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('Saving...');
    const payload = { ...formData };
    if (imageBase64) {
      payload.profileImageBase64 = imageBase64;
    }
    if (formData.faceDescriptor.length > 0) {
        payload.pendingFaceDescriptor = formData.faceDescriptor;
    }
    // Attach biometric PIN if provided and valid
    const pinTrim = pin.trim();
    if (pinTrim) {
      if (!/^\d{4,6}$/.test(pinTrim)) {
        setMessage('PIN must be 4-6 digits.');
        return;
      }
      if (pinTrim !== pinConfirm.trim()) {
        setMessage('PIN and confirm PIN do not match.');
        return;
      }
      payload.biometricPin = pinTrim;
    }

    const res = await fetch('/api/student/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage('Profile updated successfully!');
      // Clear local PINs after save
      setPin('');
      setPinConfirm('');
      router.replace(router.asPath);
    } else {
      setMessage(`Error: ${data.message}`);
    }
  };

  const currentImage = imageBase64 || formData.profileImageUrl;
  const faceScanStatus = user?.faceScanStatus || 'none';

  return (
    <div className="container">
      <div className="glass-card" style={{maxWidth: '700px'}}>
        <Link href="/student/dashboard" style={{ textDecoration: 'underline' }}>
          &larr; Back to Dashboard
        </Link>
        <h1 style={{marginTop: '1rem'}}>Your Profile</h1>
        <p style={{marginBottom: '2rem', opacity: 0.8}}>Update your personal, academic, and contact details.</p>
        
        <form onSubmit={handleSubmit}>
          {/* Personal Details */}
          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '1rem'}}>Personal Details</h2>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label className="form-label" htmlFor="firstName">First Name</label>
              <input id="firstName" name="firstName" type="text" value={formData.firstName} onChange={handleInputChange} className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="lastName">Last Name</label>
              <input id="lastName" name="lastName" type="text" value={formData.lastName} onChange={handleInputChange} className="form-input" />
            </div>
          </div>

          {/* Academic Details */}
          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0'}}>Academic Details</h2>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label className="form-label" htmlFor="rollNo">Roll Number</label>
              <input id="rollNo" name="rollNo" type="text" value={formData.rollNo} onChange={handleInputChange} className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="registrationNo">Registration Number</label>
              <input id="registrationNo" name="registrationNo" type="text" value={formData.registrationNo} onChange={handleInputChange} className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="branch">Branch</label>
              <input id="branch" name="branch" type="text" value={formData.branch} onChange={handleInputChange} className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="section">Section</label>
              <input id="section" name="section" type="text" value={formData.section} onChange={handleInputChange} className="form-input" />
            </div>
          </div>

          {/* Contact Details */}
          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0'}}>Contact Details</h2>
          <label className="form-label" htmlFor="address">Address</label>
          <textarea id="address" name="address" value={formData.address} onChange={handleInputChange} className="form-input" rows="3"></textarea>
          <label className="form-label" htmlFor="phoneNumber">Phone Number</label>
          <input id="phoneNumber" name="phoneNumber" type="tel" value={formData.phoneNumber} onChange={handleInputChange} className="form-input" />

          {/* Profile Picture */}
          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0'}}>Profile Picture</h2>
          {currentImage && <img src={currentImage} alt="Preview" style={{width: '100px', height: '100px', borderRadius: '50%', objectFit: 'cover', marginBottom: '1rem'}}/>}
          <label className="form-label" htmlFor="imageFile">Upload Image</label>
          <input id="imageFile" type="file" accept="image/*" onChange={handleImageChange} className="form-input" />
          <label className="form-label" htmlFor="profileImageUrl">Or Image URL</label>
          <input id="profileImageUrl" name="profileImageUrl" type="url" value={formData.profileImageUrl} onChange={handleInputChange} className="form-input" />

          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0'}}>Biometric Verification</h2>
          {faceScanStatus === 'approved' && <p style={{color: 'green'}}>✓ Face Scan Approved</p>}
          {faceScanStatus === 'pending' && <p style={{color: 'orange'}}>i Face Scan Pending Admin Approval</p>}
          {faceScanStatus === 'rejected' && <p style={{color: 'red'}}>✗ Face Scan Rejected. Please try again.</p>}
          
          <button type="button" className="form-button" onClick={() => setIsRegisteringFace(true)} style={{marginTop: '1rem', background: '#555'}}>
            {faceScanStatus === 'approved' ? 'Re-register Your Face' : 'Register Your Face'}
          </button>

          {isRegisteringFace && (
            <div className="modal">
              <FaceScanner onFaceDetected={handleFaceRegistration} feedbackMessage={feedback} />
              <button
                type="button"
                onClick={() => {
                  if (scanIntervalRef.current) {
                    clearInterval(scanIntervalRef.current);
                    scanIntervalRef.current = null;
                  }
                  setFeedback('Scan cancelled.');
                  setIsRegisteringFace(false);
                }}
                style={{ marginTop: '1rem' }}
              >
                Cancel
              </button>
            </div>
          )}
          {/* Biometric PIN Fallback */}
          <h2 style={{fontSize: '1.2rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', margin: '2rem 0 1rem 0'}}>Biometric PIN (Fallback)</h2>
          <p style={{ opacity: 0.8, marginBottom: '0.75rem' }}>
            Set a 4-6 digit PIN to use as a fallback when face scan isn’t available. This PIN is stored securely.
          </p>
          <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem'}}>
            <div>
              <label className="form-label" htmlFor="pin">New PIN</label>
              <input id="pin" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} placeholder="4-6 digits"
                     value={pin} onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))} className="form-input" />
            </div>
            <div>
              <label className="form-label" htmlFor="pinConfirm">Confirm PIN</label>
              <input id="pinConfirm" type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} placeholder="re-enter"
                     value={pinConfirm} onChange={(e) => setPinConfirm(e.target.value.replace(/[^0-9]/g, ''))} className="form-input" />
            </div>
          </div>

          {message && <p style={{textAlign: 'center', margin: '1rem 0'}}>{message}</p>}
          <button type="submit" className="form-button" style={{marginTop: '2rem'}}>Save All Changes</button>
        </form>
      </div>
    </div>
  );
}

export async function getServerSideProps(context) {
  const user = await getAuthenticatedUser(context);
  if (!user || user.role !== 'student') {
    return { redirect: { destination: '/login', permanent: false } };
  }
  const authType = 'Traditional';
  return {
    props: { 
      user: JSON.parse(JSON.stringify(user)),
      authType
    },
  };
}
