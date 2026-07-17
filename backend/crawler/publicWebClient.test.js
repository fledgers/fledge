import assert from "node:assert/strict";
import test from "node:test";
import { fetchPublicWebSource } from "./publicWebClient.js";
import { crawlerSources } from "./sources.js";

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

test("reports an Incapsula response as website protection", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      `
        <html>
          <body>
            <iframe src="/_Incapsula_Resource?${"x".repeat(700)}">
              Request unsuccessful. Incapsula incident ID: 123456
            </iframe>
          </body>
        </html>
      `,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );

  try {
    await assert.rejects(
      fetchPublicWebSource({
        id: "protected-source",
        name: "Protected Source",
        school: "nus",
        url: "https://example.edu/opportunity",
        allowedHosts: ["example.edu"],
        maxLinkedPages: 0,
      }),
      /Blocked by website protection/
    );
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

test("does not treat programme-guide navigation as an application link", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      `
        <html>
          <head><title>STEER</title></head>
          <body>
            <nav>
              <a href="/gro/global-programmes/summer-and-winter-programmes/i-sp-application-guide">
                Applying for Summer and Winter Programmes
              </a>
            </nav>
            <h1>Study Trips For Engagement & EnRichment (STEER)</h1>
          </body>
        </html>
      `,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );

  try {
    const documents = await fetchPublicWebSource({
      id: "navigation-link-source",
      name: "Navigation Link Source",
      school: "nus",
      url: "https://example.edu/steer",
      allowedHosts: ["example.edu"],
      maxLinkedPages: 0,
    });

    assert.equal(documents.length, 1);
    assert.equal(documents[0].applicationUrl, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("configures the STEER landing page as a specific-PDF directory", () => {
  const source = crawlerSources.find(({ id }) => id === "nus-gro-steer");

  assert.ok(source);
  assert.equal(source.createRootDocument, false);
  assert.deepEqual(source.linkedDocumentTypes, ["pdf"]);
  assert.equal(source.programmeDetails, true);
});
