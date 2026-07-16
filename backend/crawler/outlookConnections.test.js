import assert from "node:assert/strict";
import test from "node:test";
import {
  getLegacyOutlookConnection,
  loadCrawlerOutlookConnections,
  recordOutlookCrawlResult,
} from "./outlookConnections.js";

test("uses all Vault-backed Outlook connections for a saved crawl", async () => {
  const connections = [
    { user_id: "user-1", refresh_token: "token-1" },
    { user_id: "user-2", refresh_token: "token-2" },
  ];
  const result = await loadCrawlerOutlookConnections({
    saveToSupabase: true,
    rpc: async name => {
      assert.equal(name, "list_outlook_connections_for_crawler");
      return connections;
    },
    environment: {},
  });

  assert.deepEqual(result, connections);
});

test("keeps the single-mailbox environment token as a development fallback", () => {
  assert.deepEqual(
    getLegacyOutlookConnection({
      OUTLOOK_OWNER_USER_ID: "owner-1",
      OUTLOOK_REFRESH_TOKEN: "refresh-1",
    }),
    {
      user_id: "owner-1",
      microsoft_account_id: "legacy-environment-mailbox",
      microsoft_email: null,
      refresh_token: "refresh-1",
      is_legacy: true,
    }
  );
});

test("does not use a legacy token for a saved hosted crawl", async () => {
  const result = await loadCrawlerOutlookConnections({
    saveToSupabase: true,
    rpc: async () => [],
    environment: {
      OUTLOOK_OWNER_USER_ID: "owner-1",
      OUTLOOK_REFRESH_TOKEN: "old-refresh-token",
    },
  });

  assert.deepEqual(result, []);
});

test("records rotated tokens and crawl failures without exposing tokens to clients", async () => {
  let parameters;
  await recordOutlookCrawlResult({
    connection: { user_id: "user-1" },
    error: new Error("Microsoft temporarily unavailable"),
    refreshToken: "rotated-token",
    rpc: async (name, values) => {
      assert.equal(name, "record_outlook_crawl_result");
      parameters = values;
    },
  });

  assert.deepEqual(parameters, {
    connection_user_id: "user-1",
    replacement_refresh_token: "rotated-token",
    crawl_error: "Microsoft temporarily unavailable",
  });
});
