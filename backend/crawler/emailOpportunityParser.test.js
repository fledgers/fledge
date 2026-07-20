import assert from "node:assert/strict";
import test from "node:test";
import {
  assessNusStudentEligibility,
  parseEmailToOpportunityCandidate,
  parseWebDocumentToOpportunityCandidate,
} from "./emailOpportunityParser.js";

test("accepts general university-student eligibility without requiring NUS wording", () => {
  const assessment = assessNusStudentEligibility(
    "Applications are open to undergraduate university students.",
    { sourceUrl: "https://example.org/competition" }
  );

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.scope, "student");
});

test("accepts university year and age ranges when no school is named", () => {
  const yearAssessment = assessNusStudentEligibility(
    "Applicants must be in Year 2 to Year 4.",
    { sourceUrl: "https://example.org/programme" }
  );
  const ageAssessment = assessNusStudentEligibility(
    "Applicants must be aged 18 to 25.",
    { sourceUrl: "https://example.org/programme" }
  );

  assert.equal(yearAssessment.eligible, true);
  assert.equal(yearAssessment.scope, "university_year");
  assert.equal(ageAssessment.eligible, true);
  assert.equal(ageAssessment.scope, "university_age");
});

test("rejects a foreign country-only restriction even with broad student wording", () => {
  const assessment = assessNusStudentEligibility(
    "Open to university students. American university students only.",
    { sourceUrl: "https://example.edu/competition" }
  );

  assert.equal(assessment.eligible, false);
  assert.equal(assessment.scope, "foreign_only");
  assert.equal(assessment.hostCountry, "United States");
});

test("uses an overseas host country to interpret domestic-only eligibility", () => {
  const assessment = assessNusStudentEligibility(
    "Applications are open to domestic university students only.",
    { sourceUrl: "https://fudan.edu.cn/programme" }
  );

  assert.equal(assessment.eligible, false);
  assert.equal(assessment.scope, "foreign_only");
  assert.equal(assessment.hostCountry, "China");
});

test("accepts worldwide applications from an overseas host", () => {
  const assessment = assessNusStudentEligibility(
    "International students welcome. Teams from around the world may apply.",
    { sourceUrl: "https://competition.igem.org/apply" }
  );

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.scope, "global");
});

test("does not treat a Singapore-only student rule as a foreign restriction", () => {
  const assessment = assessNusStudentEligibility(
    "Open to Singapore university students only.",
    { sourceUrl: "https://example.sg/programme" }
  );

  assert.equal(assessment.eligible, true);
  assert.equal(assessment.hostCountry, "Singapore");
});

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
    {
      sourcePriority: 1,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    }
  );

  assert.ok(candidate);
  assert.equal(candidate.source_message_id, "<stable-message-id@example.edu>");
  assert.equal(candidate.opportunity.major_eligibility_type, "all");
  assert.equal(candidate.visibility, "public");
  assert.equal(candidate.owner_user_id, null);
  assert.equal(candidate.opportunity.deadline_source, "nus");
});

test("scopes Outlook source identities to the consenting mailbox", () => {
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "graph-id",
      internetMessageId: "<shared-message@example.edu>",
      subject: "Applications open: student competition",
      from: { emailAddress: { address: "office@nus.edu.sg" } },
      receivedDateTime: "2026-07-15T08:00:00Z",
      body: {
        contentType: "text",
        content: "Open to NUS students. Apply by 30 Aug 2026 at https://example.edu/apply",
      },
      webLink: "https://outlook.office.com/mail/graph-id",
    },
    {
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      sourceIdentityPrefix: "11111111-1111-4111-8111-111111111111",
      sourcePriority: 0,
    }
  );

  assert.equal(
    candidate.source_message_id,
    "11111111-1111-4111-8111-111111111111:<shared-message@example.edu>"
  );
  assert.equal(
    candidate.opportunity.mailbox_owner_user_id,
    "11111111-1111-4111-8111-111111111111"
  );
  assert.equal(candidate.source_url, null);
  assert.equal(candidate.application_url, "https://example.edu/apply");
});

test("separates Outlook information and application links", () => {
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "message-with-two-links",
      subject: "Applications open for Student Innovation Challenge",
      from: { emailAddress: { address: "office@nus.edu.sg" } },
      receivedDateTime: "2026-07-15T08:00:00Z",
      body: {
        contentType: "text",
        content: `
          Open to all NUS students. Deadline: 30 August 2026.
          Read more at https://example.edu/student-innovation-challenge.
          Apply at https://forms.gle/example.
        `,
      },
    },
    {
      ownerUserId: "11111111-1111-4111-8111-111111111111",
      sourcePriority: 0,
    }
  );

  assert.equal(
    candidate.source_url,
    "https://example.edu/student-innovation-challenge"
  );
  assert.equal(candidate.application_url, "https://forms.gle/example");
});

test("keeps a major-restricted Outlook opportunity private to the mailbox owner", () => {
  const ownerUserId = "11111111-1111-4111-8111-111111111111";
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "restricted-message",
      subject: "Applications open for Computing Research Attachment",
      from: {
        emailAddress: {
          name: "NUS Computing",
          address: "computing@nus.edu.sg",
        },
      },
      receivedDateTime: "2026-07-15T01:00:00Z",
      bodyPreview:
        "For NUS students. Open to Computer Science students only. Deadline: 30 August 2026.",
      body: {
        contentType: "text",
        content:
          "For NUS students. Open to Computer Science students only. Deadline: 30 August 2026. Apply at https://example.edu/apply.",
      },
      webLink: "https://outlook.office.com/mail/restricted-message",
    },
    { sourcePriority: 0, ownerUserId }
  );

  assert.ok(candidate);
  assert.equal(candidate.opportunity.major_eligibility_type, "specific");
  assert.deepEqual(candidate.opportunity.eligible_majors, ["computer_science"]);
  assert.equal(candidate.visibility, "private");
  assert.equal(candidate.owner_user_id, ownerUserId);
  assert.ok(candidate.dedupe_key.startsWith(`private:${ownerUserId}:`));
});

test("does not treat a student's interest as an explicit major restriction", () => {
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "interest-message",
      subject: "Applications open for a Summer Data Programme",
      from: {
        emailAddress: {
          name: "NUS Data Club",
          address: "data@nus.edu.sg",
        },
      },
      receivedDateTime: "2026-07-15T01:00:00Z",
      body: {
        contentType: "text",
        content:
          "For NUS students interested in data analytics. Deadline: 30 August 2026. Apply at https://example.edu/apply.",
      },
    },
    {
      sourcePriority: 0,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    }
  );

  assert.ok(candidate);
  assert.equal(candidate.opportunity.major_eligibility_type, "unknown");
  assert.equal(candidate.visibility, "private");
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
  assert.equal(candidate.opportunity.deadline_source, "nus");
  assert.equal(candidate.opportunity.year_min, null);
  assert.equal(candidate.opportunity.year_max, null);
  assert.deepEqual(candidate.opportunity.eligible_majors, []);
  assert.match(candidate.opportunity.eligibility, /generic eligibility requirements/i);
  assert.equal(candidate.content_hash.length, 64);
  assert.equal(candidate.opportunity.content_hash, candidate.content_hash);
  assert.ok(candidate.review_reasons.includes("missing_application_url"));
  assert.ok(candidate.review_reasons.includes("missing_source_published_at"));
});

test("keeps a summer session in the summer-programme category", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "nus-gro-summer-partner-universities:waseda",
    school: "nus",
    sourceId: "nus-gro-summer-partner-universities",
    sourceName: "NUS Global Relations - Summer Partner Universities",
    url: "https://nus.edu.sg/gro/docs/waseda-summer-session.pdf",
    title: "Waseda Summer Session",
    summary: "",
    text: `
      Waseda Summer Session
      Programme Location: Tokyo, Japan
      Programme Dates: 13 June to 22 July 2026
      Application Deadline: 30 April 2026
      Scholarship and financial-aid information is available separately.
      Open to NUS undergraduate students.
    `,
    documentFormat: "pdf",
    programmeDetails: true,
    defaultCategory: "summer_programme",
    minScore: 3,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    requiresNusStudentEligibility: true,
    trustedForNusStudents: true,
    fetchedAt: "2026-07-20T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.category, "summer_programme");
});

test("parses a STEER PDF as one specific trip with its own details URL", () => {
  const sourceUrl =
    "https://nus.edu.sg/gro/docs/default-source/prog/steer/steer-mumbai-and-agra.pdf";
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: `nus-gro-steer:${sourceUrl}`,
    school: "nus",
    sourceId: "nus-gro-steer",
    sourceName:
      "NUS Global Relations - Study Trips for Engagement and EnRichment",
    url: sourceUrl,
    title: "STEER India: Mumbai & Agra",
    summary: "",
    text: `
      Study Trips for Engagement and EnRichment (STEER)
      STEER India: Mumbai & Agra
      Programme Location: Mumbai and Agra, India
      Programme Dates: 22 July to 1 August 2026
      Application Deadline: 2 July 2026 (Extended)
      All participants must be full-time NUS undergraduate students, be at
      least 18 years old, and participate in the whole programme.
      Application Process: Apply via EduRec Global Education, Setup ID 03942.
    `,
    documentFormat: "pdf",
    programmeDetails: true,
    defaultCategory: "exchange",
    minScore: 3,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    requiresNusStudentEligibility: true,
    trustedForNusStudents: true,
    fetchedAt: "2026-06-20T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.title, "STEER India: Mumbai & Agra");
  assert.equal(
    candidate.opportunity.organisation,
    "NUS Global Relations - Study Trips for Engagement and EnRichment"
  );
  assert.equal(candidate.opportunity.location, "Mumbai and Agra, India");
  assert.equal(candidate.opportunity.deadline, "2026-07-02T00:00:00.000Z");
  assert.equal(candidate.opportunity.deadline_source, "nus");
  assert.equal(candidate.opportunity.source_url, sourceUrl);
  assert.equal(candidate.opportunity.application_url, null);
  assert.match(candidate.opportunity.description, /Mumbai and Agra, India/);
  assert.doesNotMatch(candidate.opportunity.description, /Applying for Summer/i);
  assert.match(candidate.opportunity.eligibility, /full-time NUS undergraduate/i);
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
  assert.equal(candidate.opportunity.deadline_source, "organiser");
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
  assert.equal(candidate.opportunity.deadline_source, "organiser");
});

test("treats a deadline in an external Outlook email as an organiser deadline", () => {
  const candidate = parseEmailToOpportunityCandidate(
    {
      id: "external-organiser-message",
      subject: "Global Student Innovation Competition Applications",
      from: {
        emailAddress: {
          name: "Global Innovation Foundation",
          address: "competitions@global-innovation.example",
        },
      },
      receivedDateTime: "2026-07-15T01:00:00Z",
      body: {
        contentType: "text",
        content:
          "Open to university students worldwide. Deadline: 30 August 2026. Apply at https://global-innovation.example/apply.",
      },
    },
    {
      sourcePriority: 0,
      ownerUserId: "11111111-1111-4111-8111-111111111111",
    }
  );

  assert.ok(candidate);
  assert.equal(candidate.opportunity.deadline_source, "organiser");
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

test("rejects support and directory pages even when navigation contains application data", () => {
  const pages = [
    ["FAQ - NUS Enterprise", "https://enterprise.nus.edu.sg/education-programmes/nus-overseas-colleges/apply/faq/"],
    ["NUS Overseas Colleges Template - NUS Enterprise", "https://enterprise.nus.edu.sg/menu-templates/nus-overseas-colleges-template/"],
    ["Application Info - NUS Enterprise", "https://enterprise.nus.edu.sg/education-programmes/nus-overseas-colleges/apply/application-info/"],
    ["Partner Universities For Exchange", "https://www.nus.edu.sg/gro/global-programmes/student-exchange/partner-universities"],
    ["Returning Exchange Students", "https://www.nus.edu.sg/gro/global-programmes/student-exchange/returning-exchangers"],
    ["Student Exchange Programme", "https://www.nus.edu.sg/gro/global-programmes/student-exchange"],
  ];

  for (const [title, url] of pages) {
    const candidate = parseWebDocumentToOpportunityCandidate({
      id: `informational:${url}`,
      school: "nus",
      sourceId: "informational",
      sourceName: "NUS",
      url,
      title,
      summary: "Information for NUS students.",
      text: `
        Information for NUS students.
        Navigation: applications are open until 30 August 2026.
        Apply at https://example.edu/apply.
      `,
      defaultCategory: "exchange",
      minScore: 1,
      sourcePriority: 1,
      sourceTrustBoost: 3,
      trustedForNusStudents: true,
      fetchedAt: "2026-07-18T00:00:00.000Z",
    });

    assert.equal(candidate, null, `${title} should not become an opportunity`);
  }
});

test("keeps a specific NOC intake while rejecting NOC support pages", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "nus-noc-2027-intake",
    school: "nus",
    sourceId: "nus-enterprise-noc",
    sourceName: "NUS Enterprise",
    url: "https://enterprise.nus.edu.sg/education-programmes/nus-overseas-colleges/",
    title: "NUS Overseas Colleges 2027 Intake",
    summary: "Applications are open for the 2027 NOC intake.",
    text: `
      Applications are open to all NUS students for the 2027 NOC intake.
      All majors and all years are welcome.
      Application deadline: 30 August 2026.
      Apply at https://enterprise.nus.edu.sg/noc-2027-application.
    `,
    defaultCategory: "entrepreneurship",
    minScore: 1,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    trustedForNusStudents: true,
    fetchedAt: "2026-07-18T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.title, "NUS Overseas Colleges 2027 Intake");
});

test("keeps an undated application for a fixed 60-day rolling window", () => {
  const candidate = parseWebDocumentToOpportunityCandidate({
    id: "rolling-student-incubator",
    school: "nus",
    sourceId: "rolling-student-incubator",
    sourceName: "NUS Enterprise",
    url: "https://enterprise.nus.edu.sg/rolling-incubator",
    title: "NUS Student Founder Incubator Applications",
    summary: "Applications are accepted on a rolling basis.",
    text: `
      NUS Student Founder Incubator applications are accepted on a rolling basis.
      Open to all NUS students from all majors and all years.
      Apply at https://apply.example.edu/student-incubator.
    `,
    defaultCategory: "entrepreneurship",
    minScore: 1,
    sourcePriority: 1,
    sourceTrustBoost: 3,
    trustedForNusStudents: true,
    publishedAt: "2026-07-15T00:00:00.000Z",
    fetchedAt: "2026-07-15T00:00:00.000Z",
  });

  assert.ok(candidate);
  assert.equal(candidate.opportunity.deadline, null);
  assert.equal(
    candidate.opportunity.application_url,
    "https://apply.example.edu/student-incubator"
  );
  assert.equal(
    candidate.opportunity.listing_expires_at,
    "2026-09-13T00:00:00.000Z"
  );
  assert.ok(candidate.review_reasons.includes("missing_deadline"));
});
