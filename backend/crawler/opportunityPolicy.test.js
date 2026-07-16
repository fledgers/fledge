import assert from "node:assert/strict";
import test from "node:test";
import {
  AUTO_PUBLISH_CONFIDENCE_THRESHOLDS,
  buildOpportunityDedupeKey,
  getAutomaticPublicationDecision,
  getOpportunityVisibilityDecision,
  scopeOpportunityDedupeKey,
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

test("auto-publishes a complete high-confidence external opportunity", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "public_web",
    source_priority: 3,
    confidence_score: AUTO_PUBLISH_CONFIDENCE_THRESHOLDS.EXTERNAL_PUBLIC,
    dedupe_key: "application:external-example",
    review_reasons: [],
    opportunity: {
      application_url: "https://external.example.org/apply",
      deadline: "2026-10-18T00:00:00.000Z",
    },
  });

  assert.equal(decision.minimumConfidence, 95);
  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test("keeps an external opportunity pending below the confidence threshold", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "public_web",
    source_priority: 4,
    confidence_score: AUTO_PUBLISH_CONFIDENCE_THRESHOLDS.EXTERNAL_PUBLIC - 1,
    dedupe_key: "application:discovered-example",
    review_reasons: [],
    opportunity: {
      application_url: "https://discovered.example.org/apply",
      deadline: "2026-10-18T00:00:00.000Z",
    },
  });

  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes("confidence_below_95"));
});

test("allows a rolling application to replace a missing deadline", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "public_web",
    source_priority: 1,
    confidence_score: 90,
    dedupe_key: "application:rolling-example",
    review_reasons: ["missing_deadline"],
    opportunity: {
      application_url: "https://example.edu/apply",
      listing_expires_at: "2026-09-13T00:00:00.000Z",
    },
  });

  assert.equal(decision.eligible, true);
  assert.deepEqual(decision.reasons, []);
});

test("blocks a missing deadline when no rolling window exists", () => {
  const decision = getAutomaticPublicationDecision({
    source_type: "public_web",
    source_priority: 1,
    confidence_score: 90,
    dedupe_key: "details:no-timing",
    review_reasons: ["missing_deadline"],
    opportunity: {
      application_url: null,
      listing_expires_at: null,
    },
  });

  assert.equal(decision.eligible, false);
  assert.ok(decision.reasons.includes("missing_deadline"));
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

test("makes an explicitly all-majors Outlook opportunity public", () => {
  const decision = getOpportunityVisibilityDecision({
    sourceType: "outlook_email",
    majorEligibilityType: "all",
    ownerUserId: "11111111-1111-4111-8111-111111111111",
  });

  assert.deepEqual(decision, {
    visibility: "public",
    ownerUserId: null,
    reasons: [],
  });
});

test("makes a restricted Outlook opportunity private to its owner", () => {
  const ownerUserId = "11111111-1111-4111-8111-111111111111";
  const decision = getOpportunityVisibilityDecision({
    sourceType: "outlook_email",
    majorEligibilityType: "specific",
    ownerUserId,
  });

  assert.equal(decision.visibility, "private");
  assert.equal(decision.ownerUserId, ownerUserId);
  assert.deepEqual(decision.reasons, []);
  assert.equal(
    scopeOpportunityDedupeKey("application:example", "private", ownerUserId),
    `private:${ownerUserId}:application:example`
  );
});

test("holds a private Outlook opportunity when its owner is missing", () => {
  const decision = getOpportunityVisibilityDecision({
    sourceType: "outlook_email",
    majorEligibilityType: "unknown",
    ownerUserId: "not-a-uuid",
  });

  assert.equal(decision.visibility, "private");
  assert.equal(decision.ownerUserId, null);
  assert.deepEqual(decision.reasons, ["missing_outlook_owner"]);
});
