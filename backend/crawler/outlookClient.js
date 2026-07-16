import { getRequiredEnv } from "./env.js";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const OUTLOOK_IMMUTABLE_ID_PREFERENCE = 'IdType="ImmutableId"';

function getTenantId() {
  return process.env.MICROSOFT_AUTHORITY_TENANT
    || process.env.MICROSOFT_TENANT_ID
    || "organizations";
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Microsoft Graph request failed: ${response.status} ${JSON.stringify(body)}`
    );
  }

  return body;
}

export async function refreshOutlookAccessToken(refreshToken) {
  const tenantId = getTenantId();
  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    client_id: getRequiredEnv("MICROSOFT_CLIENT_ID"),
    client_secret: getRequiredEnv("MICROSOFT_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const tokenResponse = await requestJson(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  return {
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || null,
    expiresIn: tokenResponse.expires_in || null,
  };
}

export async function getAccessTokenFromRefreshToken(refreshToken) {
  const tokenResult = await refreshOutlookAccessToken(refreshToken);
  return tokenResult.accessToken;
}

export async function listRecentMessages(accessToken, { top = 25 } = {}) {
  const url = new URL(`${GRAPH_BASE_URL}/me/messages`);
  url.searchParams.set("$top", String(top));
  url.searchParams.set(
    "$select",
    [
      "id",
      "internetMessageId",
      "subject",
      "from",
      "receivedDateTime",
      "bodyPreview",
      "body",
      "webLink",
    ].join(",")
  );
  url.searchParams.set("$orderby", "receivedDateTime desc");

  const response = await requestJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: OUTLOOK_IMMUTABLE_ID_PREFERENCE,
    },
  });

  return response.value || [];
}

export async function searchMessages(accessToken, searchText, { top = 25 } = {}) {
  const url = new URL(`${GRAPH_BASE_URL}/me/messages`);
  url.searchParams.set("$top", String(top));
  url.searchParams.set(
    "$select",
    [
      "id",
      "internetMessageId",
      "subject",
      "from",
      "receivedDateTime",
      "bodyPreview",
      "body",
      "webLink",
    ].join(",")
  );
  url.searchParams.set("$search", `"${searchText.replaceAll('"', "")}"`);

  const response = await requestJson(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Prefer: OUTLOOK_IMMUTABLE_ID_PREFERENCE,
    },
  });

  return response.value || [];
}
