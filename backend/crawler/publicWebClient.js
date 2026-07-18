import { PDFParse } from "pdf-parse";
import { canonicalizeUrl, resolveOpportunityUrls } from "./urlUtils.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_REQUEST_DELAY_MS = 150;
const MAX_PDF_BYTES = 15 * 1024 * 1024;

const PUBLIC_WEB_LINK_KEYWORDS = [
  "apply",
  "application",
  "apprenticeship",
  "apprenticeships",
  "changemaker",
  "changemakers",
  "challenge",
  "challenges",
  "civic action",
  "competition",
  "competitions",
  "exchange",
  "fellowship",
  "grant",
  "grants",
  "hackathon",
  "internship",
  "internships",
  "i-sp-application-guide",
  "noc",
  "overseas colleges",
  "partner universities",
  "partner-universities",
  "research attachment",
  "research attachments",
  "research internship",
  "research programme",
  "research program",
  "scholarship",
  "scholarships",
  "sep",
  "special-global-programmes",
  "steer",
  "student-exchange",
  "study trip",
  "study trips",
  "summer",
  "tech-up",
  "undergraduate programme",
  "volunteer",
  "volunteering",
  "winter",
  "young defence scientists",
];

const PUBLIC_WEB_EXCLUDED_PATH_PARTS = [
  "/article/",
  "/articles/",
  "/blog/",
  "/blogs/",
  "/media/",
  "/news/",
  "/past-event",
  "/past-events",
  "/press-release",
  "/press-releases",
  "/menu-templates/",
  "/who-we-are/awards-and-accolades",
];

const PUBLIC_WEB_EXCLUDED_EXACT_PATHS = [
  "/education-programmes/nus-overseas-colleges/apply/application-info",
  "/education-programmes/nus-overseas-colleges/apply/apply-now",
  "/education-programmes/nus-overseas-colleges/apply/awards-and-scholarships",
  "/education-programmes/nus-overseas-colleges/apply/faq",
  "/education-programmes/nus-overseas-colleges/noc-story",
  "/gro/global-programmes/student-exchange",
  "/gro/global-programmes/student-exchange/outgoing-exchangers",
  "/gro/global-programmes/student-exchange/partner-universities",
  "/gro/global-programmes/student-exchange/returning-exchangers",
  "/students/jobs-internships/employment-opportunities",
];

const PUBLIC_WEB_EXCLUDED_FILE_EXTENSIONS = [
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".xls",
  ".xlsx",
];

function isPdfUrl(url) {
  return new URL(url).pathname.toLowerCase().endsWith(".pdf");
}

function decodeHtmlEntities(text) {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function normalizeWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function stripHtml(html = "") {
  return normalizeWhitespace(
    decodeHtmlEntities(
      html
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<br\s*\/?>/gi, "\n")
        .replace(/<\/(p|div|li|h1|h2|h3|h4)>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function extractTitle(html, fallback) {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1Match) return stripHtml(h1Match[1]);

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return stripHtml(titleMatch[1]);

  return fallback;
}

function extractMetaDescription(html) {
  const match = html.match(
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["'][^>]*>/i
  );

  return match ? normalizeWhitespace(decodeHtmlEntities(match[1])) : "";
}

function extractPublishedAt(html) {
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:article:published_time|datePublished|publish_date|publication_date)["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:article:published_time|datePublished|publish_date|publication_date)["'][^>]*>/i,
    /["']datePublished["']\s*:\s*["']([^"']+)["']/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (!match) continue;

    const date = new Date(decodeHtmlEntities(match[1]));
    if (!Number.isNaN(date.valueOf())) return date.toISOString();
  }

  return null;
}

function extractApplicationUrlFromHtml(html, baseUrl) {
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const label = stripHtml(match[2]).toLowerCase();
    const href = decodeHtmlEntities(match[1]);
    const linkText = `${label} ${href}`.toLowerCase();

    if (
      /\b(?:applying for|before applying|after applying|application guide)\b/.test(
        linkText
      )
    ) {
      continue;
    }

    if (!/\b(?:apply|application|register|registration)\b/.test(linkText)) {
      continue;
    }

    try {
      const url = new URL(href, baseUrl);
      if (["http:", "https:"].includes(url.protocol)) return normalizeUrl(url.toString());
    } catch {
      // Ignore malformed application links and continue looking for a usable one.
    }
  }

  return null;
}

function extractLinkedUrlsFromHtml(html, baseUrl) {
  const urls = [];
  const anchorPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = anchorPattern.exec(html)) !== null) {
    const url = canonicalizeUrl(decodeHtmlEntities(match[1]), baseUrl);
    if (url) urls.push(url);
  }

  return urls;
}

function normalizeUrl(url) {
  const normalized = canonicalizeUrl(url);
  if (!normalized) throw new Error(`Invalid crawler URL: ${url}`);
  return normalized;
}

function isAllowedHost(url, allowedHosts = []) {
  if (!allowedHosts.length) return true;

  const hostname = new URL(url).hostname.toLowerCase();

  return allowedHosts.some((allowedHost) => {
    const normalizedHost = allowedHost.toLowerCase();
    return hostname === normalizedHost || hostname.endsWith(`.${normalizedHost}`);
  });
}

function isExcludedCrawlerUrl(url, { allowPdf = false } = {}) {
  const { pathname } = new URL(url);
  const normalizedPath = pathname.toLowerCase();
  const normalizedExactPath = normalizedPath.replace(/\/+$/, "") || "/";

  if (isPdfUrl(url) && !allowPdf) return true;

  if (
    PUBLIC_WEB_EXCLUDED_FILE_EXTENSIONS.some((extension) =>
      normalizedPath.endsWith(extension)
    )
  ) {
    return true;
  }

  return (
    PUBLIC_WEB_EXCLUDED_EXACT_PATHS.includes(normalizedExactPath) ||
    PUBLIC_WEB_EXCLUDED_PATH_PARTS.some((pathPart) =>
      normalizedPath.includes(pathPart)
    )
  );
}

function extractLinks(html, baseUrl, allowedHosts, { allowPdf = false } = {}) {
  const links = [];
  const seenUrls = new Set();
  const linkPattern = /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    try {
      const url = normalizeUrl(new URL(match[1], baseUrl).toString());
      const text = stripHtml(match[2]);

      if (!text || !isAllowedHost(url, allowedHosts)) continue;
      if (isExcludedCrawlerUrl(url, { allowPdf })) continue;
      if (seenUrls.has(url)) continue;

      seenUrls.add(url);
      links.push({ url, text });
    } catch {
      // Ignore invalid links such as mailto:, tel:, javascript:, and malformed URLs.
    }
  }

  return links;
}

function isLikelyOpportunityLink(link, { allowPdf = false } = {}) {
  if (isExcludedCrawlerUrl(link.url, { allowPdf })) return false;

  const haystack = `${link.text} ${link.url}`.toLowerCase();
  return PUBLIC_WEB_LINK_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRetryableStatus(status) {
  return status === 408 || status === 429 || status >= 500;
}

async function fetchWithRetry(url, options, source = {}) {
  const maxRetries = source.maxRetries ?? DEFAULT_MAX_RETRIES;
  const timeoutMs = source.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { ...options, signal: controller.signal });

      if (!isRetryableStatus(response.status) || attempt === maxRetries) {
        return response;
      }

      lastError = new Error(`Temporary HTTP ${response.status} response from ${url}`);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) throw error;
    } finally {
      clearTimeout(timeout);
    }

    await sleep((source.retryDelayMs ?? 250) * 2 ** attempt);
  }

  throw lastError;
}

async function fetchHtml(url, source) {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FledgeCrawler/0.1; +https://fledge.example)",
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "en-SG,en;q=0.9",
    },
  }, source);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  const protectionResponse = html.toLowerCase();

  if (
    protectionResponse.includes("incapsula incident id") ||
    protectionResponse.includes("request unsuccessful")
  ) {
    throw new Error(`Blocked by website protection: ${url}`);
  }

  return html;
}

async function fetchPdfText(url, source) {
  const response = await fetchWithRetry(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; FledgeCrawler/0.1; +https://fledge.example)",
      Accept: "application/pdf",
      "Accept-Language": "en-SG,en;q=0.9",
    },
  }, source);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_PDF_BYTES) {
    throw new Error(`PDF is larger than ${MAX_PDF_BYTES} bytes: ${url}`);
  }

  const data = new Uint8Array(await response.arrayBuffer());
  if (data.byteLength > MAX_PDF_BYTES) {
    throw new Error(`PDF is larger than ${MAX_PDF_BYTES} bytes: ${url}`);
  }
  const firstBytes = new TextDecoder().decode(data.slice(0, 5));

  if (firstBytes !== "%PDF-") {
    throw new Error(`Expected a PDF document: ${url}`);
  }

  const parser = new PDFParse({ data });

  try {
    const result = await parser.getText();
    return normalizeWhitespace(result.text);
  } finally {
    await parser.destroy();
  }
}

function createWebDocument(source, url, html, fallbackTitle) {
  const title = extractTitle(html, fallbackTitle);
  const text = stripHtml(html);
  const summary = extractMetaDescription(html) || text.slice(0, 700);
  const normalizedUrl = normalizeUrl(url);
  const resolvedUrls = resolveOpportunityUrls({
    applicationUrl: extractApplicationUrlFromHtml(html, url),
    candidateUrls: extractLinkedUrlsFromHtml(html, url),
    sourceUrl: normalizedUrl,
    text: html,
    title,
  });

  return {
    id: `${source.id}:${normalizedUrl}`,
    school: source.school,
    sourceId: source.id,
    sourceName: source.name,
    url: normalizedUrl,
    detailsUrl: resolvedUrls.sourceUrl,
    applicationUrl: resolvedUrls.applicationUrl,
    publishedAt: extractPublishedAt(html),
    title,
    summary,
    text,
    defaultCategory: source.defaultCategory,
    minScore: source.minScore,
    sourcePriority: source.sourcePriority ?? 99,
    sourceTrustBoost: source.sourceTrustBoost ?? 0,
    targetAudience: source.targetAudience,
    requiresNusStudentEligibility: source.requiresNusStudentEligibility ?? true,
    trustedForNusStudents: source.trustedForNusStudents || false,
    fetchedAt: new Date().toISOString(),
  };
}

function createPdfDocument(source, url, text, fallbackTitle) {
  const title = normalizeWhitespace(fallbackTitle || source.name);

  return {
    id: `${source.id}:${normalizeUrl(url)}`,
    school: source.school,
    sourceId: source.id,
    sourceName: source.name,
    url: normalizeUrl(url),
    applicationUrl: null,
    publishedAt: null,
    title,
    summary: text.slice(0, 700),
    text,
    documentFormat: "pdf",
    programmeDetails: source.programmeDetails || false,
    defaultCategory: source.defaultCategory,
    minScore: source.minScore,
    sourcePriority: source.sourcePriority ?? 99,
    sourceTrustBoost: source.sourceTrustBoost ?? 0,
    targetAudience: source.targetAudience,
    requiresNusStudentEligibility: source.requiresNusStudentEligibility ?? true,
    trustedForNusStudents: source.trustedForNusStudents || false,
    fetchedAt: new Date().toISOString(),
  };
}

function acceptsLinkedDocumentType(source, url) {
  const allowedTypes = source.linkedDocumentTypes;

  if (!allowedTypes?.length) return true;

  return allowedTypes.includes(isPdfUrl(url) ? "pdf" : "html");
}

function findRelevantLinks(source, html, baseUrl, allowPdf) {
  return extractLinks(html, baseUrl, source.allowedHosts, { allowPdf })
    .filter((link) => acceptsLinkedDocumentType(source, link.url))
    .filter((link) => isLikelyOpportunityLink(link, { allowPdf }));
}

export async function fetchPublicWebSource(source) {
  const rootUrl = normalizeUrl(source.url);
  const rootHtml = await fetchHtml(rootUrl, source);
  const seenUrls = new Set([rootUrl]);
  const documents = source.createRootDocument === false
    ? []
    : [createWebDocument(source, rootUrl, rootHtml, source.name)];
  const allowPdf = source.linkedDocumentTypes?.includes("pdf") || false;
  const maxDepth = source.maxDepth ?? 1;
  const maxLinkedPages = source.maxLinkedPages ?? 4;
  const queuedUrls = new Set();
  const queue = findRelevantLinks(source, rootHtml, rootUrl, allowPdf)
    .filter((link) => !seenUrls.has(link.url))
    .map((link) => ({ ...link, depth: 1 }));

  for (const link of queue) queuedUrls.add(link.url);

  while (queue.length && seenUrls.size - 1 < maxLinkedPages) {
    const link = queue.shift();

    try {
      if (seenUrls.has(link.url)) continue;

      seenUrls.add(link.url);
      await sleep(source.requestDelayMs ?? DEFAULT_REQUEST_DELAY_MS);

      if (isPdfUrl(link.url)) {
        const pdfText = await fetchPdfText(link.url, source);
        documents.push(createPdfDocument(source, link.url, pdfText, link.text));
      } else {
        const linkedHtml = await fetchHtml(link.url, source);
        documents.push(createWebDocument(source, link.url, linkedHtml, link.text));

        if (link.depth < maxDepth) {
          const nestedLinks = findRelevantLinks(
            source,
            linkedHtml,
            link.url,
            allowPdf
          );

          for (const nestedLink of nestedLinks) {
            if (seenUrls.has(nestedLink.url) || queuedUrls.has(nestedLink.url)) continue;

            queuedUrls.add(nestedLink.url);
            queue.push({ ...nestedLink, depth: link.depth + 1 });
          }
        }
      }
    } catch (error) {
      console.warn(`Skipping linked page: ${error.message}`);
    }
  }

  return documents;
}

export async function fetchPublicWebDocuments(sources, { onSourceResult } = {}) {
  const documents = [];

  const crawlOrderedSources = [...sources].sort(
    (a, b) => (a.sourcePriority ?? 99) - (b.sourcePriority ?? 99)
  );

  for (const source of crawlOrderedSources) {
    if (!source.enabled || source.type !== "public_web") continue;

    try {
      const sourceDocuments = await fetchPublicWebSource(source);
      documents.push(...sourceDocuments);
      onSourceResult?.({
        source_id: source.id,
        source_type: source.type,
        status: "completed",
        document_count: sourceDocuments.length,
      });
    } catch (error) {
      console.warn(`Skipping source ${source.id}: ${error.message}`);
      onSourceResult?.({
        source_id: source.id,
        source_type: source.type,
        status: "failed",
        document_count: 0,
        error: error.message,
      });
    }
  }

  return documents;
}
