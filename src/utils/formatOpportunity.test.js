import assert from "node:assert/strict";
import test from "node:test";
import {
  formatOpportunity,
  getEligibilityWarning,
  getOpportunityExpiryTime,
  isExpiredOpportunityRetained,
  isOpportunityExpired,
} from "./formatOpportunity.js";

test("shows explicitly zoned deadlines in Singapore time", () => {
  const opportunity = formatOpportunity({
    id: "timezone-test",
    title: "International Design Competition",
    description: "",
    category: "competition",
    organisation: "Example University",
    source_url: "https://example.edu/design",
    application_url: "https://apply.example.edu/design",
    source_published_at: "2026-07-01T13:00:00.000Z",
    last_seen_at: "2026-07-14T00:00:00.000Z",
    confidence_score: 100,
    deadline: "2026-10-19T03:59:00.000Z",
    deadline_has_time: true,
    deadline_source_timezone: "EDT",
  });

  assert.match(opportunity.deadlineLabel, /(Oct 19|19 Oct)/);
  assert.match(opportunity.deadlineLabel, /11:59/);
  assert.match(opportunity.deadlineLabel, /SGT$/);
  assert.equal(opportunity.source_url, "https://example.edu/design");
  assert.equal(opportunity.application_url, "https://apply.example.edu/design");
  assert.equal(opportunity.confidence_score, 100);
});

test("warns when a source gives a time without a timezone", () => {
  const opportunity = formatOpportunity({
    id: "timezone-not-stated",
    title: "Global Student Competition",
    description: "",
    category: "competition",
    organisation: "Example University",
    deadline: "2026-10-18T00:00:00.000Z",
    deadline_has_time: true,
    deadline_source_text: "18 October 2026 at 11:59 PM",
  });

  assert.match(opportunity.deadlineLabel, /time zone not stated/i);
});

test("labels an undated application as rolling", () => {
  const opportunity = formatOpportunity({
    id: "rolling-application",
    title: "Student Founder Incubator",
    description: "",
    category: "entrepreneurship",
    organisation: "NUS Enterprise",
    application_url: "https://example.edu/apply",
    deadline: null,
    listing_expires_at: "2026-09-13T00:00:00.000Z",
  });

  assert.equal(opportunity.deadlineLabel, "Rolling applications");
  assert.equal(
    opportunity.listing_expires_at,
    "2026-09-13T00:00:00.000Z"
  );
});

test("expires a date-only deadline after the Singapore calendar day", () => {
  const opportunity = {
    deadline: "2026-07-16T00:00:00.000Z",
    deadline_has_time: false,
  };

  assert.equal(
    getOpportunityExpiryTime(opportunity),
    new Date("2026-07-16T23:59:59.999+08:00").getTime()
  );
  assert.equal(
    isOpportunityExpired(
      opportunity,
      new Date("2026-07-16T16:00:00.000Z").getTime()
    ),
    true
  );
});

test("retains an expired saved opportunity for only 15 days", () => {
  const opportunity = {
    deadline: "2026-07-16T00:00:00.000Z",
    deadline_has_time: false,
  };

  assert.equal(
    isExpiredOpportunityRetained(
      opportunity,
      new Date("2026-07-30T15:59:59.999Z").getTime()
    ),
    true
  );
  assert.equal(
    isExpiredOpportunityRetained(
      opportunity,
      new Date("2026-07-31T16:00:00.000Z").getTime()
    ),
    false
  );
});

test("warns students when major and year eligibility are unknown", () => {
  const opportunity = formatOpportunity({
    id: "unknown-eligibility",
    title: "Student Innovation Programme",
    description: "",
    category: "competition",
    organisation: "Example Organisation",
    deadline: "2026-10-18T00:00:00.000Z",
    major_eligibility_type: "unknown",
    year_eligibility_type: "unknown",
  });

  assert.equal(opportunity.badge, "Check eligibility");
  assert.equal(opportunity.yearTag, "👤 Check year eligibility");
  assert.match(opportunity.eligibilityWarning, /official source/i);
});

test("creates a focused warning when only year eligibility is unclear", () => {
  assert.equal(
    getEligibilityWarning({
      major_eligibility_type: "all",
      year_eligibility_type: "inferred",
    }),
    "Year eligibility is not clearly stated. Check it on the official source before applying."
  );
});
