export function getCorsHeaders(request: Request) {
  const configuredOrigin = Deno.env.get("FRONTEND_URL")?.replace(/\/$/, "");
  const requestOrigin = request.headers.get("origin");
  const allowedOrigin = configuredOrigin && requestOrigin === configuredOrigin
    ? configuredOrigin
    : configuredOrigin || "*";

  return {
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin": allowedOrigin,
    "Vary": "Origin",
  };
}

export function jsonResponse(
  request: Request,
  body: unknown,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...getCorsHeaders(request),
      "Content-Type": "application/json; charset=utf-8",
    },
  });
}
