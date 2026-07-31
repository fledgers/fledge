const TAVILY_SEARCH_URL = 'https://api.tavily.com/search';
const MAX_RESEARCH_OPPORTUNITIES = 5;
const MAX_RESULTS_PER_OPPORTUNITY = 3;
const SEARCH_TIMEOUT_MS = 8_000;
const MAX_SNIPPET_LENGTH = 700;

const STUDENT_DISCUSSION_HOSTS = [
  'reddit.com',
  'quora.com',
  'glassdoor.com',
  'medium.com',
];

const INSTITUTIONAL_HOST_SUFFIXES = [
  '.edu',
  '.edu.sg',
  '.ac.uk',
  '.gov',
  '.gov.sg',
];

function cleanText(value, maxLength = 300) {
  if (typeof value !== 'string') return '';

  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;

    url.hash = '';
    [
      'fbclid',
      'gclid',
      'mc_cid',
      'mc_eid',
      'ref',
      'source',
      'utm_campaign',
      'utm_content',
      'utm_medium',
      'utm_source',
      'utm_term',
    ].forEach((parameter) => url.searchParams.delete(parameter));

    return url.toString();
  } catch {
    return null;
  }
}

function hostnameMatches(hostname, candidate) {
  return hostname === candidate || hostname.endsWith(`.${candidate}`);
}

function classifySource(url) {
  const hostname = new URL(url).hostname.toLowerCase();

  if (
    STUDENT_DISCUSSION_HOSTS.some((candidate) =>
      hostnameMatches(hostname, candidate)
    )
  ) {
    return 'student_discussion';
  }

  if (
    hostname.endsWith('.edu') ||
    INSTITUTIONAL_HOST_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    return 'official_or_institutional';
  }

  return 'other_public_source';
}

function toSourceName(url) {
  return new URL(url).hostname.replace(/^www\./, '');
}

function makeSearchQuery(opportunity) {
  const title = cleanText(opportunity?.title, 180);
  const organisation = cleanText(opportunity?.organisation, 140);
  const identity = [title, organisation]
    .filter(Boolean)
    .map((value) => `"${value.replaceAll('"', '')}"`)
    .join(' ');

  return `${identity} student review experience workload feedback`.trim();
}

function sourceUrlSet(opportunity) {
  return new Set(
    [opportunity?.source_url, opportunity?.application_url]
      .map(normalizeUrl)
      .filter(Boolean)
  );
}

function normalizeSearchResults(opportunity, results) {
  if (!Array.isArray(results)) return [];

  const listingUrls = sourceUrlSet(opportunity);
  const seenUrls = new Set();

  return results.flatMap((result) => {
    const url = normalizeUrl(result?.url);
    if (!url || listingUrls.has(url) || seenUrls.has(url)) return [];

    const snippet = cleanText(
      result?.content || result?.snippet,
      MAX_SNIPPET_LENGTH
    );
    if (!snippet) return [];

    seenUrls.add(url);

    return [
      {
        opportunity_id: opportunity.id,
        opportunity_title: cleanText(opportunity.title, 180),
        title: cleanText(result?.title, 220) || toSourceName(url),
        url,
        source_name: toSourceName(url),
        snippet,
        published_date:
          cleanText(result?.published_date || result?.publishedDate, 40) || null,
        source_kind: classifySource(url),
      },
    ];
  });
}

async function searchOpportunity(opportunity, apiKey, fetchImpl) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SEARCH_TIMEOUT_MS);

  try {
    const response = await fetchImpl(TAVILY_SEARCH_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: makeSearchQuery(opportunity),
        topic: 'general',
        search_depth: 'basic',
        max_results: MAX_RESULTS_PER_OPPORTUNITY,
        include_answer: false,
        include_images: false,
        include_raw_content: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Tavily returned HTTP ${response.status}.`);
    }

    const payload = await response.json();
    return normalizeSearchResults(opportunity, payload?.results);
  } finally {
    clearTimeout(timeout);
  }
}

export async function researchOpportunityFeedback({
  opportunities,
  requested,
  apiKey = process.env.TAVILY_API_KEY,
  fetchImpl = fetch,
}) {
  if (!requested) {
    return {
      requested: false,
      status: 'not_requested',
      searchedOpportunityCount: 0,
      sourceCount: 0,
      sources: [],
    };
  }

  if (!apiKey) {
    return {
      requested: true,
      status: 'not_configured',
      searchedOpportunityCount: 0,
      sourceCount: 0,
      sources: [],
    };
  }

  const selectedOpportunities = (Array.isArray(opportunities)
    ? opportunities
    : []
  )
    .filter((opportunity) => opportunity?.id && opportunity?.title)
    .slice(0, MAX_RESEARCH_OPPORTUNITIES);

  if (!selectedOpportunities.length) {
    return {
      requested: true,
      status: 'no_results',
      searchedOpportunityCount: 0,
      sourceCount: 0,
      sources: [],
    };
  }

  const outcomes = await Promise.allSettled(
    selectedOpportunities.map((opportunity) =>
      searchOpportunity(opportunity, apiKey, fetchImpl)
    )
  );
  const sources = outcomes.flatMap((outcome) =>
    outcome.status === 'fulfilled' ? outcome.value : []
  );
  const failedSearchCount = outcomes.filter(
    (outcome) => outcome.status === 'rejected'
  ).length;

  let status = 'completed';
  if (failedSearchCount === outcomes.length) status = 'unavailable';
  else if (failedSearchCount > 0) status = 'partial';
  else if (!sources.length) status = 'no_results';

  return {
    requested: true,
    status,
    searchedOpportunityCount: selectedOpportunities.length,
    sourceCount: sources.length,
    sources,
  };
}

export const opportunityFeedbackInternals = {
  classifySource,
  makeSearchQuery,
  normalizeSearchResults,
  normalizeUrl,
};
