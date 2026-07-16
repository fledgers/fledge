// LogIn.jsx
// Same layout as SignUp but simpler — just email/password, no name field.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { signInWithEmail, signInWithNus } from '../utils/auth';

export default function LogIn() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  async function handleNusSignIn() {
    setSubmitting(true);
    setErrorMessage('');

    try {
      await signInWithNus();
    } catch (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage('');

    try {
      await signInWithEmail({ email, password });
      navigate('/explore');
    } catch (error) {
      setSubmitting(false);
      setErrorMessage(error.message);
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
          Welcome back
        </h1>
        <p style={{ fontSize: '14px', color: '#9a9a8a', textAlign: 'center', marginBottom: '32px' }}>
          Log in to keep tracking your opportunities.
        </p>

        {/* NUS SSO */}
        <button
          disabled={submitting}
          onClick={handleNusSignIn}
          type="button"
          style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
          padding: '14px', borderRadius: '12px', border: '1.5px solid #e2ddd6', background: 'white',
          fontSize: '15px', fontWeight: 500, color: '#1a1a18', cursor: submitting ? 'wait' : 'pointer',
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1, height: '1px', background: '#e2ddd6' }} />
          <div style={{ fontSize: '12px', color: '#b0b0a8', whiteSpace: 'nowrap' }}>or log in with email</div>
          <div style={{ flex: 1, height: '1px', background: '#e2ddd6' }} />
        </div>

        <form onSubmit={handleSubmit}>
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
          <div style={{ marginBottom: '10px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, marginBottom: '6px' }}>Password</label>
            <input
              autoComplete="current-password"
              onChange={event => setPassword(event.target.value)}
              placeholder="Your password"
              required
              style={inputStyle}
              type="password"
              value={password}
            />
          </div>

          <p style={{ fontSize: '12px', color: '#C94F1A', marginBottom: '20px', cursor: 'pointer' }}>
            Forgot password?
          </p>

          {errorMessage && (
            <p
              role="alert"
              style={{
                background: '#FFF1ED', borderRadius: '6px', color: '#713217',
                fontSize: '12px', lineHeight: 1.45, marginBottom: '16px',
                padding: '10px 12px',
              }}
            >
              {errorMessage}
            </p>
          )}

          <button disabled={submitting} type="submit" style={{
            width: '100%', padding: '13px', background: '#C94F1A', color: 'white',
            border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 500,
            fontFamily: "'DM Sans', sans-serif", cursor: submitting ? 'wait' : 'pointer', marginBottom: '20px',
          }}>
            {submitting ? 'Logging in...' : 'Log in'}
          </button>
        </form>

        <p style={{ textAlign: 'center', fontSize: '13px', color: '#9a9a8a' }}>
          Don't have an account? <Link to="/signup" style={{ color: '#C94F1A', fontWeight: 500, textDecoration: 'none' }}>Sign up</Link>
        </p>

      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '11px 14px', border: '1px solid #e2ddd6',
  borderRadius: '10px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
  color: '#1a1a18', outline: 'none', background: '#FAFAF7',
};
