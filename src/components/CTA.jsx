// CTA.jsx
// The big orange gradient banner near the bottom.
// CTA = Call To Action — it's asking users to sign up.

export default function CTA() {
  return (
    <div style={{ padding: '0 48px 56px', background: '#F5F2ED' }}>
      <div style={{
        borderRadius: '24px',
        padding: '64px 48px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        // The gradient — goes from deep dark burnt orange → brighter orange → warm amber
        background: 'linear-gradient(135deg, #9B2D08 0%, #C94F1A 40%, #E07828 75%, #C8820A 100%)',
      }}>

        {/* Decorative blobs — just circles with low opacity white */}
        {/* They add depth to the gradient without being too busy */}
        <div style={{ position: 'absolute', width: '280px', height: '280px', borderRadius: '50%', background: 'rgba(255,255,255,0.06)', top: '-100px', right: '-80px' }} />
        <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'rgba(255,255,255,0.05)', bottom: '-80px', left: '-50px' }} />

        {/* Content — position relative so it sits above the blobs */}
        <div style={{ position: 'relative' }}>
          <p style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '14px', fontFamily: "'DM Sans', sans-serif" }}>
            Build your nest today
          </p>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '32px', fontWeight: 600, color: 'white', lineHeight: 1.2, marginBottom: '12px' }}>
            Join 50,000+ students taking<br />flight together.
          </h2>
          <p style={{ fontSize: '14px', color: 'rgba(255,255,255,0.75)', marginBottom: '32px', fontFamily: "'DM Sans', sans-serif" }}>
            Because your inbox shouldn't be your career advisor.
          </p>
          <button style={{
            background: 'white',
            color: '#C94F1A',
            border: 'none',
            padding: '14px 36px',
            borderRadius: '32px',
            fontSize: '15px',
            fontWeight: 600,
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}>
            Get Started for Free
          </button>
        </div>

      </div>
    </div>
  );
}
