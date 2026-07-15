import assert from "node:assert/strict";
import test from "node:test";
import { listRecentMessages, searchMessages } from "./outlookClient.js";

test("asks Microsoft Graph for immutable Outlook message IDs", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];

  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    return new Response(JSON.stringify({ value: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  try {
    await listRecentMessages("access-token");
    await searchMessages("access-token", "hackathon");

    assert.equal(requests.length, 2);
    assert.equal(requests[0].options.headers.Prefer, 'IdType="ImmutableId"');
    assert.equal(requests[1].options.headers.Prefer, 'IdType="ImmutableId"');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
