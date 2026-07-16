import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

export const OUTLOOK_BROWSER_DECISION_KEY = 'fledge_outlook_onboarding';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Outlook connection is unavailable until Supabase is configured.');
  }

  return supabase;
}

async function getFunctionError(error, fallbackMessage) {
  let contextMessage = '';

  if (error?.context instanceof Response) {
    const body = await error.context.clone().json().catch(() => ({}));
    contextMessage = body.error || '';
  }

  return new Error(contextMessage || error?.message || fallbackMessage);
}

export function getBrowserOutlookDecision() {
  return window.localStorage.getItem(OUTLOOK_BROWSER_DECISION_KEY);
}

export function setBrowserOutlookDecision(decision) {
  window.localStorage.setItem(OUTLOOK_BROWSER_DECISION_KEY, decision);
}

export async function beginOutlookAuthorization() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('outlook-authorize');

  if (error) {
    throw await getFunctionError(error, 'Outlook authorization could not be started.');
  }

  if (!data?.authorization_url) {
    throw new Error('The Outlook authorization URL was not returned.');
  }

  window.location.assign(data.authorization_url);
}

export async function loadOutlookStatus() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('outlook-status');

  if (error) {
    throw await getFunctionError(error, 'Outlook connection status could not be loaded.');
  }

  return data;
}

export async function disconnectOutlook() {
  const client = requireSupabase();
  const { data, error } = await client.functions.invoke('outlook-disconnect');

  if (error) {
    throw await getFunctionError(error, 'Outlook could not be disconnected.');
  }

  setBrowserOutlookDecision('disconnected');
  return data;
}

export async function saveOutlookOnboardingChoice(userId, decision) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .update({
      outlook_onboarding_status: decision,
      outlook_onboarding_updated_at: new Date().toISOString(),
    })
    .eq('id', userId)
    .select(
      'full_name, university, faculty, major, year_of_study, outlook_onboarding_status, outlook_onboarding_updated_at'
    )
    .single();

  if (error) throw error;
  setBrowserOutlookDecision(decision);
  return data;
}
