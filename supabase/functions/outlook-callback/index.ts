import { sha256Hex } from "../_shared/crypto.ts";
import {
  exchangeMicrosoftCode,
  getMicrosoftProfile,
} from "../_shared/outlook.ts";
import {
  createAdminClient,
  getMicrosoftConfiguration,
} from "../_shared/supabase.ts";

function redirectToFrontend(frontendUrl: string, status: string, reason?: string) {
  const target = new URL("/outlook", frontendUrl);
  target.searchParams.set("outlook", status);
  if (reason) target.searchParams.set("reason", reason);
  return Response.redirect(target.toString(), 302);
}

Deno.serve(async (request) => {
  const microsoft = getMicrosoftConfiguration();
  const requestUrl = new URL(request.url);
  const state = requestUrl.searchParams.get("state");

  if (!state) {
    return redirectToFrontend(microsoft.frontendUrl, "error", "missing_state");
  }

  const admin = createAdminClient();
  const stateHash = await sha256Hex(state);
  const { data: storedState, error: stateError } = await admin
    .from("outlook_oauth_states")
    .select("user_id, code_verifier, expires_at")
    .eq("state_hash", stateHash)
    .maybeSingle();

  if (stateError || !storedState) {
    return redirectToFrontend(microsoft.frontendUrl, "error", "invalid_state");
  }

  await admin
    .from("outlook_oauth_states")
    .delete()
    .eq("state_hash", stateHash);

  if (new Date(storedState.expires_at).getTime() < Date.now()) {
    return redirectToFrontend(microsoft.frontendUrl, "error", "expired_state");
  }

  if (requestUrl.searchParams.get("error")) {
    return redirectToFrontend(microsoft.frontendUrl, "cancelled");
  }

  const code = requestUrl.searchParams.get("code");
  if (!code) {
    return redirectToFrontend(microsoft.frontendUrl, "error", "missing_code");
  }

  try {
    const tokens = await exchangeMicrosoftCode({
      authorityTenant: microsoft.authorityTenant,
      clientId: microsoft.clientId,
      clientSecret: microsoft.clientSecret,
      code,
      codeVerifier: storedState.code_verifier,
      redirectUri: microsoft.redirectUri,
    });

    if (!tokens.refresh_token) {
      throw new Error("Microsoft did not return a refresh token.");
    }

    const profile = await getMicrosoftProfile(tokens.access_token);
    const { error: storeError } = await admin.rpc("store_outlook_connection", {
      connection_user_id: storedState.user_id,
      account_id: profile.id,
      account_email: profile.mail || profile.userPrincipalName || null,
      account_display_name: profile.displayName || null,
      connection_scopes: (tokens.scope || "").split(/\s+/).filter(Boolean),
      refresh_token: tokens.refresh_token,
    });

    if (storeError) throw storeError;
    return redirectToFrontend(microsoft.frontendUrl, "connected");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return redirectToFrontend(microsoft.frontendUrl, "error", "token_exchange");
  }
});
