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

const APPLICATION_FORM_HOSTS = new Set([
  "docs.google.com",
  "form.gov.sg",
  "forms.gle",
  "forms.office.com",
  "formstack.com",
  "jotform.com",
  "tally.so",
  "typeform.com",
  "www.jotform.com",
  "www.typeform.com",
]);

const APPLICATION_URL_SIGNAL =
  /(?:^|[./_-])(?:apply|application|applications|enrol|enroll|register|registration|signup|sign-up|submit)(?:$|[./_?&=-])/i;

const APPLICATION_TITLE_SIGNAL =
  /\b(?:application form|application portal|apply now|enrol now|enroll now|register now|registration form|sign up now)\b/i;

const APPLICATION_GUIDE_SIGNAL =
  /\b(?:after applying|application guide|applying for|before applying)\b/i;

const INFORMATION_URL_SIGNAL =
  /\b(?:about|details?|eligibility|hackathon|information|programme|program|scholarships?)\b/i;

const INFORMATION_CONTEXT_SIGNAL =
  /\b(?:details?|find out more|for more information|learn more|official (?:page|site|website)|programme website|program website|read more)\b/i;

const UTILITY_URL_SIGNAL =
  /\b(?:contact|cookie|facebook|faq|help|instagram|linkedin|login|privacy|sign-in|terms|youtube)\b/i;

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

export function isLikelyApplicationUrl(value, title = "") {
  const canonicalUrl = canonicalizeUrl(value);
  if (!canonicalUrl) return false;

  const parsed = new URL(canonicalUrl);
  const hostname = parsed.hostname.toLowerCase();
  const comparableUrl = `${hostname}${parsed.pathname}${parsed.search}`;
  const readableUrl = decodeURIComponent(comparableUrl).replace(/[-_/]+/g, " ");

  if (
    !APPLICATION_FORM_HOSTS.has(hostname) &&
    APPLICATION_GUIDE_SIGNAL.test(`${readableUrl} ${title}`)
  ) {
    return false;
  }

  return (
    APPLICATION_FORM_HOSTS.has(hostname) ||
    APPLICATION_URL_SIGNAL.test(comparableUrl) ||
    APPLICATION_TITLE_SIGNAL.test(title)
  );
}

function extractUrlsWithContext(text = "") {
  const matches = [];
  const pattern = /https?:\/\/[^\s"'<>()[\]{}]+/gi;
  let match;

  while ((match = pattern.exec(String(text))) !== null) {
    const url = canonicalizeUrl(match[0].replace(/[.,;:!?]+$/, ""));
    if (!url) continue;

    matches.push({
      context: String(text).slice(
        Math.max(0, match.index - 120),
        Math.min(String(text).length, pattern.lastIndex + 120)
      ),
      url,
    });
  }

  return matches;
}

function scoreInformationUrl({ context = "", url }) {
  const parsed = new URL(url);
  const comparableUrl = `${parsed.hostname}${parsed.pathname}`;
  let score = 0;

  if (INFORMATION_CONTEXT_SIGNAL.test(context)) score += 5;
  if (INFORMATION_URL_SIGNAL.test(comparableUrl)) score += 2;
  if (/\.(?:edu|gov)(?:\.[a-z]{2})?$/i.test(parsed.hostname)) score += 2;
  if (UTILITY_URL_SIGNAL.test(comparableUrl)) score -= 5;

  return score;
}

export function resolveOpportunityUrls({
  applicationUrl,
  candidateUrls = [],
  sourceUrl,
  text = "",
  title = "",
} = {}) {
  const canonicalSourceUrl = canonicalizeUrl(sourceUrl);
  const canonicalApplicationUrl = canonicalizeUrl(applicationUrl, canonicalSourceUrl);
  const textUrls = extractUrlsWithContext(text);
  const extraUrls = candidateUrls
    .map((value) => canonicalizeUrl(value, canonicalSourceUrl))
    .filter(Boolean)
    .map((url) => ({ context: "", url }));
  const candidates = [
    ...(canonicalSourceUrl ? [{ context: "", url: canonicalSourceUrl }] : []),
    ...(canonicalApplicationUrl
      ? [{ context: "", url: canonicalApplicationUrl }]
      : []),
    ...textUrls,
    ...extraUrls,
  ];

  let resolvedApplicationUrl = canonicalApplicationUrl;

  if (!resolvedApplicationUrl && canonicalSourceUrl) {
    if (isLikelyApplicationUrl(canonicalSourceUrl, title)) {
      resolvedApplicationUrl = canonicalSourceUrl;
    }
  }

  if (!resolvedApplicationUrl) {
    resolvedApplicationUrl =
      candidates.find(({ url }) => isLikelyApplicationUrl(url))?.url || null;
  }

  if (
    canonicalSourceUrl &&
    canonicalSourceUrl !== resolvedApplicationUrl &&
    !isLikelyApplicationUrl(canonicalSourceUrl, title)
  ) {
    return {
      applicationUrl: resolvedApplicationUrl,
      sourceUrl: canonicalSourceUrl,
    };
  }

  const informationCandidates = new Map();

  for (const candidate of candidates) {
    if (
      candidate.url === resolvedApplicationUrl ||
      isLikelyApplicationUrl(candidate.url, title)
    ) {
      continue;
    }

    const score = scoreInformationUrl(candidate);
    const existing = informationCandidates.get(candidate.url);

    if (!existing || score > existing.score) {
      informationCandidates.set(candidate.url, { ...candidate, score });
    }
  }

  const resolvedSourceUrl =
    [...informationCandidates.values()]
      .sort((left, right) => right.score - left.score)
      .find(({ score }) => score >= 0)?.url || null;

  return {
    applicationUrl: resolvedApplicationUrl,
    sourceUrl: resolvedSourceUrl,
  };
}
