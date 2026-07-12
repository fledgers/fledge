import { loadLocalEnv, getRequiredEnv } from "./env.js";
import { crawlerSources, OUTLOOK_SEARCH_KEYWORDS } from "./sources.js";
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
import { insertRows } from "./supabaseRest.js";

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

function isActiveCandidate(candidate) {
  const deadline = candidate.opportunity.deadline;

  if (!deadline) return true;

  return new Date(deadline) >= new Date();
}

async function getOutlookMessages() {
  const refreshToken = getRequiredEnv("OUTLOOK_REFRESH_TOKEN");
  const accessToken = await getAccessTokenFromRefreshToken(refreshToken);
  const messagesById = new Map();

  const recentMessages = await listRecentMessages(accessToken, { top: 50 });
  for (const message of recentMessages) {
    messagesById.set(message.id, message);
  }

  for (const keyword of OUTLOOK_SEARCH_KEYWORDS.slice(0, 8)) {
    const searchResults = await searchMessages(accessToken, keyword, { top: 15 });
    for (const message of searchResults) {
      messagesById.set(message.id, message);
    }
  }

  return [...messagesById.values()];
}

async function getPublicWebDocuments() {
  return fetchPublicWebDocuments(crawlerSources);
}

function toCandidateRows(candidates) {
  return candidates.map((candidate) => ({
    school_slug: candidate.school_slug,
    source_type: candidate.source_type,
    source_message_id: candidate.source_message_id,
    source_url: candidate.source_url,
    raw_subject: candidate.raw_subject,
    raw_sender: candidate.raw_sender,
    received_at: candidate.received_at,
    candidate_score: candidate.candidate_score,
    status: candidate.status,
    extracted_opportunity: candidate.opportunity,
  }));
}

async function main() {
  const useOutlook = getFlag("--outlook");
  const usePublicWeb = getFlag("--web") || getFlag("--nus-web");
  const useAllSources = getFlag("--all");
  const saveToSupabase = getFlag("--save");
  const debug = getFlag("--debug");

  const candidates = [];
  let scannedCount = 0;

  if (useOutlook || useAllSources) {
    const emails = await getOutlookMessages();
    scannedCount += emails.length;
    candidates.push(
      ...parseEmailsToOpportunityCandidates(emails, {
        schoolSlug: "nus",
      })
    );
  }

  if (usePublicWeb || useAllSources) {
    const webDocuments = await getPublicWebDocuments();
    scannedCount += webDocuments.length;

    if (debug) {
      console.log(
        webDocuments.map((document) => ({
          source: document.sourceId,
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
    scannedCount = demoEmails.length;
    candidates.push(
      ...parseEmailsToOpportunityCandidates(demoEmails, {
        schoolSlug: "nus",
      })
    );
  }

  const activeCandidates = candidates.filter(isActiveCandidate);

  console.log(`Scanned ${scannedCount} source items.`);
  console.log(`Found ${candidates.length} possible opportunities.`);
  console.log(`Kept ${activeCandidates.length} opportunities with active/no deadline.`);
  console.log(JSON.stringify(activeCandidates, null, 2));

  if (saveToSupabase) {
    const rows = toCandidateRows(activeCandidates);
    const savedRows = await insertRows("opportunity_candidates", rows);
    console.log(`Saved ${savedRows.length} candidates to Supabase.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
