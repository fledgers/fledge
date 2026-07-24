import { isSupabaseConfigured, supabase } from '../lib/supabase';

const STUDY_HISTORY_FIELDS = [
  'id',
  'format',
  'title',
  'source_label',
  'settings',
  'output',
  'input_character_count',
  'created_at',
].join(', ');

function getSupabaseClient() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Study history is not configured.');
  }

  return supabase;
}

export async function listStudyGenerations(limit = 30) {
  const client = getSupabaseClient();
  const { data, error } = await client
    .from('study_generations')
    .select(STUDY_HISTORY_FIELDS)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function deleteStudyGeneration(generationId) {
  const client = getSupabaseClient();
  const { error } = await client
    .from('study_generations')
    .delete()
    .eq('id', generationId);

  if (error) throw error;
}
