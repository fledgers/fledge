// OpportunityCard.jsx
// A single opportunity card.
// Receives one opportunity object as a prop and displays it.
// Your teammate styles this — you pass the data in.

// iconBg maps category to a background colour for the icon circle
const iconBg = {
  internship: '#FEF0E7',
  hackathon: '#FFF8E1',
  research: '#E8F0FE',
  exchange: '#E8F5E9',
  summer: '#E8F5E9',
  default: '#F5F0EA',
};

// badgeStyle maps badge text to colours
const badgeStyles = {
  'Open to all': { background: '#e8f5e9', color: '#2a6e2a' },
  'Closing soon': { background: '#fde8d8', color: '#C94F1A' },
  'Year 1+': { background: '#e8eaf6', color: '#3949ab' },
  'New': { background: '#fce4ec', color: '#b5175e' },
};

export default function OpportunityCard({ opportunity, isBookmarked, onBookmark }) {
  // opportunity = one object from your opportunities.json
  // isBookmarked = true/false from useOpportunities hook
  // onBookmark = function to call when bookmark button clicked

  const { title, category, organisation, meta, badge, icon } = opportunity;

  return (
    <div style={{
      background: 'white',
      border: '1px solid #ddd8d0',
      borderRadius: '16px',
      padding: '18px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
      cursor: 'pointer',
      transition: 'border-color 0.2s, box-shadow 0.2s',
    }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = '#C94F1A';
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(201,79,26,0.12)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = '#ddd8d0';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.07)';
      }}
    >
      {/* Icon circle */}
      <div style={{
        width: '36px', height: '36px',
        borderRadius: '10px',
        background: iconBg[category] || iconBg.default,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '17px', marginBottom: '12px',
      }}>
        {icon}
      </div>

      {/* Badge */}
      <span style={{
        display: 'inline-block',
        fontSize: '10px',
        padding: '3px 9px',
        borderRadius: '10px',
        fontWeight: 500,
        marginBottom: '10px',
        fontFamily: "'DM Sans', sans-serif",
        ...(badgeStyles[badge] || { background: '#f5f0ea', color: '#5a5a52' }),
      }}>
        {badge}
      </span>

      {/* Title */}
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1a1a18', marginBottom: '3px', lineHeight: 1.3, fontFamily: "'DM Sans', sans-serif" }}>
        {title}
      </div>

      {/* Organisation */}
      <div style={{ fontSize: '12px', color: '#9a9a8a', marginBottom: '8px', fontFamily: "'DM Sans', sans-serif" }}>
        {organisation}
      </div>

      {/* Meta info */}
      <div style={{ fontSize: '11px', color: '#b0b0a0', marginBottom: '14px', fontFamily: "'DM Sans', sans-serif" }}>
        {meta}
      </div>

      {/* Footer: Details button + Bookmark */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button style={{
          background: '#f5f0ea', border: 'none', borderRadius: '8px',
          padding: '7px 14px', fontSize: '12px', fontWeight: 500,
          color: '#C94F1A', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
        }}>
          Details
        </button>

        <button
          onClick={() => onBookmark && onBookmark(opportunity.id)}
          style={{
            width: '28px', height: '28px', borderRadius: '8px',
            background: isBookmarked ? '#fde8d8' : '#f5f0ea',
            border: 'none', fontSize: '13px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isBookmarked ? '#C94F1A' : '#9a9a8a',
          }}
        >
          {isBookmarked ? '★' : '☆'}
        </button>
      </div>
    </div>
  );
}
