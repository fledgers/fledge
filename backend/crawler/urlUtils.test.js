import assert from "node:assert/strict";
import test from "node:test";
import {
  isLikelyApplicationUrl,
  resolveOpportunityUrls,
} from "./urlUtils.js";

test("recognises common hosted application forms", () => {
  assert.equal(
    isLikelyApplicationUrl("https://forms.gle/YBvyoyLFqQnzrp967"),
    true
  );
  assert.equal(
    isLikelyApplicationUrl("https://form.gov.sg/64abc123"),
    true
  );
  assert.equal(
    isLikelyApplicationUrl("https://example.edu/programmes/hackathon"),
    false
  );
});

test("keeps an information page separate from its application form", () => {
  assert.deepEqual(
    resolveOpportunityUrls({
      sourceUrl: "https://hackathon.csd.uoc.gr/",
      applicationUrl: "https://forms.gle/YBvyoyLFqQnzrp967",
      title: "FuturEd AI Hackathon 2026",
    }),
    {
      sourceUrl: "https://hackathon.csd.uoc.gr/",
      applicationUrl: "https://forms.gle/YBvyoyLFqQnzrp967",
    }
  );
});

test("replaces a direct application page with an information link from its content", () => {
  assert.deepEqual(
    resolveOpportunityUrls({
      sourceUrl: "https://form.gov.sg/64abc123",
      applicationUrl: "https://form.gov.sg/64abc123",
      text: `
        Apply for the SAF scholarship.
        For more information, visit
        https://www.mindef.gov.sg/join-us/scholarships-and-sponsorships/scholarships/
      `,
      title: "Application for MINDEF/SAF Scholarship",
    }),
    {
      sourceUrl:
        "https://www.mindef.gov.sg/join-us/scholarships-and-sponsorships/scholarships/",
      applicationUrl: "https://form.gov.sg/64abc123",
    }
  );
});

test("does not mislabel a form as an information page when no details page exists", () => {
  assert.deepEqual(
    resolveOpportunityUrls({
      sourceUrl: "https://forms.office.com/r/example",
      title: "Registration form",
    }),
    {
      sourceUrl: null,
      applicationUrl: "https://forms.office.com/r/example",
    }
  );
});
