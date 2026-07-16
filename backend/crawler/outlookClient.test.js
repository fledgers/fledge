import assert from "node:assert/strict";
import test from "node:test";
import {
  listRecentMessages,
  refreshOutlookAccessToken,
  searchMessages,
} from "./outlookClient.js";

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

test("returns a rotated refresh token when Microsoft supplies one", async () => {
  const originalFetch = globalThis.fetch;
  process.env.MICROSOFT_CLIENT_ID = "client";
  process.env.MICROSOFT_CLIENT_SECRET = "secret";

  globalThis.fetch = async () => new Response(JSON.stringify({
    access_token: "access-2",
    refresh_token: "refresh-2",
    expires_in: 3600,
  }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });

  try {
    assert.deepEqual(await refreshOutlookAccessToken("refresh-1"), {
      accessToken: "access-2",
      refreshToken: "refresh-2",
      expiresIn: 3600,
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
});
