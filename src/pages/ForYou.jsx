// ForYou.jsx
// Personalised page: profile strip, recommended cards,
// and an upcoming-deadlines list pulled from saved items.

import { useMemo } from 'react';
import Navbar from '../components/Navbar';
import OpportunityCard from '../components/OpportunityCard';
import opportunities from '../data/opportunities';
import { isOpportunityExpired } from '../utils/formatOpportunity';

// Sample: which opportunities are "recommended" — later this is computed
// by matching the user's major and year against each opportunity
const recommendedIds = [1, 2, 3];
const topPickIds = [1, 2]; // subset that gets the "Top Pick" badge

export default function ForYou() {
  const recommended = useMemo(
    () => opportunities.filter(
      opportunity =>
        recommendedIds.includes(opportunity.id) &&
        !isOpportunityExpired(opportunity)
    ),
    []
  );

  // Sample: saved opportunities with deadlines, sorted soonest first
  const savedWithDeadlines = useMemo(() => {
    const saved = opportunities.filter(
      opportunity =>
        [1, 2, 4].includes(opportunity.id) &&
        opportunity.deadline &&
        !isOpportunityExpired(opportunity)
    );
    return [...saved].sort((a, b) => new Date(a.deadline) - new Date(b.deadline));
  }, []);

  function daysUntil(dateStr) {
    const diff = new Date(dateStr) - new Date();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#F5F2ED', color: '#1a1a18', minHeight: '100vh' }}>
      <Navbar activePage="For You" />

      <div style={{ padding: '40px 48px 8px' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 600, marginBottom: '6px' }}>
          For You
        </h1>
        <p style={{ fontSize: '15px', color: '#6e6e64' }}>
          Personalised picks based on your year and major
        </p>
      </div>

      {/* Profile strip */}
      <div style={{
        margin: '24px 48px', background: '#ffffff', border: '2px solid #C4BDB5',
        borderRadius: '16px', padding: '20px 24px', display: 'flex',
        alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', background: '#FEF0E7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            border: '2px solid #f0ddd0',
          }}>
            🐦
          </div>
          <div>
            <div style={{ fontSize: '15px', fontWeight: 600, marginBottom: '3px' }}>Piu Parthvi</div>
            <div style={{ fontSize: '12px', color: '#9a9a8a' }}>Year 1 · NUS Computing (AI) · Minor in Economics</div>
          </div>
        </div>
        <button style={{
          background: '#EDEAE5', color: '#1a1a18', border: '2px solid #8a8880',
          padding: '7px 16px', borderRadius: '20px', fontSize: '13px',
          fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: 'pointer',
        }}>
          Edit profile
        </button>
      </div>

      {/* Recommended section */}
      <div style={{ padding: '0 48px 16px', fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 600 }}>
        Recommended for you
        <span style={{ fontSize: '13px', color: '#9a9a8a', fontFamily: "'DM Sans', sans-serif", fontWeight: 400, marginLeft: '8px' }}>
          Based on Year 1 · Computing
        </span>
      </div>

      <div style={{ padding: '0 48px 36px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {recommended.map(opp => (
          <OpportunityCard
            key={opp.id}
            opportunity={opp}
            isBookmarked={false}
            highlight={topPickIds.includes(opp.id)}
            topPick={topPickIds.includes(opp.id)}
          />
        ))}
      </div>

      {/* Upcoming deadlines from saved */}
      <div style={{ padding: '0 48px 48px' }}>
        <div style={{ fontFamily: "'Fraunces', serif", fontSize: '22px', fontWeight: 600, marginBottom: '16px' }}>
          Upcoming deadlines from your saved
        </div>

        {savedWithDeadlines.map(opp => {
          const days = daysUntil(opp.deadline);
          const urgent = days <= 7;

          return (
            <div key={opp.id} style={{
              background: urgent ? '#FEF0E7' : '#ffffff',
              border: urgent ? '2px solid #C94F1A' : '2px solid #C4BDB5',
              borderRadius: '12px', padding: '16px 20px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <span style={{ fontSize: '20px' }}>{opp.icon}</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, marginBottom: '2px' }}>{opp.title}</div>
                  <div style={{ fontSize: '12px', color: '#9a9a8a' }}>{opp.organisation}</div>
                </div>
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#C94F1A' }}>
                {opp.deadlineLabel.replace('Deadline: ', '')} · {days} days left
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
