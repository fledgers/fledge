// Navbar.jsx
// The top bar that appears on every page.
// Contains the logo, nav links, and auth buttons.

export default function Navbar() {
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

      {/* LOGO */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Fraunces', serif", fontSize: '21px', fontWeight: 600, color: '#C94F1A' }}>
        <svg width="26" height="20" viewBox="0 0 28 22" fill="none">
          <path d="M2 14 C6 10,10 6,16 8 C18 4,22 2,26 3 C24 6,20 8,18 9 C22 9,25 11,26 14 C22 12,18 11,14 13 C10 15,6 18,4 20 C3 18,2 16,2 14Z" fill="#C94F1A"/>
          <path d="M14 13 C12 16,9 19,6 21" stroke="#C94F1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
          <circle cx="22" cy="4.5" r="1.2" fill="#1a1a18"/>
        </svg>
        Fledge
      </div>

      {/* NAV LINKS */}
      {/* These will eventually be <Link> components from React Router */}
      <ul style={{ display: 'flex', gap: '32px', listStyle: 'none', margin: 0, padding: 0 }}>
        {['Explore', 'Saved', 'For You'].map(link => (
          <li key={link}>
            <a href="#" style={{ textDecoration: 'none', fontSize: '14px', color: '#5a5a52', fontFamily: "'DM Sans', sans-serif" }}>
              {link}
            </a>
          </li>
        ))}
      </ul>

      {/* AUTH BUTTONS */}
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Log in — dark text on light background, clearly visible */}
        <button style={{
          background: '#2C2C2A',
          color: 'white',
          border: 'none',
          padding: '9px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          cursor: 'pointer',
        }}>
          Log in
        </button>

        {/* Sign up — orange, most prominent */}
        <button style={{
          background: '#C94F1A',
          color: 'white',
          border: 'none',
          padding: '9px 20px',
          borderRadius: '20px',
          fontSize: '14px',
          fontFamily: "'DM Sans', sans-serif",
          fontWeight: 500,
          cursor: 'pointer',
        }}>
          Sign up
        </button>
      </div>

    </nav>
  );
}
