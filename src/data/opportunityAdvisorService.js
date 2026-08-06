import { isSupabaseConfigured, supabase } from '../lib/supabase';

export async function compareFilteredOpportunities({
  opportunityIds,
  filters,
  preferenceMessages = [],
}) {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Supabase is not configured for this website.');
  }

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    const error = new Error('Sign in before asking Fledge AI to compare opportunities.');
    error.code = 'AUTH_REQUIRED';
    throw error;
  }

  const response = await fetch('/api/opportunity-advisor', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      opportunityIds,
      filters,
      preferenceMessages,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      payload.error || 'Fledge AI could not compare these opportunities.'
    );
    error.code = payload.code || 'ADVISOR_REQUEST_FAILED';
    throw error;
  }

  return payload;
}
