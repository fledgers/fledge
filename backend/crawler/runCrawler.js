import { pathToFileURL } from "node:url";
import { loadLocalEnv } from "./env.js";
import {
  crawlerSources,
  OUTLOOK_SEARCH_KEYWORDS,
  SOURCE_PRIORITIES,
} from "./sources.js";
import {
  listRecentMessages,
  refreshOutlookAccessToken,
  searchMessages,
} from "./outlookClient.js";
import {
  loadCrawlerOutlookConnections,
  recordOutlookCrawlResult,
} from "./outlookConnections.js";
import { fetchPublicWebDocuments } from "./publicWebClient.js";
import {
  discoverPublicWebDocuments,
  isWebDiscoveryConfigured,
} from "./webDiscoveryClient.js";
import {
  parseEmailsToOpportunityCandidates,
  parseWebDocumentsToOpportunityCandidates,
  scoreOpportunityText,
} from "./emailOpportunityParser.js";
import { callRpc } from "./supabaseRest.js";

loadLocalEnv();

const demoEmails = [
  {
    id: "demo-1",
    subject: "Applications open: Summer Data Science Programme",
    from: {
      emailAddress: {
        name: "NUS Data Science Club",
        address: "datascience@example.edu",
      },
    },
    receivedDateTime: "2026-07-11T08:00:00Z",
    bodyPreview:
      "Join our summer programme for students interested in data analytics and machine learning. Deadline: 30 Aug 2026. Venue: On campus.",
    body: {
      contentType: "text",
      content:
        "Join our summer programme for students interested in data analytics and machine learning. Deadline: 30 Aug 2026. Venue: On campus. Register at https://example.edu/summer-data.",
    },
    webLink: "https://outlook.office.com/mail/demo-1",
  },
  {
    id: "demo-2",
    subject: "Weekly cafeteria menu",
    from: {
      emailAddress: {
        name: "Campus Dining",
        address: "dining@example.edu",
      },
    },
    receivedDateTime: "2026-07-10T08:00:00Z",
    bodyPreview: "Here is this week's cafeteria menu.",
    body: {
      contentType: "text",
      content: "Here is this week's cafeteria menu.",
    },
    webLink: "https://outlook.office.com/mail/demo-2",
  },
];

function getFlag(name) {
  return process.argv.includes(name);
}

function getCandidateDeadlineTime(candidate) {
  const opportunity = candidate.opportunity;
  const deadline = opportunity.deadline;

  if (!deadline) {
    return opportunity.listing_expires_at
      ? new Date(opportunity.listing_expires_at).getTime()
      : Number.NEGATIVE_INFINITY;
  }

  // A date-only deadline has no published cut-off time. Keep it visible until
  // the end of that Singapore calendar day instead of dropping it at UTC midnight.
  if (!opportunity.deadline_has_time || !opportunity.deadline_source_timezone) {
    const dateOnly = deadline.slice(0, 10);
    return new Date(`${dateOnly}T23:59:59.999+08:00`).getTime();
  }

  return new Date(deadline).getTime();
}

export function isActiveCandidate(candidate) {
  const deadlineTime = getCandidateDeadlineTime(candidate);

  return Number.isFinite(deadlineTime) && deadlineTime >= Date.now();
}

function getSourceByType(type) {
  return crawlerSources.find((source) => source.type === type);
}

function getCandidatePriority(candidate) {
  return candidate.source_priority ?? candidate.opportunity?.source_priority ?? 99;
}

export function compareCandidates(a, b) {
  const priorityDiff = getCandidatePriority(a) - getCandidatePriority(b);
  if (priorityDiff !== 0) return priorityDiff;

  const scoreDiff = b.candidate_score - a.candidate_score;
  if (scoreDiff !== 0) return scoreDiff;

  const deadlineDiff = getCandidateDeadlineTime(a) - getCandidateDeadlineTime(b);
  if (deadlineDiff !== 0) return deadlineDiff;

  return String(a.raw_subject).localeCompare(String(b.raw_subject));
}

async function getOutlookMessages(refreshToken) {
  const tokenResult = await refreshOutlookAccessToken(refreshToken);
  const accessToken = tokenResult.accessToken;
  const messagesById = new Map();

  const recentMessages = await listRecentMessages(accessToken, { top: 50 });
  for (const message of recentMessages) {
    messagesById.set(message.id, message);
  }

  for (const keyword of OUTLOOK_SEARCH_KEYWORDS.slice(0, 18)) {
    const searchResults = await searchMessages(accessToken, keyword, { top: 15 });
    for (const message of searchResults) {
      messagesById.set(message.id, message);
    }
  }

  return {
    messages: [...messagesById.values()],
    refreshToken: tokenResult.refreshToken,
  };
}

function isNusWebSource(source) {
  return (
    source.type === "public_web" &&
    source.sourcePriority === SOURCE_PRIORITIES.NUS_WEBSITE
  );
}

async function getPublicWebDocuments({ nusOnly = false, onSourceResult } = {}) {
  const sources = nusOnly ? crawlerSources.filter(isNusWebSource) : crawlerSources;

  return fetchPublicWebDocuments(sources, { onSourceResult });
}

function getRunMode({
  useAllSources,
  useNusWeb,
  useOutlook,
  usePublicWeb,
  useWebDiscovery,
}) {
  if (useAllSources) return "all";
  if (useOutlook) return "outlook";
  if (useNusWeb && usePublicWeb) return "nus_web";
  if (useWebDiscovery && !usePublicWeb) return "web_discovery";
  if (usePublicWeb) return "web";
  return "demo";
}

async function finishCrawlerRunSafely(runId, status, summary, errorMessage = null) {
  if (!runId) return;

  try {
    await callRpc("finish_crawler_run", {
      run_id: runId,
      run_status: status,
      run_summary: summary,
      failure_message: errorMessage,
    });
  } catch (error) {
    console.warn(`Could not finish crawler run log: ${error.message}`);
  }
}

export function buildRunSummary({
  scannedCount,
  candidateCount,
  activeCount,
  ingestion,
  autoPublication,
  sourceResults,
}) {
  return {
    scanned_count: scannedCount,
    candidate_count: candidateCount,
    active_count: activeCount,
    inserted_count: ingestion.inserted || 0,
    refreshed_count: ingestion.refreshed || 0,
    changed_count: ingestion.changed || 0,
    auto_published_count: autoPublication.published || 0,
    source_results: sourceResults,
  };
}

export function toCandidateRows(candidates) {
  return candidates.map((candidate) => {
    const sourceType = candidate.source_type;
    const sourceMessageId = candidate.source_message_id || candidate.source_url;

    if (!sourceType || !sourceMessageId) {
      throw new Error(
        `Candidate "${candidate.raw_subject || "Untitled opportunity"}" has no stable source identity.`
      );
    }

    return {
      school_slug: candidate.school_slug,
      source_type: sourceType,
      source_message_id: sourceMessageId,
      source_url: candidate.source_url,
      application_url: candidate.application_url,
      raw_subject: candidate.raw_subject,
      raw_sender: candidate.raw_sender,
      received_at: candidate.received_at,
      source_published_at: candidate.source_published_at,
      last_seen_at: candidate.last_seen_at,
      content_hash: candidate.content_hash,
      source_priority: candidate.source_priority,
      candidate_score: candidate.candidate_score,
      confidence_score: candidate.confidence_score,
      review_reasons: candidate.review_reasons,
      dedupe_key: candidate.dedupe_key,
      extraction_evidence: candidate.extraction_evidence,
      auto_publish_eligible: candidate.auto_publish_eligible,
      auto_publish_reasons: candidate.auto_publish_reasons,
      extracted_opportunity: candidate.opportunity,
    };
  });
}

async function main() {
  const useOutlook = getFlag("--outlook");
  const useNusWeb = getFlag("--nus-web");
  const usePublicWeb = getFlag("--web") || useNusWeb;
  const useAllSources = getFlag("--all");
  const useWebDiscovery = getFlag("--discover") || getFlag("--web") || useAllSources;
  const saveToSupabase = getFlag("--save");
  const debug = getFlag("--debug");
  const candidates = [];
  const sourceResults = [];
  let scannedCount = 0;
  let activeCandidateCount = 0;
  let ingestion = { inserted: 0, refreshed: 0, changed: 0, processed: 0 };
  let autoPublication = { published: 0, failed: 0 };
  let crawlerRunId = null;
  const runMode = getRunMode({
    useAllSources,
    useNusWeb,
    useOutlook,
    usePublicWeb,
    useWebDiscovery,
  });

  if (saveToSupabase) {
    crawlerRunId = await callRpc("start_crawler_run", { run_mode: runMode });
  }

  try {
    if (useOutlook || useAllSources) {
      const outlookSource = getSourceByType("outlook_mailbox");

      const connections = await loadCrawlerOutlookConnections({ saveToSupabase });

      if (connections.length === 0) {
        sourceResults.push({
          source_id: outlookSource?.id || "outlook_mailbox",
          source_type: "outlook_mailbox",
          status: "skipped",
          document_count: 0,
          error: "No students have connected Outlook.",
        });
      }

      for (const connection of connections) {
        const sourceId = `${outlookSource?.id || "outlook_mailbox"}:${connection.user_id || "legacy"}`;

        try {
          const result = await getOutlookMessages(connection.refresh_token);
          scannedCount += result.messages.length;
          candidates.push(
            ...parseEmailsToOpportunityCandidates(result.messages, {
              schoolSlug: "nus",
              sourcePriority: outlookSource?.sourcePriority,
              ownerUserId: connection.user_id,
              sourceIdentityPrefix: connection.user_id || "legacy",
            })
          );
          await recordOutlookCrawlResult({
            connection,
            refreshToken: result.refreshToken,
          });
          sourceResults.push({
            source_id: sourceId,
            source_type: "outlook_mailbox",
            status: "completed",
            document_count: result.messages.length,
          });
        } catch (error) {
          await recordOutlookCrawlResult({ connection, error }).catch(recordError => {
            console.warn(`Could not record Outlook crawl failure: ${recordError.message}`);
          });
          sourceResults.push({
            source_id: sourceId,
            source_type: "outlook_mailbox",
            status: "failed",
            document_count: 0,
            error: error.message,
          });
        }
      }
    }

    if (usePublicWeb || useAllSources) {
      const webDocuments = await getPublicWebDocuments({
        nusOnly: useNusWeb && !getFlag("--web") && !useAllSources,
        onSourceResult: (result) => sourceResults.push(result),
      });
      scannedCount += webDocuments.length;

      if (debug) {
        console.log(
          webDocuments.map((document) => ({
            source: document.sourceId,
            priority: document.sourcePriority,
            title: document.title,
            score: scoreOpportunityText(
              [document.title, document.summary, document.text].join(" ")
            ) + (document.sourceTrustBoost || 0),
            url: document.url,
          }))
        );
      }

      candidates.push(...parseWebDocumentsToOpportunityCandidates(webDocuments));
    }

    if (useWebDiscovery) {
      if (!isWebDiscoveryConfigured()) {
        console.warn(
          "Skipping broad web discovery because TAVILY_API_KEY is not configured."
        );
        sourceResults.push({
          source_id: "broad-web-discovery",
          source_type: "web_discovery",
          status: "skipped",
          document_count: 0,
          error: "TAVILY_API_KEY is not configured.",
        });
      } else {
        const queryResults = [];
        const discoveredDocuments = await discoverPublicWebDocuments({
          onQueryResult: (result) => queryResults.push(result),
        });
        scannedCount += discoveredDocuments.length;
        candidates.push(
          ...parseWebDocumentsToOpportunityCandidates(discoveredDocuments)
        );
        sourceResults.push({
          source_id: "broad-web-discovery",
          source_type: "web_discovery",
          status: queryResults.some((result) => result.status === "completed")
            ? "completed"
            : "failed",
          document_count: discoveredDocuments.length,
          query_results: queryResults,
        });
      }
    }

    if (!useOutlook && !usePublicWeb && !useWebDiscovery && !useAllSources) {
      const outlookSource = getSourceByType("outlook_mailbox");
      scannedCount = demoEmails.length;
      candidates.push(
        ...parseEmailsToOpportunityCandidates(demoEmails, {
          schoolSlug: "nus",
          sourcePriority: outlookSource?.sourcePriority,
          ownerUserId: process.env.OUTLOOK_OWNER_USER_ID || null,
        })
      );
      sourceResults.push({
        source_id: "demo_outlook",
        source_type: "demo",
        status: "completed",
        document_count: demoEmails.length,
      });
    }

    const activeCandidates = candidates.filter(isActiveCandidate).sort(compareCandidates);
    activeCandidateCount = activeCandidates.length;

    console.log(`Scanned ${scannedCount} source items.`);
    console.log(`Found ${candidates.length} possible opportunities.`);
    console.log(`Kept ${activeCandidates.length} active or rolling opportunities.`);
    console.log(JSON.stringify(activeCandidates, null, 2));

    if (saveToSupabase) {
      const expiredCount = await callRpc("expire_past_opportunity_candidates");
      const cleanup = await callRpc("purge_expired_opportunities", {
        retention_days: 15,
      });
      const rows = toCandidateRows(activeCandidates);
      ingestion = await callRpc("ingest_opportunity_candidates", {
        candidate_rows: rows,
      });
      const synchronization = await callRpc("sync_approved_opportunity_candidates");
      autoPublication = await callRpc("auto_publish_opportunity_candidates");

      if (expiredCount > 0) {
        console.log(
          `Marked ${expiredCount} past candidate${expiredCount === 1 ? "" : "s"} as expired.`
        );
      }

      if (cleanup.opportunities_deleted > 0 || cleanup.candidates_deleted > 0) {
        console.log(
          `Deleted ${cleanup.opportunities_deleted} opportunities and ` +
            `${cleanup.candidates_deleted} candidates past the 15-day retention window.`
        );
      }

      console.log(
        `Candidate sync processed ${ingestion.processed} rows: ` +
          `${ingestion.inserted} inserted, ${ingestion.refreshed} refreshed, ` +
          `${ingestion.changed} changed.`
      );
      console.log(
        `Published ${autoPublication.published} automatically; ` +
          `synchronized ${synchronization.synced} approved opportunities.`
      );

      await finishCrawlerRunSafely(
        crawlerRunId,
        "completed",
        buildRunSummary({
          scannedCount,
          candidateCount: candidates.length,
          activeCount: activeCandidates.length,
          ingestion,
          autoPublication,
          sourceResults,
        })
      );
    }
  } catch (error) {
    await finishCrawlerRunSafely(
      crawlerRunId,
      "failed",
      buildRunSummary({
        scannedCount,
        candidateCount: candidates.length,
        activeCount: activeCandidateCount,
        ingestion,
        autoPublication,
        sourceResults,
      }),
      error.message
    );
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
