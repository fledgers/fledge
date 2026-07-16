import { callRpc } from "./supabaseRest.js";

export function getLegacyOutlookConnection(environment = process.env) {
  if (!environment.OUTLOOK_REFRESH_TOKEN) return null;

  return {
    user_id: environment.OUTLOOK_OWNER_USER_ID || null,
    microsoft_account_id: "legacy-environment-mailbox",
    microsoft_email: null,
    refresh_token: environment.OUTLOOK_REFRESH_TOKEN,
    is_legacy: true,
  };
}

export async function loadCrawlerOutlookConnections({
  saveToSupabase,
  rpc = callRpc,
  environment = process.env,
} = {}) {
  if (saveToSupabase) {
    const storedConnections = await rpc("list_outlook_connections_for_crawler");
    return storedConnections;
  }

  const legacyConnection = getLegacyOutlookConnection(environment);
  return legacyConnection ? [legacyConnection] : [];
}

export async function recordOutlookCrawlResult({
  connection,
  error = null,
  refreshToken = null,
  rpc = callRpc,
}) {
  if (connection.is_legacy || !connection.user_id) return;

  await rpc("record_outlook_crawl_result", {
    connection_user_id: connection.user_id,
    replacement_refresh_token: refreshToken,
    crawl_error: error?.message || null,
  });
}
