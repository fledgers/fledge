import assert from "node:assert/strict";
import test from "node:test";
import {
  parseEmailToOpportunityCandidate,
  parseWebDocumentToOpportunityCandidate,
} from "./emailOpportunityParser.js";

test("uses the internet message ID as the stable Outlook source identity", () => {
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "graph-folder-dependent-id",
      internetMessageId: "<stable-message-id@example.edu>",
      subject: "Applications open for NUS Student Innovation Competition",
      from: {
        emailAddress: {
          name: "NUS Enterprise",
          address: "enterprise@nus.edu.sg",
        },
      },
      receivedDateTime: "2026-07-15T01:00:00Z",
      bodyPreview: "Open to all NUS students. Deadline: 30 August 2026.",
      body: {
        contentType: "text",
        content:
          "Open to all NUS students. Deadline: 30 August 2026. Apply at https://example.edu/apply.",
      },
      webLink: "https://outlook.office.com/mail/message",
    },
    { sourcePriority: 1 }
  );

  assert.ok(candidate);
  assert.equal(candidate.source_message_id, "<stable-message-id@example.edu>");
});

test("rejects sources that explicitly say applications are closed", () => {
  const candidate = parseEmailToOpportunityCandidate({
    id: "closed-message",
    subject: "Student Innovation Competition",
    from: {
      emailAddress: {
        name: "NUS Enterprise",
        address: "enterprise@nus.edu.sg",
      },
    },
    receivedDateTime: "2026-07-15T01:00:00Z",
    bodyPreview: "Applications are closed.",
    body: {
      contentType: "text",
      content: "Applications are closed. This competition was open to NUS students.",
    },
  });

  assert.equal(candidate, null);
});

test("parses an NUS partner winter-programme PDF as a specific opportunity", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "nus-gro-winter-partner-universities:hanyang",
    school: "nus",
    sourceId: "nus-gro-winter-partner-universities",
    sourceName: "NUS Global Relations - Winter Partner Universities",
    url: "https://nus.edu.sg/gro/docs/default-source/prog/isp/kr/swp_hanyang_winter.pdf",
    title: "Hanyang University International Winter School (Session A)",
    summary: "",
    text: `
      SUMMER/WINTER PROGRAMMES (SWP)
      Hanyang University International Winter School (Session A)
      Host University Website: https://hanyangwinter.com
      Programme Location: Seoul, South Korea
      Programme Dates: 26 December 2026 to 9 January 2027
      Application Period: 1 September to 18 October 2026
      No. of Placements: To be determined by host university
      Information on this page is for on-site programme only.
      NUS generic eligibility requirements apply. NUS students should apply for in-person course(s) if course mapping is needed.
      All majors / disciplines.
    `,
    documentFormat: "pdf",
    programmeDetails: true,
    defaultCategory: "winter_programme",
    minScore: 3,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    requiresNusStudentEligibility: true,
    trustedForNusStudents: true,
    fetchedAt: "2026-07-14T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.title, "Hanyang University International Winter School (Session A)");
  assert.equal(candidate.opportunity.organisation, "Hanyang University");
  assert.equal(candidate.opportunity.category, "winter_programme");
  assert.equal(candidate.opportunity.location, "Seoul, South Korea");
  assert.equal(candidate.opportunity.delivery_mode, "in_person");
  assert.equal(candidate.opportunity.deadline, "2026-10-18T00:00:00.000Z");
  assert.equal(candidate.opportunity.deadline_has_time, false);
  assert.equal(candidate.opportunity.deadline_source_timezone, null);
  assert.equal(candidate.opportunity.year_min, null);
  assert.equal(candidate.opportunity.year_max, null);
  assert.deepEqual(candidate.opportunity.eligible_majors, []);
  assert.match(candidate.opportunity.eligibility, /generic eligibility requirements/i);
  assert.equal(candidate.content_hash.length, 64);
  assert.equal(candidate.opportunity.content_hash, candidate.content_hash);
  assert.ok(candidate.review_reasons.includes("missing_application_url"));
  assert.ok(candidate.review_reasons.includes("missing_source_published_at"));
});

test("converts an explicitly zoned deadline into a UTC instant", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "external-programme",
    school: "nus",
    sourceId: "external-programme",
    sourceName: "Example University",
    url: "https://example.edu/programme",
    title: "International Design Competition",
    summary: "",
    text: "Application deadline: October 18, 2026 at 11:59 PM EDT. Open to all years and all NUS students. Apply here: https://apply.example.edu/design.",
    defaultCategory: "competition",
    minScore: 3,
    sourcePriority: 3,
    sourceTrustBoost: 0,
    requiresNusStudentEligibility: true,
    trustedForNusStudents: true,
    publishedAt: "2026-07-01T09:00:00-04:00",
    fetchedAt: "2026-07-14T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.deadline, "2026-10-19T03:59:00.000Z");
  assert.equal(candidate.opportunity.deadline_has_time, true);
  assert.equal(candidate.opportunity.deadline_source_timezone, "EDT");
  assert.equal(candidate.application_url, "https://apply.example.edu/design");
  assert.equal(candidate.source_published_at, "2026-07-01T13:00:00.000Z");
  assert.equal(candidate.last_seen_at, "2026-07-14T00:00:00.000Z");
  assert.equal(candidate.confidence_score, 100);
  assert.deepEqual(candidate.review_reasons, []);
  assert.equal(candidate.opportunity.major_eligibility_type, "all");
  assert.equal(candidate.opportunity.year_eligibility_type, "all");
  assert.ok(candidate.dedupe_key.startsWith("application:"));
  assert.equal(candidate.auto_publish_eligible, true);
});

test("does not assume Singapore time when the source omits a timezone", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "timezone-not-stated",
    school: "nus",
    sourceId: "timezone-not-stated",
    sourceName: "Example University",
    url: "https://example.edu/programme",
    title: "Global Student Competition",
    summary: "",
    text: "Deadline: 18 October 2026 at 11:59 PM. Open to all students.",
    defaultCategory: "competition",
    minScore: 3,
    sourcePriority: 3,
    sourceTrustBoost: 0,
    requiresNusStudentEligibility: true,
    trustedForNusStudents: true,
    fetchedAt: "2026-07-14T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.deadline, "2026-10-18T00:00:00.000Z");
  assert.equal(candidate.opportunity.deadline_has_time, true);
  assert.equal(candidate.opportunity.deadline_source_timezone, null);
});

test("rejects a general web directory with no deadline or application route", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "general-directory",
    school: "nus",
    sourceId: "general-directory",
    sourceName: "NUS Global Relations",
    url: "https://nus.edu.sg/global-programmes",
    title: "Global Programmes",
    summary: "Explore exchange, research and summer programmes.",
    text: "Explore exchange, research and summer programmes for NUS students.",
    defaultCategory: "exchange",
    minScore: 1,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    trustedForNusStudents: true,
    fetchedAt: "2026-07-15T00:00:00.000Z",
  });

  assert.equal(candidate, null);
});
