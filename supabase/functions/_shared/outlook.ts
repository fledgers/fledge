export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "User.Read",
  "Mail.Read",
];

export function buildMicrosoftAuthorizationUrl({
  authorityTenant,
  clientId,
  codeChallenge,
  redirectUri,
  state,
}: {
  authorityTenant: string;
  clientId: string;
  codeChallenge: string;
  redirectUri: string;
  state: string;
}) {
  const url = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant)}/oauth2/v2.0/authorize`,
  );
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", OUTLOOK_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "consent");
  return url.toString();
}

export async function exchangeMicrosoftCode({
  authorityTenant,
  clientId,
  clientSecret,
  code,
  codeVerifier,
  redirectUri,
}: {
  authorityTenant: string;
  clientId: string;
  clientSecret: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
}) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant)}/oauth2/v2.0/token`;
  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      code_verifier: codeVerifier,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
      scope: OUTLOOK_SCOPES.join(" "),
    }),
  });
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Microsoft token exchange failed (${response.status}): ${body.error || "unknown_error"}`,
    );
  }

  return body as {
    access_token: string;
    refresh_token?: string;
    scope?: string;
  };
}

export async function getMicrosoftProfile(accessToken: string) {
  const response = await fetch(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Microsoft profile request failed (${response.status}).`,
    );
  }

  return body as {
    id: string;
    displayName?: string;
    mail?: string;
    userPrincipalName?: string;
  };
}
