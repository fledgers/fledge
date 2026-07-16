// SignUp.jsx
// The sign up page — NUS email SSO button + fallback email/password form.
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithNus, signUpWithEmail } from '../utils/auth';

export default function SignUp() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('idle');
  const [message, setMessage] = useState('');

  async function handleNusSignIn() {
    setStatus('submitting');
    setMessage('');

    try {
      await signInWithNus();
    } catch (error) {
      setStatus('idle');
      setMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setStatus('submitting');
    setMessage('');

    try {
      const data = await signUpWithEmail({ fullName, email, password });
      if (data.session) {
        navigate('/explore');
        return;
      }

      setStatus('success');
      setMessage('Check your email to confirm your account, then log in.');
    } catch (error) {
      setStatus('idle');
      setMessage(error.message);
    }
  }

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif",
      background: '#F5F2ED',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 20px',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '44px 40px',
        width: '100%',
        maxWidth: '420px',
        border: '1px solid #e2ddd6',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>

        {/* Logo */}
        <Link to="/" style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          fontFamily: "'Fraunces', serif", fontSize: '20px', fontWeight: 600,
          color: '#C94F1A', justifyContent: 'center', marginBottom: '32px',
          textDecoration: 'none',
        }}>
          <svg width="24" height="18" viewBox="0 0 28 22" fill="none">
            <path d="M2 14 C6 10,10 6,16 8 C18 4,22 2,26 3 C24 6,20 8,18 9 C22 9,25 11,26 14 C22 12,18 11,14 13 C10 15,6 18,4 20 C3 18,2 16,2 14Z" fill="#C94F1A"/>
            <path d="M14 13 C12 16,9 19,6 21" stroke="#C94F1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            <circle cx="22" cy="4.5" r="1.2" fill="#1a1a18"/>
          </svg>
          Fledge
        </Link>

        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '26px', fontWeight: 600, textAlign: 'center', marginBottom: '6px' }}>
          Create your account
        </h1>
        <p style={{ fontSize: '14px', color: '#9a9a8a', textAlign: 'center', marginBottom: '32px', lineHeight: 1.5 }}>
          NUS students only. Use your school email to get started.
        </p>

        {/* NUS / Microsoft SSO button */}
        <button
          disabled={status === 'submitting'}
          onClick={handleNusSignIn}
          type="button"
          style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '14px', borderRadius: '12px', border: '1.5px solid #e2ddd6', background: 'white',
          fontSize: '15px', fontWeight: 500, color: '#1a1a18', cursor: status === 'submitting' ? 'wait' : 'pointer',
          fontFamily: "'DM Sans', sans-serif", marginBottom: '24px',
          boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        }}>
          <svg width="20" height="20" viewBox="0 0 21 21" fill="none">
            <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
            <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
            <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
            <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
          </svg>
          Continue with NUS Email
        </button>

        <div style={{
          background: '#FEF0E7', borderRadius: '10px', padding: '12px 14px',
          fontSize: '12px', color: '#7a5a40', textAlign: 'center', marginBottom: '24px', lineHeight: 1.5,
        }}>
          🎓 You'll be redirected to the NUS Microsoft login page. Use your NUSNET ID and password — same as your NUS email.
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2ddd6' }} />
          <div style={{ fontSize: '12px', color: '#b0b0a8', whiteSpace: 'nowrap' }}>or sign up with any email</div>
          <div style={{ flex: 1, height: '1px', background: '#e2ddd6' }} />
        </div>

        {/* Email/password form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Full name</label>
            <input
              autoComplete="name"
              onChange={event => setFullName(event.target.value)}
              placeholder="Your name"
              required
              style={inputStyle}
              type="text"
              value={fullName}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Email</label>
            <input
              autoComplete="email"
              onChange={event => setEmail(event.target.value)}
              placeholder="e0123456@u.nus.edu"
              required
              style={inputStyle}
              type="email"
              value={email}
            />
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Password</label>
            <input
              autoComplete="new-password"
              minLength={8}
              onChange={event => setPassword(event.target.value)}
              placeholder="Min. 8 characters"
              required
              style={inputStyle}
              type="password"
              value={password}
            />
          </div>

          {message && (
            <p
              role={status === 'success' ? 'status' : 'alert'}
              style={{
                background: status === 'success' ? '#E8F5E9' : '#FFF1ED',
                color: status === 'success' ? '#2A6E2A' : '#713217',
                fontSize: '12px', lineHeight: 1.45, padding: '10px 12px',
                borderRadius: '6px', marginBottom: '16px',
              }}
            >
              {message}
            </p>
          )}

          <button disabled={status === 'submitting'} type="submit" style={{
            width: '100%', padding: '13px', background: '#C94F1A', color: 'white',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif", cursor: status === 'submitting' ? 'wait' : 'pointer', marginTop: '4px', marginBottom: '20px',
          }}>
            {status === 'submitting' ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#9a9a8a' }}>
          Already have an account? <Link to="/login" style={{ color: '#C94F1A', fontWeight: 500, textDecoration: 'none' }}>Log in</Link>
        </p>

      </div>
    </div>
  );
}

// Shared input styling — used by all 3 fields above
const inputStyle = {
  width: '100%', padding: '11px 14px', border: '1px solid #e2ddd6',
  borderRadius: '10px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
  color: '#1a1a18', outline: 'none', background: '#FAFAF7',
};
