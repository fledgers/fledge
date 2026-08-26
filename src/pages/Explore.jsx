// Explore.jsx
// The main browsing page. Search + category filters + year filter + sort,
// all combined to narrow down the opportunities grid.

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import FilterBar from '../components/FilterBar';
import OpportunityAdvisor from '../components/OpportunityAdvisor';
import OpportunityCard from '../components/OpportunityCard';
import OpportunityDataState from '../components/OpportunityDataState';
import { CATEGORIES, MAJORS } from '../data/opportunityFilters';
import { useOpportunities } from '../hooks/useOpportunities';
import { matchesMajor, matchesYear } from '../utils/filterOpportunities';
import { isOpportunityExpired } from '../utils/formatOpportunity';
import {
  getAdvisorRecommendationsById,
  rankOpportunitiesWithAdvisor,
} from '../utils/advisorRanking';

function getDeadlineTime(opportunity) {
  return opportunity.deadline ? new Date(opportunity.deadline).getTime() : Number.POSITIVE_INFINITY;
}

const MAX_ADVISOR_OPPORTUNITIES = 8;

export default function Explore() {
  const navigate = useNavigate();
  const {
    error,
    isLoading,
    opportunities,
    profile,
    refresh,
    savedOpportunityIds,
    toggleSaved,
    user,
  } = useOpportunities();
  // --- STATE ---
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategories, setActiveCategories] = useState([]);
  const [selectedMajor, setSelectedMajor] = useState('');
  const [activeYear, setActiveYear] = useState(0); // 0 = all years
  const [sortBy, setSortBy] = useState('deadline');
  const [actionError, setActionError] = useState('');
  const [advisorRankingState, setAdvisorRankingState] = useState(null);
  const activeOpportunities = useMemo(
    () => opportunities.filter(opportunity => !isOpportunityExpired(opportunity)),
    [opportunities]
  );

  async function toggleBookmark(id) {
    setActionError('');

    try {
      await toggleSaved(id);
    } catch (saveError) {
      if (saveError.code === 'AUTH_REQUIRED') {
        navigate('/login');
        return;
      }
      setActionError(saveError.message);
    }
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
    let results = activeOpportunities;

    // Search filter — checks title, org, and description
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      results = results.filter(o =>
        String(o.title || '').toLowerCase().includes(q) ||
        String(o.organisation || '').toLowerCase().includes(q) ||
        String(o.description || '').toLowerCase().includes(q)
      );
    }

    // Category filters
    if (activeCategories.length > 0) {
      results = results.filter(o => activeCategories.includes(o.category));
    }

    // A selected major must match unless the source explicitly allows all majors.
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
  }, [activeOpportunities, searchQuery, activeCategories, selectedMajor, activeYear, sortBy]);

  const hasActiveFilters = Boolean(
    searchQuery.trim()
      || activeCategories.length > 0
      || selectedMajor
      || activeYear !== 0
  );

  // The adviser API accepts up to eight opportunities. Use the first eight
  // from the user's currently filtered and sorted result set.
  const advisorOpportunities = filtered.slice(0, MAX_ADVISOR_OPPORTUNITIES);
  const advisorFilters = {
    search: searchQuery.trim(),
    categories: activeCategories,
    major: selectedMajor,
    year: activeYear === 0 ? '' : String(activeYear),
    sortBy,
  };
  const advisorKey = [
    advisorFilters.search,
    [...advisorFilters.categories].sort().join(','),
    advisorFilters.major,
    advisorFilters.year,
    advisorFilters.sortBy,
    advisorOpportunities.map((opportunity) => opportunity.id).join(','),
  ].join('|');
  const activeAdvisorAnalysis = advisorRankingState?.key === advisorKey
    ? advisorRankingState.analysis
    : null;
  const advisorRecommendationsById = useMemo(
    () => getAdvisorRecommendationsById(activeAdvisorAnalysis),
    [activeAdvisorAnalysis]
  );
  const displayedOpportunities = useMemo(
    () => rankOpportunitiesWithAdvisor(filtered, activeAdvisorAnalysis),
    [filtered, activeAdvisorAnalysis]
  );

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif", background: '#F5F2ED', color: '#1a1a18', minHeight: '100vh' }}>
      <Navbar activePage="Explore" />

      <div style={{ padding: '40px 48px 0' }}>
        <h1 style={{ fontFamily: "'Fraunces', serif", fontSize: '36px', fontWeight: 600, marginBottom: '6px' }}>
          Explore Opportunities
        </h1>
        <p style={{ fontSize: '15px', color: '#6e6e64' }}>
          {isLoading
            ? 'Loading current opportunities'
            : `${activeOpportunities.length} opportunities across internships, research, programmes and more`}
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
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '9px', alignItems: 'center' }}>
          <span style={{ fontSize: '13px', color: '#6a6a62' }}>
            Showing {filtered.length} of {activeOpportunities.length} opportunities
          </span>
          {activeAdvisorAnalysis && (
            <span style={{
              background: '#FFF0E9', borderRadius: '12px', color: '#A9380F',
              fontSize: '11px', fontWeight: 700, padding: '4px 9px',
            }}>
              ✨ AI ranking shown on cards
            </span>
          )}
        </div>
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value)}
          style={{ fontSize: '13px', color: '#1a1a18', border: '2px solid #C4BDB5', borderRadius: '8px', padding: '6px 10px', background: '#ffffff', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        >
          <option value="deadline">Sort by: Deadline</option>
          <option value="title">Sort by: Title</option>
        </select>
      </div>

      {actionError && (
        <div role="alert" style={{ color: '#9A3510', fontSize: '13px', padding: '0 48px 14px' }}>
          {actionError}
        </div>
      )}

      {!isLoading
        && !error
        && hasActiveFilters
        && advisorOpportunities.length >= 2 && (
          <div style={{ padding: '0 48px 20px' }}>
            <OpportunityAdvisor
              key={advisorKey}
              filters={advisorFilters}
              opportunities={advisorOpportunities}
              onAnalysisChange={analysis => setAdvisorRankingState({
                analysis,
                key: advisorKey,
              })}
              profile={profile}
              totalCount={filtered.length}
              user={user}
            />
          </div>
        )}

      {/* Cards grid */}
      <div style={{ padding: '0 48px 48px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
        {isLoading || error ? (
          <OpportunityDataState error={error} isLoading={isLoading} onRetry={refresh} />
        ) : filtered.length === 0 ? (
          <p style={{ gridColumn: '1 / -1', textAlign: 'center', color: '#9a9a8a', padding: '40px 0' }}>
            No opportunities match your filters.
          </p>
        ) : (
          displayedOpportunities.map(opp => {
            const aiRecommendation = advisorRecommendationsById.get(opp.id);

            return (
              <OpportunityCard
                aiRecommendation={aiRecommendation}
                highlight={Number(aiRecommendation?.rank) === 1}
                key={opp.id}
                opportunity={opp}
                isBookmarked={savedOpportunityIds.includes(opp.id)}
                onBookmark={toggleBookmark}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
