// Explore.jsx
// The main browsing page. Search + category filters + year filter + sort,
// all combined to narrow down the opportunities grid.

import { useState, useMemo } from 'react';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import OpportunityCard from '../components/OpportunityCard';
import opportunities, { CATEGORIES, MAJORS } from '../data/opportunities';
import { matchesMajor, matchesYear } from '../utils/filterOpportunities';

function getDeadlineTime(opportunity) {
  return opportunity.deadline ? new Date(opportunity.deadline).getTime() : Number.POSITIVE_INFINITY;
}

export default function Explore() {
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState([]);
  const [selectedMajor, setSelectedMajor] = useState('');
  const [activeYear, setActiveYear] = useState(0); // 0 = all years
  const [sortBy, setSortBy] = useState('deadline');
  const [bookmarks, setBookmarks] = useState([]);

  function toggleBookmark(id) {
    setBookmarks(prev =>
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
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

  // --- FILTER + SORT LOGIC ---
  // useMemo recalculates only when one of the dependencies changes
  const filtered = useMemo(() => {
    let results = opportunities;

    // Search filter — checks title, org, and description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(o =>
        o.title.toLowerCase().includes(q) ||
        o.organisation.toLowerCase().includes(q) ||
        o.description.toLowerCase().includes(q)
      );
    }

    // Category filters
    if (activeCategories.length > 0) {
      results = results.filter(o => activeCategories.includes(o.category));
    }

    // Only explicit major restrictions remove an opportunity from the results.
    if (selectedMajor) {
      results = results.filter(o => matchesMajor(o, selectedMajor));
    }

    // Year filter
    if (activeYear !== 0) {
      results = results.filter(o => matchesYear(o, activeYear));
    }

    // Sort
    if (sortBy === 'deadline') {
      results = [...results].sort((a, b) => {
        return getDeadlineTime(a) - getDeadlineTime(b);
      });
    } else if (sortBy === 'title') {
      results = [...results].sort((a, b) => a.title.localeCompare(b.title));
    }

    return results;
  }, [searchQuery, activeCategories, selectedMajor, activeYear, sortBy]);

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#F5F2ED', color: '#1a1a18', minHeight: '100vh' }}>
      <Navbar activePage="Explore" />

      <div style={{ padding: '40px 48px 0' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 600, marginBottom: '6px' }}>
          Explore Opportunities
        </h1>
        <p style={{ fontSize: '15px', color: '#6e6e64' }}>
          {opportunities.length}+ opportunities across internships, research, programmes and more
        </p>
      </div>

      {/* Search bar */}
      <div style={{ padding: '24px 48px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', background: '#ffffff',
          border: '2px solid #C4BDB5', borderRadius: '12px', padding: '12px 16px', gap: '10px',
        }}>
          <span>🔍</span>
          <input
            type="text"
            placeholder="Search by title, skill, or keyword..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", background: 'transparent', color: '#1a1a18' }}
          />
        </div>
      </div>

      {/* Category filters */}
      <FilterBar categories={CATEGORIES} activeCategories={activeCategories} onToggle={toggleCategory} />

      {/* Major filter */}
      <div style={{ padding: '0 48px 18px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label htmlFor="major-filter" style={{ fontSize: '13px', color: '#6a6a62', marginRight: '4px', fontWeight: 500 }}>
          Major:
        </label>
        <select
          id="major-filter"
          value={selectedMajor}
          onChange={e => setSelectedMajor(e.target.value)}
          style={{
            fontSize: '13px',
            color: '#1a1a18',
            border: '2px solid #C4BDB5',
            borderRadius: '8px',
            padding: '7px 10px',
            background: '#ffffff',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
        >
          <option value="">All majors</option>
          {MAJORS.map(major => (
            <option key={major.key} value={major.key}>
              {major.label}
            </option>
          ))}
        </select>
      </div>

      {/* Year filter */}
      <div style={{ padding: '0 48px 28px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#6a6a62', marginRight: '4px', fontWeight: 500 }}>Year of study:</span>
        {[0, 1, 2, 3, 4].map(year => (
          <button
            key={year}
            onClick={() => setActiveYear(year)}
            style={{
              padding: '7px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
              border: activeYear === year ? '2px solid #1a1a18' : '2px solid #8a8880',
              background: activeYear === year ? '#1a1a18' : '#EDEAE5',
              color: activeYear === year ? '#ffffff' : '#1a1a18',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {year === 0 ? 'All' : `Year ${year}`}
          </button>
        ))}
      </div>

      {/* Results count + sort */}
      <div style={{ padding: '0 48px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '13px', color: '#6a6a62' }}>
          Showing {filtered.length} of {opportunities.length} opportunities
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

      {/* Cards grid */}
      <div style={{ padding: '0 48px 48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {filtered.length === 0 ? (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9a9a8a', padding: '40px 0' }}>
            No opportunities match your filters.
          </p>
        ) : (
          filtered.map(opp => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              isBookmarked={bookmarks.includes(opp.id)}
              onBookmark={toggleBookmark}
            />
          ))
        )}
      </div>
    </div>
  );
}
