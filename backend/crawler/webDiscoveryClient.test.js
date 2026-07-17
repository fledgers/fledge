import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverPublicWebDocuments,
  isWebDiscoveryConfigured,
} from "./webDiscoveryClient.js";

test("reports whether broad web discovery has an API key", () => {
  assert.equal(isWebDiscoveryConfigured({}), false);
  assert.equal(isWebDiscoveryConfigured({ TAVILY_API_KEY: "  " }), false);
  assert.equal(isWebDiscoveryConfigured({ TAVILY_API_KEY: "tvly-test" }), true);
});

test("turns search results into deduplicated external web documents", async () => {
  const queryResults = [];
  const fetchImpl = async (_url, options) => {
    const { query } = JSON.parse(options.body);

    return new Response(
      JSON.stringify({
        results: [
          {
            title: "Applications open for Student Challenge",
            url: "https://example.org/apply?utm_source=search",
            content:
              "Singapore university students may apply. Deadline 30 August 2026.",
            raw_content:
              "Applications are open to Singapore university students. Deadline 30 August 2026.",
            score: query === "first query" ? 0.8 : 0.9,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  };

  const documents = await discoverPublicWebDocuments({
    apiKey: "tvly-test",
    fetchImpl,
    queries: ["first query", "second query"],
    onQueryResult: (result) => queryResults.push(result),
  });

  assert.equal(documents.length, 1);
  assert.equal(documents[0].url, "https://example.org/apply");
  assert.equal(documents[0].detailsUrl, null);
  assert.equal(documents[0].applicationUrl, "https://example.org/apply");
  assert.equal(documents[0].sourcePriority, 4);
  assert.equal(documents[0].discoveryQuery, "second query");
  assert.equal(queryResults.length, 2);
});

test("uses an information URL from a direct form search result", async () => {
  const fetchImpl = async () =>
    new Response(
      JSON.stringify({
        results: [
          {
            title: "Application for Student Scholarship",
            url: "https://form.gov.sg/example",
            content:
              "For more information, visit https://example.gov.sg/scholarships/student-award",
            raw_content:
              "Apply using this form. Official details: https://example.gov.sg/scholarships/student-award",
            score: 0.9,
          },
        ],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );

  const documents = await discoverPublicWebDocuments({
    apiKey: "tvly-test",
    fetchImpl,
    queries: ["student scholarship"],
  });

  assert.equal(documents[0].url, "https://form.gov.sg/example");
  assert.equal(
    documents[0].detailsUrl,
    "https://example.gov.sg/scholarships/student-award"
  );
  assert.equal(documents[0].applicationUrl, "https://form.gov.sg/example");
});

test("records a failed query and continues searching", async () => {
  const queryResults = [];
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    if (requestCount === 1) {
      return new Response(JSON.stringify({ detail: "temporary error" }), {
        status: 503,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const documents = await discoverPublicWebDocuments({
    apiKey: "tvly-test",
    fetchImpl,
    queries: ["failing query", "working query"],
    onQueryResult: (result) => queryResults.push(result),
  });

  assert.deepEqual(documents, []);
  assert.equal(queryResults[0].status, "failed");
  assert.equal(queryResults[1].status, "completed");
});
