import { createHash } from "node:crypto";
import { canonicalizeUrl } from "./urlUtils.js";

const AUTO_PUBLISH_BLOCKERS = new Set([
  "generic_title",
  "missing_organisation",
  "missing_source_url",
  "missing_deadline",
  "unclear_category",
]);

export const AUTO_PUBLISH_CONFIDENCE_THRESHOLDS = Object.freeze({
  NUS_PUBLIC: 75,
  EXTERNAL_PUBLIC: 95,
});

function getMinimumAutoPublishConfidence(sourcePriority) {
  return sourcePriority <= 1
    ? AUTO_PUBLISH_CONFIDENCE_THRESHOLDS.NUS_PUBLIC
    : AUTO_PUBLISH_CONFIDENCE_THRESHOLDS.EXTERNAL_PUBLIC;
}

function hashIdentity(value) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeIdentityText(value = "") {
  return value
    .toLowerCase()
    .replace(/^(?:applications?|registration)\s+(?:are\s+)?open\s*[:-]?\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value || ""
  );
}

export function getOpportunityVisibilityDecision({
  majorEligibilityType,
  ownerUserId,
  sourceType,
}) {
  if (sourceType !== "outlook_email") {
    return { visibility: "public", ownerUserId: null, reasons: [] };
  }

  if (majorEligibilityType === "all") {
    return { visibility: "public", ownerUserId: null, reasons: [] };
  }

  const validOwnerUserId = isUuid(ownerUserId) ? ownerUserId : null;

  return {
    visibility: "private",
    ownerUserId: validOwnerUserId,
    reasons: validOwnerUserId ? [] : ["missing_outlook_owner"],
  };
}

export function scopeOpportunityDedupeKey(dedupeKey, visibility, ownerUserId) {
  if (!dedupeKey || visibility !== "private") return dedupeKey;

  return `private:${ownerUserId || "unowned"}:${dedupeKey}`;
}

export function buildOpportunityDedupeKey(opportunity) {
  const title = normalizeIdentityText(opportunity.title);
  const organisation = normalizeIdentityText(opportunity.organisation);
  const applicationUrl = canonicalizeUrl(opportunity.application_url);
  const sourceUrl = canonicalizeUrl(opportunity.source_url);
  const deadlineDate = opportunity.deadline?.slice(0, 10) || "no-deadline";

  if (applicationUrl && title) {
    return `application:${hashIdentity(`${applicationUrl}|${title}`)}`;
  }

  if (title && organisation) {
    return `details:${hashIdentity(
      `${title}|${organisation}|${opportunity.category}|${deadlineDate}`
    )}`;
  }

  if (sourceUrl) {
    return `source:${hashIdentity(sourceUrl)}`;
  }

  return null;
}

export function getAutomaticPublicationDecision(candidate) {
  const reasons = [];
  const opportunity = candidate.opportunity || {};
  const confidenceScore = candidate.confidence_score ?? 0;
  const sourcePriority = candidate.source_priority ?? 99;
  const minimumConfidence = getMinimumAutoPublishConfidence(sourcePriority);

  if (candidate.source_type !== "public_web") {
    reasons.push("outlook_requires_privacy_review");
  }

  if (!candidate.dedupe_key) reasons.push("missing_dedupe_key");

  if (confidenceScore < minimumConfidence) {
    reasons.push(`confidence_below_${minimumConfidence}`);
  }

  for (const reason of candidate.review_reasons || []) {
    if (
      reason === "missing_deadline" &&
      opportunity.application_url &&
      opportunity.listing_expires_at
    ) {
      continue;
    }

    if (AUTO_PUBLISH_BLOCKERS.has(reason)) reasons.push(reason);
  }

  if (sourcePriority > 1 && !opportunity.application_url) {
    reasons.push("external_source_missing_application_url");
  }

  return {
    eligible: reasons.length === 0,
    reasons: [...new Set(reasons)],
    minimumConfidence,
  };
}
