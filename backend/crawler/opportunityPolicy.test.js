import assert from "node:assert/strict";
import test from "node:test";
import {
  buildOpportunityDedupeKey,
  getAutomaticPublicationDecision,
} from "./opportunityPolicy.js";

test("builds the same dedupe key after URL tracking parameters are removed", () => {
  const firstKey = buildOpportunityDedupeKey({
    title: "Applications Open: Global Design Challenge",
    organisation: "Example University",
    category: "competition",
    application_url: "https://example.edu/apply?utm_source=email&a=1",
    deadline: "2026-10-18T00:00:00.000Z",
  });
  const secondKey = buildOpportunityDedupeKey({
    title: "Global Design Challenge",
    organisation: "Example University",
    category: "competition",
    application_url: "https://example.edu/apply?a=1&utm_source=telegram",
    deadline: "2026-10-18T00:00:00.000Z",
  });

  assert.equal(firstKey, secondKey);
});

test("allows a complete priority-one public source to auto-publish", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "public_web",
    source_priority: 1,
    confidence_score: 90,
    dedupe_key: "details:example",
    review_reasons: ["missing_source_published_at"],
    opportunity: {
      application_url: null,
    },
  });

  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test("keeps Outlook candidates pending even when extraction is complete", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "outlook_email",
    source_priority: 1,
    confidence_score: 100,
    dedupe_key: "application:example",
    review_reasons: [],
    opportunity: {
      application_url: "https://example.edu/apply",
    },
  });

  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes("outlook_requires_privacy_review"));
});
