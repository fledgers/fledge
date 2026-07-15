import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicWebSource } from "./publicWebClient.js";

test("uses a canonical URL for repeated web-page identities", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      "<html><head><title>Student Competition</title></head><body>Applications open.</body></html>",
      { status: 200, headers: { "Content-Type": "text/html" } }
    );

  try {
    const documents = await fetchPublicWebSource({
      id: "example-source",
      name: "Example Source",
      school: "nus",
      url: "https://EXAMPLE.edu/opportunity?utm_source=email&b=2&a=1#apply",
      allowedHosts: ["example.edu"],
      maxLinkedPages: 0,
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].url, "https://example.edu/opportunity?a=1&b=2");
    assert.equal(
      documents[0].id,
      "example-source:https://example.edu/opportunity?a=1&b=2"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("retries a temporary web failure before skipping the source", async () => {
  const originalFetch = globalThis.fetch;
  let requestCount = 0;

  globalThis.fetch = async () => {
    requestCount += 1;

    if (requestCount === 1) {
      return new Response("Temporarily unavailable", { status: 503 });
    }

    return new Response(
      "<html><head><title>Research Programme</title></head><body>Applications open.</body></html>",
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  };

  try {
    const documents = await fetchPublicWebSource({
      id: "retry-source",
      name: "Retry Source",
      school: "nus",
      url: "https://example.edu/research",
      allowedHosts: ["example.edu"],
      maxLinkedPages: 0,
      maxRetries: 1,
      retryDelayMs: 0,
    });

    assert.equal(requestCount, 2);
    assert.equal(documents.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("discovers a specific opportunity through a relevant depth-two link", async () => {
  const originalFetch = globalThis.fetch;
  const pages = new Map([
    [
      "https://example.edu/",
      '<a href="/research-programmes">Research programmes</a>',
    ],
    [
      "https://example.edu/research-programmes",
      '<a href="/research-programmes/apply">Apply for research attachment</a>',
    ],
    [
      "https://example.edu/research-programmes/apply",
      "<h1>Research Attachment 2026</h1><p>Applications open to university students.</p>",
    ],
  ]);

  globalThis.fetch = async (url) =>
    new Response(pages.get(String(url)) || "Not found", {
      status: pages.has(String(url)) ? 200 : 404,
      headers: { "Content-Type": "text/html" },
    });

  try {
    const documents = await fetchPublicWebSource({
      id: "depth-two-source",
      name: "Depth Two Source",
      school: "nus",
      url: "https://example.edu/",
      allowedHosts: ["example.edu"],
      maxDepth: 2,
      maxLinkedPages: 2,
      requestDelayMs: 0,
    });

    assert.equal(documents.length, 3);
    assert.equal(
      documents[2].url,
      "https://example.edu/research-programmes/apply"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
