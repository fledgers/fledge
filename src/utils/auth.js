import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Authentication is not connected yet. Add the frontend Supabase settings.'
    );
  }

  return supabase;
}

export async function signUpWithEmail({ fullName, email, password }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}/explore`,
    },
  });

  if (error) throw error;
  return data;
}

export async function signInWithEmail({ email, password }) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (error) throw error;
  return data;
}

export async function signInWithNus() {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}/explore`,
      scopes: 'email openid profile',
    },
  });

  if (error) throw error;
  return data;
}

