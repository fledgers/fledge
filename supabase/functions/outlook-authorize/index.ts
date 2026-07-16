import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { createPkceValues, createRandomValue, sha256Hex } from "../_shared/crypto.ts";
import { buildMicrosoftAuthorizationUrl } from "../_shared/outlook.ts";
import {
  getAuthenticatedUser,
  getMicrosoftConfiguration,
} from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  try {
    const { admin, user } = await getAuthenticatedUser(request);
    const microsoft = getMicrosoftConfiguration();
    const state = createRandomValue(32);
    const stateHash = await sha256Hex(state);
    const { codeChallenge, codeVerifier } = await createPkceValues();

    await admin
      .from("outlook_oauth_states")
      .delete()
      .or(`user_id.eq.${user.id},expires_at.lt.${new Date().toISOString()}`);

    const { error: stateError } = await admin
      .from("outlook_oauth_states")
      .insert({
        state_hash: stateHash,
        user_id: user.id,
        code_verifier: codeVerifier,
        expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      });

    if (stateError) throw stateError;

    return jsonResponse(request, {
      authorization_url: buildMicrosoftAuthorizationUrl({
        authorityTenant: microsoft.authorityTenant,
        clientId: microsoft.clientId,
        codeChallenge,
        redirectUri: microsoft.redirectUri,
        state,
      }),
    });
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "Outlook authorization failed." },
      401,
    );
  }
});
