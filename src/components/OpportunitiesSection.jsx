// OpportunitiesSection.jsx
// The "Recent Opportunities" section on the landing page.
// Uses OpportunityCard to display each card.

import OpportunityCard from './OpportunityCard';

// Sample data for the landing page preview
// This gets replaced by real data from Supabase later
const SAMPLE_OPPORTUNITIES = [
  {
    id: 1,
    title: 'Google STEP Internship',
    category: 'internship',
    organisation: 'Google',
    meta: '📍 On-site · Year 1–2',
    badge: 'Open to all',
    icon: '💼',
  },
  {
    id: 2,
    title: 'Hackomania 2026',
    category: 'hackathon',
    organisation: 'GovTech Singapore',
    meta: '📅 Feb 2026 · All years',
    badge: 'Closing soon',
    icon: '⚡',
  },
  {
    id: 3,
    title: 'NUS UROP Research',
    category: 'research',
    organisation: 'NUS Faculty of Science',
    meta: '🏛 On-campus · Paid',
    badge: 'Year 1+',
    icon: '🔬',
  },
  {
    id: 4,
    title: 'NUS Summer School',
    category: 'summer',
    organisation: 'NUS Global Relations',
    meta: '📅 May–Jul · All years',
    badge: 'New',
    icon: '☀️',
  },
];

export default function OpportunitiesSection({ bookmarks = [], onBookmark }) {
  return (
    <section style={{ padding: '56px 48px', background: '#F5F2ED' }}>

      {/* Section header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', fontWeight: 600, color: '#1a1a18' }}>
            Recent Opportunities
          </h2>
          <p style={{ fontSize: '13px', color: '#9a9a8a', marginTop: '3px', fontFamily: "'DM Sans', sans-serif" }}>
            Handpicked for your growth
          </p>
        </div>
        <a href="#" style={{ fontSize: '13px', color: '#C94F1A', fontWeight: 500, textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
          View all →
        </a>
      </div>

      {/* Cards grid */}
      {/* grid-template-columns: repeat(4, 1fr) = 4 equal columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: '14px',
      }}>
        {SAMPLE_OPPORTUNITIES.map(opp => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            isBookmarked={bookmarks.includes(opp.id)}
            onBookmark={onBookmark}
          />
        ))}
      </div>

    </section>
  );
}
