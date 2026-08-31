import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  CheckCircle2,
  MessageCircle,
  RefreshCw,
  Scale,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { compareFilteredOpportunities } from '../data/opportunityAdvisorService';
import { appendAdvisorPreference } from '../utils/advisorPreferences';
import './OpportunityAdvisor.css';

const RECOMMENDATION_PROFILE_FIELDS = [
  'faculty',
  'major',
  'year_of_study',
  'opportunity_interests',
  'career_goals',
];
const MAX_PREFERENCE_LENGTH = 1_000;
const MAX_PREFERENCE_MESSAGES = 8;

function hasRecommendationProfile(profile) {
  return RECOMMENDATION_PROFILE_FIELDS.some(field => {
    const value = profile?.[field];
    return Array.isArray(value) ? value.length > 0 : Boolean(value);
  });
}

function PreferenceComposer({
  draft,
  history,
  isLoading,
  onChange,
  onClear,
  onSubmit,
  user,
}) {
  return (
    <section className="advisor-conversation" aria-labelledby="advisor-preference-title">
      <div className="advisor-conversation__heading">
        <MessageCircle aria-hidden="true" size={19} />
        <div>
          <h3 id="advisor-preference-title">Tell Fledge AI how to rank these results</h3>
          <p>
            Add priorities such as cost, timing or location. This reranks the results in
            this comparison; use the filters above to change the opportunity grid.
          </p>
        </div>
      </div>

      {history.length > 0 && (
        <div className="advisor-conversation__history" aria-label="Your preferences">
          {history.map((message, index) => (
            <div className="advisor-user-message" key={`${message}-${index}`}>
              <strong>You</strong>
              <span>{message}</span>
            </div>
          ))}
        </div>
      )}

      <form className="advisor-preference-form" onSubmit={onSubmit}>
        <label className="sr-only" htmlFor="advisor-preference-input">
          Your preferences for this comparison
        </label>
        <textarea
          id="advisor-preference-input"
          maxLength={MAX_PREFERENCE_LENGTH}
          onChange={event => onChange(event.target.value)}
          placeholder="For example: Rank the lowest-cost winter programmes first. My budget is S$2,000."
          rows={3}
          value={draft}
        />
        <div className="advisor-preference-form__footer">
          <span>{draft.length}/{MAX_PREFERENCE_LENGTH}</span>
          <div className="advisor-preference-form__actions">
            {history.length > 0 && (
              <button
                className="advisor-text-button"
                disabled={isLoading}
                onClick={onClear}
                type="button"
              >
                <Trash2 aria-hidden="true" size={15} />
                Clear preferences
              </button>
            )}
            <button
              className="advisor-primary-button"
              disabled={isLoading || !draft.trim()}
              type="submit"
            >
              {isLoading ? (
                <>
                  <RefreshCw aria-hidden="true" className="advisor-spinner" size={16} />
                  Updating comparison
                </>
              ) : (
                <>
                  <Send aria-hidden="true" size={16} />
                  {user ? 'Rerank these results' : 'Sign in to ask'}
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </section>
  );
}

export default function OpportunityAdvisor({
  filters,
  onAnalysisChange,
  opportunities,
  profile,
  totalCount,
  user,
}) {
  const navigate = useNavigate();
  const [status, setStatus] = useState('prompt');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [preferenceDraft, setPreferenceDraft] = useState('');
  const [preferenceHistory, setPreferenceHistory] = useState([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const profileReady = hasRecommendationProfile(profile);

  async function runComparison(preferenceMessages = preferenceHistory) {
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
        preferenceMessages,
      });
      setResult(payload);
      onAnalysisChange?.(payload.analysis);
      setIsComposerOpen(false);
      setStatus('result');
    } catch (comparisonError) {
      if (comparisonError.code === 'AUTH_REQUIRED') {
        navigate('/login');
        return;
      }

      setError(comparisonError.message);
      setStatus(result ? 'result' : 'error');
    }
  }

  async function submitPreference(event) {
    event.preventDefault();
    if (!preferenceDraft.trim()) return;

    const updatedHistory = appendAdvisorPreference(
      preferenceHistory,
      preferenceDraft,
      MAX_PREFERENCE_MESSAGES,
    );
    setPreferenceHistory(updatedHistory);
    setPreferenceDraft('');
    await runComparison(updatedHistory);
  }

  async function startComparison() {
    const updatedHistory = appendAdvisorPreference(
      preferenceHistory,
      preferenceDraft,
      MAX_PREFERENCE_MESSAGES,
    );

    if (preferenceDraft.trim()) {
      setPreferenceHistory(updatedHistory);
      setPreferenceDraft('');
    }

    await runComparison(updatedHistory);
  }

  async function clearPreferences() {
    setPreferenceHistory([]);
    setPreferenceDraft('');

    if (result) {
      await runComparison([]);
    }
  }

  function hideComparison() {
    setStatus('dismissed');
    onAnalysisChange?.(null);
  }

  function showComparison() {
    if (result?.analysis) {
      setStatus('result');
      onAnalysisChange?.(result.analysis);
      return;
    }

    setStatus('prompt');
  }

  if (status === 'dismissed') {
    return (
      <section className="opportunity-advisor opportunity-advisor--dismissed">
        <span>AI comparison hidden for these results.</span>
        <button type="button" onClick={showComparison}>
          Show comparison
        </button>
      </section>
    );
  }

  if ((status === 'result' || status === 'loading') && result?.analysis) {
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
            <h2>AI ranking applied to your opportunities</h2>
            <p>
              {result.analysis.overview}{' '}
              Ranks and reasons are shown directly on the cards below.
            </p>
          </div>
          <button
            aria-label="Hide AI comparison"
            className="advisor-icon-button"
            onClick={hideComparison}
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

        {error && (
          <div className="advisor-error" role="alert">
            <AlertTriangle aria-hidden="true" size={18} />
            <span>{error}</span>
          </div>
        )}

        {preferenceHistory.length > 0 && (
          <div className="advisor-active-preference">
            <MessageCircle aria-hidden="true" size={18} />
            <div>
              <strong>Your ranking requirement</strong>
              <p>{preferenceHistory.at(-1)}</p>
            </div>
          </div>
        )}

        {result.analysis.ranking_basis && (
          <div className="advisor-ranking-basis">
            <Scale aria-hidden="true" size={19} />
            <div>
              <strong>Why this order</strong>
              <p>{result.analysis.ranking_basis}</p>
              {result.analysis.preference_summary && (
                <p className="advisor-preference-impact">
                  <strong>How your preferences affected it:</strong>{' '}
                  {result.analysis.preference_summary}
                </p>
              )}
            </div>
          </div>
        )}

        {isComposerOpen && (
          <PreferenceComposer
            draft={preferenceDraft}
            history={preferenceHistory}
            isLoading={status === 'loading'}
            onChange={setPreferenceDraft}
            onClear={clearPreferences}
            onSubmit={submitPreference}
            user={user}
          />
        )}

        {result.analysis.general_advice && (
          <div className="advisor-general-advice">
            <CheckCircle2 aria-hidden="true" size={18} />
            <p>{result.analysis.general_advice}</p>
          </div>
        )}

        <div className="advisor-result-actions">
          <button
            className="advisor-primary-button"
            disabled={status === 'loading'}
            onClick={() => setIsComposerOpen(current => !current)}
            type="button"
          >
            <MessageCircle aria-hidden="true" size={16} />
            {isComposerOpen ? 'Hide ranking preferences' : 'Adjust AI ranking'}
          </button>
          <button
            className="advisor-secondary-button"
            disabled={status === 'loading'}
            onClick={() => runComparison()}
            type="button"
          >
            <RefreshCw aria-hidden="true" size={16} />
            {status === 'loading' ? 'Updating comparison' : 'Refresh ranking'}
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
            matching opportunities using your filters, preferences and recommendation
            profile.
          </p>
        </div>
        <button
          aria-label="Hide AI comparison"
          className="advisor-icon-button"
          onClick={hideComparison}
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

      <PreferenceComposer
        draft={preferenceDraft}
        history={preferenceHistory}
        isLoading={status === 'loading'}
        onChange={setPreferenceDraft}
        onClear={clearPreferences}
        onSubmit={submitPreference}
        user={user}
      />

      <p className="advisor-privacy-note">
        Estha receives the selected Fledge listing details and your recommendation
        profile, filters and messages for this comparison. It does not search online
        reviews or the wider web. Your messages are not saved to your profile.
      </p>

      <div className="advisor-actions">
        <button
          className="advisor-primary-button"
          disabled={status === 'loading'}
          onClick={startComparison}
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
              {user
                ? status === 'error'
                  ? 'Try ranking again'
                  : preferenceDraft.trim()
                    ? 'Apply requirement and rank'
                    : 'Rank with AI'
                : 'Sign in to compare'}
            </>
          )}
        </button>
        <button
          className="advisor-secondary-button"
          disabled={status === 'loading'}
          onClick={hideComparison}
          type="button"
        >
          Not now
        </button>
      </div>
    </section>
  );
}
