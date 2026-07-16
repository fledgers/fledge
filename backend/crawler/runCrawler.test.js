import assert from "node:assert/strict";
import test from "node:test";
import {
  buildRunSummary,
  compareCandidates,
  isActiveCandidate,
  toCandidateRows,
} from "./runCrawler.js";

test("builds ingestion rows without overwriting database review status", () => {
  const [row] = toCandidateRows([
    {
      school_slug: "nus",
      source_type: "public_web",
      source_message_id: "source:https://example.edu/opportunity",
      source_url: "https://example.edu/opportunity",
      candidate_score: 12,
      confidence_score: 90,
      review_reasons: ["year_requirements_not_stated"],
      status: "pending",
      opportunity: { title: "Example Opportunity" },
    },
  ]);

  assert.equal(row.source_message_id, "source:https://example.edu/opportunity");
  assert.equal(row.extracted_opportunity.title, "Example Opportunity");
  assert.equal(Object.hasOwn(row, "status"), false);
});

test("rejects candidates that have no stable source identity", () => {
  assert.throws(
    () =>
      toCandidateRows([
        {
          source_type: "public_web",
          raw_subject: "Identity missing",
          opportunity: { title: "Identity missing" },
        },
      ]),
    /no stable source identity/i
  );
});

test("builds a database-ready crawler run summary", () => {
  const summary = buildRunSummary({
    scannedCount: 12,
    candidateCount: 5,
    activeCount: 4,
    ingestion: { inserted: 2, refreshed: 2, changed: 1 },
    autoPublication: { published: 1 },
    sourceResults: [{ source_id: "nus", status: "completed" }],
  });

  assert.deepEqual(summary, {
    scanned_count: 12,
    candidate_count: 5,
    active_count: 4,
    inserted_count: 2,
    refreshed_count: 2,
    changed_count: 1,
    auto_published_count: 1,
    source_results: [{ source_id: "nus", status: "completed" }],
  });
});

test("orders Outlook candidates before higher-scoring public candidates", () => {
  const candidates = [
    {
      raw_subject: "External competition",
      candidate_score: 30,
      source_priority: 4,
      opportunity: { deadline: null },
    },
    {
      raw_subject: "NUS Outlook opportunity",
      candidate_score: 8,
      source_priority: 0,
      opportunity: { deadline: null },
    },
  ];

  candidates.sort(compareCandidates);

  assert.equal(candidates[0].raw_subject, "NUS Outlook opportunity");
});

test("treats only unexpired rolling applications as active", () => {
  assert.equal(
    isActiveCandidate({
      opportunity: {
        deadline: null,
        listing_expires_at: "2999-09-13T00:00:00.000Z",
      },
    }),
    true
  );
  assert.equal(
    isActiveCandidate({
      opportunity: {
        deadline: null,
        listing_expires_at: "2020-09-13T00:00:00.000Z",
      },
    }),
    false
  );
  assert.equal(
    isActiveCandidate({
      opportunity: { deadline: null, listing_expires_at: null },
    }),
    false
  );
});
