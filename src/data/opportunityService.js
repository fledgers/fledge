import {
  isSupabaseConfigured,
  supabase,
} from '../lib/supabase.js';
import { formatOpportunity } from '../utils/formatOpportunity.js';
import { PROFILE_SELECT } from './profileFields.js';

export class OpportunityDataError extends Error {
  constructor(code, message, cause) {
    super(message, cause ? { cause } : undefined);
    this.name = 'OpportunityDataError';
    this.code = code;
  }
}

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new OpportunityDataError(
      'CONFIGURATION_REQUIRED',
      'Opportunities are temporarily unavailable.'
    );
  }

  return supabase;
}

function throwQueryError(message, error) {
  if (!error) return;
  throw new OpportunityDataError('QUERY_FAILED', message, error);
}

async function loadSavedOpportunities(client, userId) {
  const { data: savedRows, error: savedError } = await client
    .from('saved_opportunities')
    .select('opportunity_id')
    .eq('user_id', userId);

  throwQueryError('Saved opportunities could not be loaded.', savedError);

  const savedOpportunityIds = (savedRows || []).map(row => row.opportunity_id);
  if (savedOpportunityIds.length === 0) {
    return { savedOpportunityIds: [], savedOpportunities: [] };
  }

  const { data: opportunityRows, error: opportunityError } = await client
    .from('opportunities')
    .select('*')
    .in('id', savedOpportunityIds);

  throwQueryError('Saved opportunities could not be loaded.', opportunityError);

  return {
    savedOpportunityIds,
    savedOpportunities: (opportunityRows || []).map(formatOpportunity),
  };
}

async function loadProfile(client, userId) {
  const { data, error } = await client
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();

  throwQueryError('Your profile could not be loaded.', error);
  return data || null;
}

export async function loadOpportunitySnapshot() {
  const client = requireSupabase();
  const { data: sessionData, error: sessionError } =
    await client.auth.getSession();

  throwQueryError('Your session could not be checked.', sessionError);

  const user = sessionData.session?.user || null;
  const { data: opportunityRows, error: opportunityError } = await client
    .from('active_opportunities')
    .select('*')
    .order('source_priority', { ascending: true })
    .order('deadline', { ascending: true, nullsFirst: false });

  throwQueryError('Opportunities could not be loaded.', opportunityError);

  const [savedData, profile] = user
    ? await Promise.all([
        loadSavedOpportunities(client, user.id),
        loadProfile(client, user.id),
      ])
    : [{ savedOpportunityIds: [], savedOpportunities: [] }, null];

  return {
    opportunities: (opportunityRows || []).map(formatOpportunity),
    profile,
    savedOpportunityIds: savedData.savedOpportunityIds,
    savedOpportunities: savedData.savedOpportunities,
    user,
  };
}

export async function saveOpportunity(userId, opportunityId) {
  const client = requireSupabase();
  const { error } = await client.from('saved_opportunities').insert({
    user_id: userId,
    opportunity_id: opportunityId,
  });

  if (error?.code === '23505') return;
  throwQueryError('The opportunity could not be saved.', error);
}

export async function removeSavedOpportunity(userId, opportunityId) {
  const client = requireSupabase();
  const { error } = await client
    .from('saved_opportunities')
    .delete()
    .eq('user_id', userId)
    .eq('opportunity_id', opportunityId);

  throwQueryError('The saved opportunity could not be removed.', error);
}

export async function removeAllSavedOpportunities(userId) {
  const client = requireSupabase();
  const { error } = await client
    .from('saved_opportunities')
    .delete()
    .eq('user_id', userId);

  throwQueryError('Saved opportunities could not be cleared.', error);
}

export async function upsertProfile(userId, profile) {
  const client = requireSupabase();
  const { data, error } = await client
    .from('profiles')
    .upsert({
      id: userId,
      full_name: profile.full_name?.trim() || null,
      university: 'nus',
      faculty: profile.faculty?.trim() || null,
      major: profile.major || null,
      year_of_study: profile.year_of_study || null,
      opportunity_interests: Array.isArray(profile.opportunity_interests)
        ? profile.opportunity_interests
        : [],
      career_goals: profile.career_goals?.trim() || null,
      skills_experience: profile.skills_experience?.trim() || null,
      weekly_availability_hours:
        profile.weekly_availability_hours ?? null,
      workload_preference: profile.workload_preference || null,
      opportunity_budget_sgd: profile.opportunity_budget_sgd ?? null,
      preferred_locations: profile.preferred_locations?.trim() || null,
      preferred_delivery_modes:
        Array.isArray(profile.preferred_delivery_modes)
          ? profile.preferred_delivery_modes
          : [],
      willing_to_travel: profile.willing_to_travel ?? null,
    }, { onConflict: 'id' })
    .select(PROFILE_SELECT)
    .single();

  throwQueryError('Your profile could not be saved.', error);
  return data;
}
