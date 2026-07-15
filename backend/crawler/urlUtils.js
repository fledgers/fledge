const TRACKING_QUERY_PARAMETERS = new Set([
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
  "utm_campaign",
  "utm_content",
  "utm_id",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

export function canonicalizeUrl(value, baseUrl) {
  if (!value) return null;

  try {
    const parsed = baseUrl ? new URL(value, baseUrl) : new URL(value);

    if (!["http:", "https:"].includes(parsed.protocol)) return null;

    parsed.hash = "";

    for (const parameter of [...parsed.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAMETERS.has(parameter.toLowerCase())) {
        parsed.searchParams.delete(parameter);
      }
    }

    parsed.searchParams.sort();
    return parsed.toString();
  } catch {
    return null;
  }
}
