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
    const { error } = await admin.rpc("disconnect_outlook_connection", {
      connection_user_id: user.id,
    });

    if (error) throw error;
    return jsonResponse(request, { disconnected: true });
  } catch (error) {
    return jsonResponse(
      request,
      { error: error instanceof Error ? error.message : "Outlook could not be disconnected." },
      400,
    );
  }
});
