import { loadLocalEnv, getRequiredEnv } from "./env.js";
import {
  crawlerSources,
  OUTLOOK_SEARCH_KEYWORDS,
  SOURCE_PRIORITIES,
} from "./sources.js";
import {
  getAccessTokenFromRefreshToken,
  listRecentMessages,
  searchMessages,
} from "./outlookClient.js";
import { fetchPublicWebDocuments } from "./publicWebClient.js";
import {
  parseEmailsToOpportunityCandidates,
  parseWebDocumentsToOpportunityCandidates,
  scoreOpportunityText,
} from "./emailOpportunityParser.js";
import { callRpc, insertRows } from "./supabaseRest.js";

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

  if (!deadline) return Number.POSITIVE_INFINITY;

  // A date-only deadline has no published cut-off time. Keep it visible until
  // the end of that Singapore calendar day instead of dropping it at UTC midnight.
  if (!opportunity.deadline_has_time || !opportunity.deadline_source_timezone) {
    const dateOnly = deadline.slice(0, 10);
    return new Date(`${dateOnly}T23:59:59.999+08:00`).getTime();
  }

  return new Date(deadline).getTime();
}

function isActiveCandidate(candidate) {
  const deadlineTime = getCandidateDeadlineTime(candidate);

  return deadlineTime === Number.POSITIVE_INFINITY || deadlineTime >= Date.now();
}

function getSourceByType(type) {
  return crawlerSources.find((source) => source.type === type);
}

function getCandidatePriority(candidate) {
  return candidate.source_priority ?? candidate.opportunity?.source_priority ?? 99;
}

function compareCandidates(a, b) {
  const scoreDiff = b.candidate_score - a.candidate_score;
  if (scoreDiff !== 0) return scoreDiff;

  const deadlineDiff = getCandidateDeadlineTime(a) - getCandidateDeadlineTime(b);
  if (deadlineDiff !== 0) return deadlineDiff;

  const priorityDiff = getCandidatePriority(a) - getCandidatePriority(b);
  if (priorityDiff !== 0) return priorityDiff;

  return String(a.raw_subject).localeCompare(String(b.raw_subject));
}

async function getOutlookMessages() {
  const refreshToken = getRequiredEnv("OUTLOOK_REFRESH_TOKEN");
  const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
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

  return [...messagesById.values()];
}

function isNusWebSource(source) {
  return (
    source.type === "public_web" &&
    source.sourcePriority === SOURCE_PRIORITIES.NUS_WEBSITE
  );
}

async function getPublicWebDocuments({ nusOnly = false } = {}) {
  const sources = nusOnly ? crawlerSources.filter(isNusWebSource) : crawlerSources;

  return fetchPublicWebDocuments(sources);
}

function toCandidateRows(candidates) {
  return candidates.map((candidate) => ({
    school_slug: candidate.school_slug,
    source_type: candidate.source_type,
    source_message_id: candidate.source_message_id,
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
    status: candidate.status,
    extracted_opportunity: candidate.opportunity,
  }));
}

async function main() {
  const useOutlook = getFlag("--outlook");
  const useNusWeb = getFlag("--nus-web");
  const usePublicWeb = getFlag("--web") || useNusWeb;
  const useAllSources = getFlag("--all");
  const saveToSupabase = getFlag("--save");
  const debug = getFlag("--debug");

  const candidates = [];
  let scannedCount = 0;

  if (useOutlook || useAllSources) {
    const outlookSource = getSourceByType("outlook_mailbox");
    const emails = await getOutlookMessages();
    scannedCount += emails.length;
    candidates.push(
      ...parseEmailsToOpportunityCandidates(emails, {
        schoolSlug: "nus",
        sourcePriority: outlookSource?.sourcePriority,
      })
    );
  }

  if (usePublicWeb || useAllSources) {
    const webDocuments = await getPublicWebDocuments({
      nusOnly: useNusWeb && !getFlag("--web") && !useAllSources,
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

  if (!useOutlook && !usePublicWeb && !useAllSources) {
    const outlookSource = getSourceByType("outlook_mailbox");
    scannedCount = demoEmails.length;
    candidates.push(
      ...parseEmailsToOpportunityCandidates(demoEmails, {
        schoolSlug: "nus",
        sourcePriority: outlookSource?.sourcePriority,
      })
    );
  }

  const activeCandidates = candidates.filter(isActiveCandidate).sort(compareCandidates);

  console.log(`Scanned ${scannedCount} source items.`);
  console.log(`Found ${candidates.length} possible opportunities.`);
  console.log(`Kept ${activeCandidates.length} opportunities with active/no deadline.`);
  console.log(JSON.stringify(activeCandidates, null, 2));

  if (saveToSupabase) {
    const expiredCount = await callRpc("expire_past_opportunity_candidates");
    const rows = toCandidateRows(activeCandidates);
    const savedRows = await insertRows("opportunity_candidates", rows);

    if (expiredCount > 0) {
      console.log(`Marked ${expiredCount} past candidate${expiredCount === 1 ? "" : "s"} as expired.`);
    }

    console.log(`Saved ${savedRows.length} candidates to Supabase.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
