import { createClient } from "npm:@supabase/supabase-js@2";

function getRequiredEnvironment(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing Edge Function secret: ${name}`);
  return value;
}

export function createAdminClient() {
  return createClient(
    getRequiredEnvironment("SUPABASE_URL"),
    getRequiredEnvironment("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export async function getAuthenticatedUser(request: Request) {
  const authorization = request.headers.get("Authorization") || "";
  const accessToken = authorization.replace(/^Bearer\s+/i, "");
  if (!accessToken) throw new Error("Sign in before managing Outlook access.");

  const admin = createAdminClient();
  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Your Fledge session is invalid or has expired.");
  }

  return { admin, user: data.user };
}

export function getMicrosoftConfiguration() {
  const supabaseUrl = getRequiredEnvironment("SUPABASE_URL").replace(/\/$/, "");

  return {
    authorityTenant: Deno.env.get("MICROSOFT_AUTHORITY_TENANT") || "organizations",
    clientId: getRequiredEnvironment("MICROSOFT_CLIENT_ID"),
    clientSecret: getRequiredEnvironment("MICROSOFT_CLIENT_SECRET"),
    frontendUrl: getRequiredEnvironment("FRONTEND_URL").replace(/\/$/, ""),
    redirectUri: Deno.env.get("MICROSOFT_OUTLOOK_REDIRECT_URI")
      || `${supabaseUrl}/functions/v1/outlook-callback`,
  };
}
