import { getCorsHeaders, jsonResponse } from "../_shared/cors.ts";
import { getAuthenticatedUser } from "../_shared/supabase.ts";

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: getCorsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "Method not allowed." }, 405);
  }

  try {
    const { admin, user } = await getAuthenticatedUser(request);
    const [{ data: connection, error: connectionError }, { data: profile }] =
      await Promise.all([
        admin
          .from("outlook_connections")
          .select(
            "microsoft_email, microsoft_display_name, granted_scopes, status, connected_at, last_crawled_at, last_error, updated_at",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        admin
          .from("profiles")
          .select("outlook_onboarding_status")
          .eq("id", user.id)
          .maybeSingle(),
      ]);

    if (connectionError) throw connectionError;

    return jsonResponse(request, {
      onboarding_status: profile?.outlook_onboarding_status || "not_asked",
      connection: connection || null,
    });
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "Outlook status could not be loaded." },
      401,
    );
  }
});
