import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  RefreshCw,
  Scale,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { compareFilteredOpportunities } from '../data/opportunityAdvisorService';
import './OpportunityAdvisor.css';

const RECOMMENDATION_PROFILE_FIELDS = [
  'faculty',
  'major',
  'year_of_study',
  'opportunity_interests',
  'career_goals',
];

function hasRecommendationProfile(profile) {
  return RECOMMENDATION_PROFILE_FIELDS.some(field => {
    const value = profile?.[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

function RecommendationList({ label, items, tone }) {
  if (!items?.length) return null;

  return (
    <div className={`advisor-detail advisor-detail--${tone}`}>
      <strong>{label}</strong>
      <ul>
        {items.map((item, index) => (
          <li key={`${label}-${index}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

export default function OpportunityAdvisor({
  filters,
  opportunities,
  profile,
  totalCount,
  user,
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('prompt');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const opportunitiesById = useMemo(
    () => new Map(opportunities.map(opportunity => [opportunity.id, opportunity])),
    [opportunities]
  );
  const profileReady = hasRecommendationProfile(profile);

  async function runComparison() {
    if (!user) {
      navigate('/login');
      return;
    }

    setStatus('loading');
    setError('');

    try {
      const payload = await compareFilteredOpportunities({
        opportunityIds: opportunities.map(opportunity => opportunity.id),
        filters,
      });
      setResult(payload);
      setStatus('result');
    } catch (comparisonError) {
      if (comparisonError.code === 'AUTH_REQUIRED') {
        navigate('/login');
        return;
      }

      setError(comparisonError.message);
      setStatus('error');
    }
  }

  if (status === 'dismissed') {
    return (
      <section className="opportunity-advisor opportunity-advisor--dismissed">
        <span>AI comparison hidden for these results.</span>
        <button type="button" onClick={() => setStatus('prompt')}>
          Show comparison
        </button>
      </section>
    );
  }

  if (status === 'result' && result?.analysis) {
    const hasUnavailableScores = result.analysis.recommendations.some(
      recommendation => !Number.isFinite(recommendation.fit_score)
    );

    return (
      <section className="opportunity-advisor opportunity-advisor--result">
        <div className="advisor-heading">
          <div className="advisor-heading__icon">
            <Sparkles aria-hidden="true" size={20} />
          </div>
          <div>
            <span className="advisor-eyebrow">Fledge AI comparison</span>
            <h2>Which opportunity fits you best?</h2>
            <p>{result.analysis.overview}</p>
          </div>
          <button
            aria-label="Hide AI comparison"
            className="advisor-icon-button"
            onClick={() => setStatus('dismissed')}
            title="Hide comparison"
            type="button"
          >
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {!profileReady && (
          <div className="advisor-profile-note">
            <UserRound aria-hidden="true" size={18} />
            <span>
              This ranking uses limited profile information, so treat it as
              preliminary.{' '}
              <button onClick={() => navigate('/profile')} type="button">
                Complete your profile
              </button>{' '}
              and compare again for a more personal result.
            </span>
          </div>
        )}

        {hasUnavailableScores && (
          <div className="advisor-score-note" role="status">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>
              Estha ranked these options qualitatively but did not provide a valid
              fit percentage for every option. Missing scores are marked as unavailable,
              not zero.
            </span>
          </div>
        )}

        <div className="advisor-rankings">
          {result.analysis.recommendations.map(recommendation => {
            const opportunity = opportunitiesById.get(recommendation.opportunity_id);
            if (!opportunity) return null;
            const scoreAvailable = Number.isFinite(recommendation.fit_score);

            return (
              <article className="advisor-ranking" key={recommendation.opportunity_id}>
                <div className="advisor-ranking__topline">
                  <span className="advisor-rank">#{recommendation.rank}</span>
                  <span
                    className={`advisor-score${
                      scoreAvailable ? '' : ' advisor-score--unavailable'
                    }`}
                  >
                    {scoreAvailable
                      ? `${recommendation.fit_score}% fit`
                      : 'Score unavailable'}
                  </span>
                  <span className="advisor-fit-label">
                    {recommendation.fit_label}
                  </span>
                </div>
                <h3>{opportunity.title}</h3>
                {recommendation.reason && (
                  <p className="advisor-reason">{recommendation.reason}</p>
                )}

                <div className="advisor-workload">
                  <Clock3 aria-hidden="true" size={17} />
                  <span>
                    <strong>{recommendation.workload_level} workload</strong>
                    {recommendation.workload_assessment && (
                      <>: {recommendation.workload_assessment}</>
                    )}
                  </span>
                </div>

                <div className="advisor-details-grid">
                  <RecommendationList
                    items={recommendation.pros}
                    label="Advantages"
                    tone="positive"
                  />
                  <RecommendationList
                    items={recommendation.cons}
                    label="Trade-offs"
                    tone="caution"
                  />
                </div>

                <RecommendationList
                  items={recommendation.eligibility_checks}
                  label="Eligibility to verify"
                  tone="neutral"
                />
                <RecommendationList
                  items={recommendation.questions_to_verify}
                  label="Questions to check"
                  tone="neutral"
                />
              </article>
            );
          })}
        </div>

        {result.analysis.general_advice && (
          <div className="advisor-general-advice">
            <CheckCircle2 aria-hidden="true" size={18} />
            <p>{result.analysis.general_advice}</p>
          </div>
        )}

        <div className="advisor-result-actions">
          <button className="advisor-secondary-button" onClick={runComparison} type="button">
            <RefreshCw aria-hidden="true" size={16} />
            Compare again
          </button>
          {!profileReady && (
            <button
              className="advisor-text-button"
              onClick={() => navigate('/profile')}
              type="button"
            >
              Complete profile for better recommendations
            </button>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="opportunity-advisor">
      <div className="advisor-heading">
        <div className="advisor-heading__icon">
          <Scale aria-hidden="true" size={20} />
        </div>
        <div>
          <span className="advisor-eyebrow">Optional AI comparison</span>
          <h2>Want help comparing these opportunities?</h2>
          <p>
            Fledge AI can rank the first {opportunities.length} of {totalCount}{' '}
            matching opportunities using your filters and recommendation profile.
          </p>
        </div>
        <button
          aria-label="Hide AI comparison"
          className="advisor-icon-button"
          onClick={() => setStatus('dismissed')}
          title="Hide comparison"
          type="button"
        >
          <X aria-hidden="true" size={18} />
        </button>
      </div>

      {!profileReady && user && (
        <div className="advisor-profile-note">
          <UserRound aria-hidden="true" size={18} />
          <span>
            Your profile has limited recommendation details. You can still compare,
            or <button onClick={() => navigate('/profile')} type="button">complete it</button>{' '}
            for a more personal result.
          </span>
        </div>
      )}

      {status === 'error' && (
        <div className="advisor-error" role="alert">
          <AlertTriangle aria-hidden="true" size={18} />
          <span>{error}</span>
        </div>
      )}

      <p className="advisor-privacy-note">
        Estha receives the selected Fledge listing details and your recommendation
        profile for this comparison. It does not search online reviews or the wider web.
      </p>

      <div className="advisor-actions">
        <button
          className="advisor-primary-button"
          disabled={status === 'loading'}
          onClick={runComparison}
          type="button"
        >
          {status === 'loading' ? (
            <>
              <RefreshCw aria-hidden="true" className="advisor-spinner" size={17} />
              Comparing opportunities
            </>
          ) : (
            <>
              <Sparkles aria-hidden="true" size={17} />
              {user ? 'Compare with AI' : 'Sign in to compare'}
            </>
          )}
        </button>
        <button
          className="advisor-secondary-button"
          disabled={status === 'loading'}
          onClick={() => setStatus('dismissed')}
          type="button"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
