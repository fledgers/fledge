import {
  canonicalizeUrl,
  isLikelyApplicationUrl,
  resolveOpportunityUrls,
} from "./urlUtils.js";

const TAVILY_SEARCH_URL = "https://api.tavily.com/search";
const DEFAULT_MAX_RESULTS_PER_QUERY = 8;

export const WEB_DISCOVERY_QUERIES = [
  "NUS students applications open internship research programme deadline",
  "Singapore undergraduate internship applications open deadline",
  "Singapore university students competition hackathon applications open",
  "undergraduate research attachment Singapore application deadline",
  "undergraduate scholarship Singapore applications open deadline",
  "summer winter programme university students Asia application deadline",
  "student exchange study trip Singapore university application",
  "community volunteer entrepreneurship programme Singapore university students",
];

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function getHostname(url) {
  return new URL(url).hostname.replace(/^www\./, "");
}

function createDiscoveryDocument(result, query, fetchedAt) {
  const url = canonicalizeUrl(result.url);
  if (!url || !isHttpUrl(url)) return null;

  const title = String(result.title || getHostname(url)).trim();
  const summary = String(result.content || "").trim();
  const rawContent = String(result.raw_content || "").trim();
  const resolvedUrls = resolveOpportunityUrls({
    applicationUrl: isLikelyApplicationUrl(url, title) ? url : null,
    sourceUrl: url,
    text: `${rawContent}\n${summary}`,
    title,
  });

  return {
    id: `web-discovery:${url}`,
    school: "nus",
    sourceId: "broad-web-discovery",
    sourceName: getHostname(url),
    url,
    detailsUrl: resolvedUrls.sourceUrl,
    applicationUrl: resolvedUrls.applicationUrl,
    publishedAt: null,
    title,
    summary,
    text: rawContent || summary || title,
    defaultCategory: "other",
    minScore: 7,
    sourcePriority: 4,
    sourceTrustBoost: 0,
    targetAudience: "nus_students",
    requiresNusStudentEligibility: true,
    trustedForNusStudents: false,
    fetchedAt,
    discoveryQuery: query,
    discoveryScore: result.score ?? null,
  };
}

async function searchQuery({ apiKey, fetchImpl, maxResultsPerQuery, query }) {
  const response = await fetchImpl(TAVILY_SEARCH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      topic: "general",
      search_depth: "basic",
      max_results: maxResultsPerQuery,
      include_answer: false,
      include_images: false,
      include_raw_content: "text",
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Web discovery failed for "${query}": ${response.status} ${JSON.stringify(body)}`
    );
  }

  return Array.isArray(body.results) ? body.results : [];
}

export function isWebDiscoveryConfigured(environment = process.env) {
  return Boolean(environment.TAVILY_API_KEY?.trim());
}

export async function discoverPublicWebDocuments({
  apiKey = process.env.TAVILY_API_KEY,
  fetchImpl = fetch,
  maxResultsPerQuery = DEFAULT_MAX_RESULTS_PER_QUERY,
  onQueryResult,
  queries = WEB_DISCOVERY_QUERIES,
} = {}) {
  if (!apiKey?.trim()) return [];

  const documentsByUrl = new Map();
  const fetchedAt = new Date().toISOString();

  for (const query of queries) {
    try {
      const results = await searchQuery({
        apiKey,
        fetchImpl,
        maxResultsPerQuery,
        query,
      });

      for (const result of results) {
        const document = createDiscoveryDocument(result, query, fetchedAt);
        if (!document) continue;

        const existing = documentsByUrl.get(document.url);
        if (!existing || (document.discoveryScore ?? 0) > (existing.discoveryScore ?? 0)) {
          documentsByUrl.set(document.url, document);
        }
      }

      onQueryResult?.({
        query,
        status: "completed",
        result_count: results.length,
      });
    } catch (error) {
      onQueryResult?.({
        query,
        status: "failed",
        result_count: 0,
        error: error.message,
      });
    }
  }

  return [...documentsByUrl.values()];
}
