// Navbar.jsx
// Now uses React Router's Link (instead of plain <a>) so clicking
// nav items changes the page WITHOUT a full browser reload.
// `activePage` prop tells the navbar which link to highlight orange.

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useOpportunities } from '../hooks/useOpportunities';
import { signOut } from '../utils/auth';

export default function Navbar({ activePage }) {
  const navigate = useNavigate();
  const { profile, user } = useOpportunities();
  const [signOutError, setSignOutError] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const navLinks = [
    { label: 'Explore', path: '/explore' },
    { label: 'Saved', path: '/saved' },
    { label: 'For You', path: '/for-you' },
    ...(user ? [{ label: 'Outlook', path: '/outlook' }] : []),
  ];

  async function handleSignOut() {
    setSignOutError('');
    setSigningOut(true);

    try {
      await signOut();
      navigate('/');
    } catch (error) {
      setSigningOut(false);
      setSignOutError(error.message);
    }
  }

  return (
    <nav style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '18px 48px',
      borderBottom: '1px solid #e2ddd6',
      background: '#FAFAF7',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>

      {/* Logo links back to landing page */}
      <Link to="/" style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        fontFamily: "'Fraunces', serif", fontSize: '21px', fontWeight: 600,
        color: '#C94F1A', textDecoration: 'none',
      }}>
        <svg width="26" height="20" viewBox="0 0 28 22" fill="none">
          <path d="M2 14 C6 10,10 6,16 8 C18 4,22 2,26 3 C24 6,20 8,18 9 C22 9,25 11,26 14 C22 12,18 11,14 13 C10 15,6 18,4 20 C3 18,2 16,2 14Z" fill="#C94F1A"/>
          <path d="M14 13 C12 16,9 19,6 21" stroke="#C94F1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <circle cx="22" cy="4.5" r="1.2" fill="#1a1a18"/>
        </svg>
        Fledge
      </Link>

      {/* Nav links — highlights orange + underline when active */}
      <ul style={{ display: 'flex', gap: '32px', listStyle: 'none', margin: 0, padding: 0 }}>
        {navLinks.map(link => {
          const isActive = activePage === link.label;
          return (
            <li key={link.label}>
              <Link to={link.path} style={{
                textDecoration: 'none',
                fontSize: '14px',
                fontFamily: "'DM Sans', sans-serif",
                color: isActive ? '#C94F1A' : '#5a5a52',
                fontWeight: isActive ? 600 : 400,
                borderBottom: isActive ? '2px solid #C94F1A' : '2px solid transparent',
                paddingBottom: '2px',
              }}>
                {link.label}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Account actions */}
      <div style={{ alignItems: 'flex-end', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ alignItems: 'center', display: 'flex', gap: '10px' }}>
          {user ? (
            <>
              <Link to="/profile" style={accountLinkStyle}>
                {profile?.full_name || user.email || 'Profile'}
              </Link>
              <button
                disabled={signingOut}
                onClick={handleSignOut}
                style={signOutButtonStyle}
                type="button"
              >
                {signingOut ? 'Signing out...' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" style={loginLinkStyle}>Log in</Link>
              <Link to="/signup" style={signUpLinkStyle}>Sign up</Link>
            </>
          )}
        </div>

        {signOutError && (
          <span role="alert" style={{ color: '#9A3510', fontSize: '11px' }}>
            {signOutError}
          </span>
        )}
      </div>

    </nav>
  );
}

const accountLinkStyle = {
  color: '#5A5A52',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '13px',
  fontWeight: 600,
  maxWidth: '190px',
  overflow: 'hidden',
  textDecoration: 'none',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const loginLinkStyle = {
  background: '#2C2C2A',
  borderRadius: '20px',
  color: 'white',
  fontFamily: "'DM Sans', sans-serif",
  fontSize: '14px',
  fontWeight: 500,
  padding: '9px 20px',
  textDecoration: 'none',
};

const signUpLinkStyle = {
  ...loginLinkStyle,
  background: '#C94F1A',
};

const signOutButtonStyle = {
  ...loginLinkStyle,
  border: 'none',
  cursor: 'pointer',
};
