// Footer.jsx
// Bottom of every page.

const FOOTER_LINKS = {
  Explore: ['Internships', 'Hackathons', 'Research', 'Summer School', 'Exchange'],
  Company: ['About Us', 'Blog', 'Contact'],
  Legal: ['Privacy Policy', 'Terms of Service'],
};

export default function Footer() {
  return (
    <>
      <footer style={{
        display: 'grid',
        gridTemplateColumns: '1.6fr 1fr 1fr 1fr',
        gap: '40px',
        padding: '40px 48px',
        borderTop: '1px solid #e2ddd6',
        background: '#FAFAF7',
      }}>

        {/* Brand column */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontFamily: "'Fraunces', serif", fontSize: '21px', fontWeight: 600, color: '#C94F1A' }}>
            <svg width="26" height="20" viewBox="0 0 28 22" fill="none">
              <path d="M2 14 C6 10,10 6,16 8 C18 4,22 2,26 3 C24 6,20 8,18 9 C22 9,25 11,26 14 C22 12,18 11,14 13 C10 15,6 18,4 20 C3 18,2 16,2 14Z" fill="#C94F1A"/>
              <path d="M14 13 C12 16,9 19,6 21" stroke="#C94F1A" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <circle cx="22" cy="4.5" r="1.2" fill="#1a1a18"/>
            </svg>
            Fledge
          </div>
          <p style={{ fontSize: '13px', color: '#9a9a8a', lineHeight: 1.6, maxWidth: '190px', marginTop: '10px', fontFamily: "'DM Sans', sans-serif" }}>
            Your career wings, built for students by students.
          </p>
        </div>

        {/* Link columns */}
        {Object.entries(FOOTER_LINKS).map(([heading, links]) => (
          <div key={heading}>
            <h4 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '14px', fontFamily: "'DM Sans', sans-serif", color: '#1a1a18' }}>
              {heading}
            </h4>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {links.map(link => (
                <li key={link} style={{ fontSize: '13px', color: '#9a9a8a', marginBottom: '8px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
                  {link}
                </li>
              ))}
            </ul>
          </div>
        ))}

      </footer>

      {/* Bottom bar */}
      <div style={{ padding: '14px 48px', borderTop: '1px solid #e2ddd6', textAlign: 'center', fontSize: '12px', color: '#b0b0a8', background: '#FAFAF7', fontFamily: "'DM Sans', sans-serif" }}>
        © 2026 Fledge. Taking flight together.
      </div>
    </>
  );
}
