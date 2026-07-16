import { isSupabaseConfigured, supabase } from '../lib/supabase.js';

function requireSupabase() {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error(
      'Authentication is not connected yet. Add the frontend Supabase settings.'
    );
  }

  return supabase;
}

export async function signUpWithEmail({
  fullName,
  email,
  password,
  redirectPath = '/explore',
}) {
  const client = requireSupabase();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { full_name: fullName.trim() },
      emailRedirectTo: `${window.location.origin}${redirectPath}`,
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

export async function signInWithNus(redirectPath = '/explore') {
  const client = requireSupabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      redirectTo: `${window.location.origin}${redirectPath}`,
      scopes: 'email openid profile',
    },
  });

  if (error) throw error;
  return data;
}

export async function signOut() {
  const client = requireSupabase();
  const { error } = await client.auth.signOut();

  if (error) throw error;
}

export async function sendPasswordResetEmail(email) {
  const client = requireSupabase();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${window.location.origin}/reset-password`,
  });

  if (error) throw error;
}

export async function updatePassword(password) {
  const client = requireSupabase();
  const { data, error } = await client.auth.updateUser({ password });

  if (error) throw error;
  return data;
}
