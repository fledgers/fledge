// Saved.jsx
// Shows only bookmarked opportunities, with the same category filter
// pattern as Explore but showing counts per category.
//
// NOTE: Right now bookmarks live in local component state (the sample
// array below) since each page is separate. Once you wire up
// useOpportunities.js properly, bookmarks should live in ONE shared
// place (either lifted to App.jsx or in Supabase) so Explore and Saved
// both reflect the same bookmarked items. This file shows the UI pattern.

import { useState, useMemo } from 'react';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import OpportunityCard from '../components/OpportunityCard';
import opportunities, { CATEGORIES } from '../data/opportunities';
import {
  isExpiredOpportunityRetained,
  isOpportunityExpired,
} from '../utils/formatOpportunity';

export default function Saved() {
  // Sample: pretend these 4 are bookmarked. Replace with real shared state later.
  const [bookmarkedIds, setBookmarkedIds] = useState([1, 2, 3, 4]);
  const [activeCategories, setActiveCategories] = useState([]);
  const [sortBy, setSortBy] = useState('deadline');

  function removeBookmark(id) {
    setBookmarkedIds(prev => prev.filter(b => b !== id));
  }

  function clearAll() {
    setBookmarkedIds([]);
  }

  function toggleCategory(key) {
    if (key === 'all') {
      setActiveCategories([]);
      return;
    }

    setActiveCategories(prev =>
      prev.includes(key) ? prev.filter(category => category !== key) : [...prev, key]
    );
  }

  // Only the opportunities that are bookmarked
  const savedOpportunities = useMemo(
    () => opportunities.filter(opportunity => {
      if (!bookmarkedIds.includes(opportunity.id)) return false;

      return (
        !isOpportunityExpired(opportunity) ||
        isExpiredOpportunityRetained(opportunity)
      );
    }),
    [bookmarkedIds]
  );

  // Count how many saved items fall into each category — powers the "(3)" labels
  const counts = useMemo(() => {
    const result = { all: savedOpportunities.length };
    savedOpportunities.forEach(o => {
      result[o.category] = (result[o.category] || 0) + 1;
    });
    return result;
  }, [savedOpportunities]);

  // Apply category filter + sort
  const filtered = useMemo(() => {
    let results = savedOpportunities;
    if (activeCategories.length > 0) {
      results = results.filter(o => activeCategories.includes(o.category));
    }
    if (sortBy === 'deadline') {
      results = [...results].sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortBy === 'title') {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    }
    return results;
  }, [savedOpportunities, activeCategories, sortBy]);

  // Only show categories that actually have at least 1 saved item (plus "All")
  const visibleCategories = CATEGORIES.filter(
    cat => cat.key === 'all' || counts[cat.key] > 0
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#F5F2ED', color: '#1a1a18', minHeight: '100vh' }}>
      <Navbar activePage="Saved" />

      <div style={{ padding: '40px 48px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 600, marginBottom: '6px' }}>
            Saved Opportunities
          </h1>
          <p style={{ fontSize: '15px', color: '#6e6e64' }}>
            {savedOpportunities.length} opportunities bookmarked
          </p>
        </div>
        {savedOpportunities.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              background: 'white', color: '#C94F1A', border: '1.5px solid #C94F1A',
              padding: '8px 18px', borderRadius: '20px', fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500, cursor: 'pointer',
            }}
          >
            Clear all
          </button>
        )}
      </div>

      {savedOpportunities.length === 0 ? (
        // Empty state
        <div style={{ padding: '80px 48px', textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔖</div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>
            Nothing saved yet
          </div>
          <p style={{ fontSize: '14px', color: '#9a9a8a', marginBottom: '24px' }}>
            Bookmark opportunities on Explore to find them here later.
          </p>
        </div>
      ) : (
        <>
          <FilterBar
            categories={visibleCategories}
            activeCategories={activeCategories}
            onToggle={toggleCategory}
            counts={counts}
          />

          <div style={{ padding: '0 48px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', color: '#6a6a62' }}>
              Showing {filtered.length} of {savedOpportunities.length} saved opportunities
            </span>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={{ fontSize: '13px', color: '#1a1a18', border: '2px solid #C4BDB5', borderRadius: '8px', padding: '6px 10px', background: '#ffffff', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
            >
              <option value="deadline">Sort by: Deadline</option>
              <option value="title">Sort by: Title</option>
            </select>
          </div>

          <div style={{ padding: '0 48px 48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {filtered.map(opp => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                isBookmarked={true}
                onBookmark={removeBookmark}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
