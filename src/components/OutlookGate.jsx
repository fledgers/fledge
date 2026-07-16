import { Navigate, useLocation } from 'react-router-dom';
import OpportunityDataState from './OpportunityDataState';
import { getBrowserOutlookDecision } from '../data/outlookService';
import { useOpportunities } from '../hooks/useOpportunities';

export default function OutlookGate({ children }) {
  const location = useLocation();
  const { error, isLoading, profile, refresh, user } = useOpportunities();

  if (isLoading) {
    return (
      <div style={statePageStyle}>
        <OpportunityDataState isLoading onRetry={refresh} />
      </div>
    );
  }

  if (error) {
    return (
      <div style={statePageStyle}>
        <OpportunityDataState error={error} onRetry={refresh} />
      </div>
    );
  }

  const decision = user
    ? profile?.outlook_onboarding_status || 'not_asked'
    : getBrowserOutlookDecision() || 'not_asked';

  if (decision === 'not_asked') {
    return (
      <Navigate
        replace
        state={{ from: `${location.pathname}${location.search}` }}
        to="/outlook"
      />
    );
  }

  return children;
}

const statePageStyle = {
  background: '#F5F2ED',
  fontFamily: "'DM Sans', sans-serif",
  minHeight: '100vh',
};
