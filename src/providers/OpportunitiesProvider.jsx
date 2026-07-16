import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { OpportunitiesContext } from '../context/OpportunitiesContext.js';
import {
  loadOpportunitySnapshot,
  OpportunityDataError,
  removeAllSavedOpportunities,
  removeSavedOpportunity,
  saveOpportunity,
  upsertProfile,
} from '../data/opportunityService.js';
import { saveOutlookOnboardingChoice } from '../data/outlookService.js';
import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

const EMPTY_STATE = {
  opportunities: [],
  profile: null,
  savedOpportunityIds: [],
  savedOpportunities: [],
  user: null,
};

function requireUser(user) {
  if (!user) {
    throw new OpportunityDataError(
      'AUTH_REQUIRED',
      'Log in before saving opportunities.'
    );
  }
}

export default function OpportunitiesProvider({ children }) {
  const [data, setData] = useState(EMPTY_STATE);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const requestIdRef = useRef(0);

  const refresh = useCallback(async ({ showLoading = true } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoading) setIsLoading(true);
    setError(null);

    try {
      const snapshot = await loadOpportunitySnapshot();
      if (requestId !== requestIdRef.current) return;
      setData(snapshot);
    } catch (loadError) {
      if (requestId !== requestIdRef.current) return;
      console.error(loadError);
      setError(loadError);
      setData(EMPTY_STATE);
    } finally {
      if (requestId === requestIdRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => {
      void refresh();
    }, 0);

    if (!isSupabaseConfigured || !supabase) {
      return () => window.clearTimeout(initialLoadTimer);
    }

    const { data: authListener } = supabase.auth.onAuthStateChange(() => {
      void refresh({ showLoading: false });
    });

    return () => {
      window.clearTimeout(initialLoadTimer);
      authListener.subscription.unsubscribe();
    };
  }, [refresh]);

  const toggleSaved = useCallback(async opportunityId => {
    requireUser(data.user);
    const wasSaved = data.savedOpportunityIds.includes(opportunityId);
    const opportunity = data.opportunities.find(item => item.id === opportunityId)
      || data.savedOpportunities.find(item => item.id === opportunityId);
    const previousData = data;

    setData(current => ({
      ...current,
      savedOpportunityIds: wasSaved
        ? current.savedOpportunityIds.filter(id => id !== opportunityId)
        : [...current.savedOpportunityIds, opportunityId],
      savedOpportunities: wasSaved
        ? current.savedOpportunities.filter(item => item.id !== opportunityId)
        : opportunity
          ? [...current.savedOpportunities, opportunity]
          : current.savedOpportunities,
    }));

    try {
      if (wasSaved) {
        await removeSavedOpportunity(data.user.id, opportunityId);
      } else {
        await saveOpportunity(data.user.id, opportunityId);
      }
    } catch (saveError) {
      setData(previousData);
      throw saveError;
    }
  }, [data]);

  const clearSaved = useCallback(async () => {
    requireUser(data.user);
    const previousData = data;
    setData(current => ({
      ...current,
      savedOpportunityIds: [],
      savedOpportunities: [],
    }));

    try {
      await removeAllSavedOpportunities(data.user.id);
    } catch (clearError) {
      setData(previousData);
      throw clearError;
    }
  }, [data]);

  const updateProfile = useCallback(async profile => {
    requireUser(data.user);
    const savedProfile = await upsertProfile(data.user.id, profile);
    setData(current => ({ ...current, profile: savedProfile }));
    return savedProfile;
  }, [data.user]);

  const updateOutlookPreference = useCallback(async decision => {
    requireUser(data.user);
    const savedProfile = await saveOutlookOnboardingChoice(data.user.id, decision);
    setData(current => ({ ...current, profile: savedProfile }));
    return savedProfile;
  }, [data.user]);

  const value = useMemo(() => ({
    ...data,
    clearSaved,
    error,
    isLoading,
    refresh,
    toggleSaved,
    updateOutlookPreference,
    updateProfile,
  }), [
    clearSaved,
    data,
    error,
    isLoading,
    refresh,
    toggleSaved,
    updateOutlookPreference,
    updateProfile,
  ]);

  return (
    <OpportunitiesContext.Provider value={value}>
      {children}
    </OpportunitiesContext.Provider>
  );
}
