import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { getRequiredEnv, loadLocalEnv } from "./env.js";

const DEFAULT_REDIRECT_URI = "http://localhost:8787/callback";
const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.Read",
];

function toBase64Url(value) {
  return value
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function getAuthorityTenant() {
  return process.env.MICROSOFT_AUTHORITY_TENANT
    || process.env.MICROSOFT_TENANT_ID
    || "organizations";
}

export function createPkceValues() {
  const codeVerifier = toBase64Url(randomBytes(64));
  const codeChallenge = toBase64Url(
    createHash("sha256").update(codeVerifier).digest()
  );

  return { codeChallenge, codeVerifier };
}

export function buildOutlookAuthorizationUrl({
  authorityTenant,
  clientId,
  codeChallenge,
  redirectUri,
  state,
}) {
  const url = new URL(
    `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant)}/oauth2/v2.0/authorize`
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

async function readJsonResponse(response) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      `Microsoft token exchange failed: ${response.status} ${JSON.stringify(body)}`
    );
  }

  return body;
}

export async function exchangeAuthorizationCode({
  authorityTenant,
  clientId,
  clientSecret,
  code,
  codeVerifier,
  redirectUri,
}) {
  const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(authorityTenant)}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    code_verifier: codeVerifier,
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
    scope: OUTLOOK_SCOPES.join(" "),
  });
  const response = await fetch(tokenUrl, {
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });

  return readJsonResponse(response);
}

function writeBrowserResponse(response, statusCode, heading, message) {
  response.writeHead(statusCode, { "Content-Type": "text/html; charset=utf-8" });
  response.end(`<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>${heading}</title></head>
  <body style="font-family: sans-serif; margin: 48px; max-width: 620px">
    <h1>${heading}</h1>
    <p>${message}</p>
  </body>
</html>`);
}

export async function authorizeOutlookMailbox() {
  loadLocalEnv();

  const authorityTenant = getAuthorityTenant();
  const clientId = getRequiredEnv("MICROSOFT_CLIENT_ID");
  const clientSecret = getRequiredEnv("MICROSOFT_CLIENT_SECRET");
  const redirectUri = process.env.MICROSOFT_SETUP_REDIRECT_URI
    || DEFAULT_REDIRECT_URI;
  const callbackUrl = new URL(redirectUri);

  if (
    callbackUrl.protocol !== "http:"
    || !["127.0.0.1", "localhost"].includes(callbackUrl.hostname)
  ) {
    throw new Error(
      "MICROSOFT_SETUP_REDIRECT_URI must be a local HTTP URL for this setup command."
    );
  }

  const state = toBase64Url(randomBytes(32));
  const { codeChallenge, codeVerifier } = createPkceValues();
  const authorizationUrl = buildOutlookAuthorizationUrl({
    authorityTenant,
    clientId,
    codeChallenge,
    redirectUri,
    state,
  });

  const tokenResponse = await new Promise((resolve, reject) => {
    let settled = false;
    let server;
    let timeout;
    const finish = (handler, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (server?.listening) {
        server.close(() => handler(value));
      } else {
        handler(value);
      }
    };
    server = createServer(async (request, response) => {
      const requestUrl = new URL(request.url || "/", redirectUri);
      if (requestUrl.pathname !== callbackUrl.pathname) {
        writeBrowserResponse(response, 404, "Not found", "This is not the Outlook callback URL.");
        return;
      }

      const oauthError = requestUrl.searchParams.get("error");
      if (oauthError) {
        const description = requestUrl.searchParams.get("error_description")
          || oauthError;
        writeBrowserResponse(response, 400, "Outlook access was not granted", description);
        finish(reject, new Error(`Microsoft authorization failed: ${description}`));
        return;
      }

      if (requestUrl.searchParams.get("state") !== state) {
        writeBrowserResponse(response, 400, "Invalid authorization response", "The security state did not match.");
        finish(reject, new Error("Microsoft authorization returned an invalid state."));
        return;
      }

      const code = requestUrl.searchParams.get("code");
      if (!code) {
        writeBrowserResponse(response, 400, "Missing authorization code", "Microsoft did not return an authorization code.");
        finish(reject, new Error("Microsoft authorization returned no code."));
        return;
      }

      try {
        const tokens = await exchangeAuthorizationCode({
          authorityTenant,
          clientId,
          clientSecret,
          code,
          codeVerifier,
          redirectUri,
        });
        writeBrowserResponse(
          response,
          200,
          "Outlook connected",
          "Return to the terminal to finish the crawler setup. You can close this tab."
        );
        finish(resolve, tokens);
      } catch (error) {
        writeBrowserResponse(response, 500, "Token exchange failed", "Return to the terminal for the error details.");
        finish(reject, error);
      }
    });

    server.on("error", error => finish(reject, error));
    server.listen(Number(callbackUrl.port || 80), callbackUrl.hostname, () => {
      console.log("\nOpen this URL in your browser and sign in to the Outlook mailbox:\n");
      console.log(authorizationUrl);
      console.log("\nWaiting for Microsoft to redirect back to this command...\n");
    });

    timeout = setTimeout(() => {
      finish(reject, new Error("Outlook authorization timed out after 10 minutes."));
    }, 10 * 60 * 1000);
  });

  if (!tokenResponse.refresh_token) {
    throw new Error(
      "Microsoft returned no refresh token. Check that offline_access is allowed and grant consent again."
    );
  }

  console.log("Outlook authorization succeeded.");
  console.log("For legacy local testing, add this value to OUTLOOK_REFRESH_TOKEN in backend/.env:");
  console.log(`\n${tokenResponse.refresh_token}\n`);
  console.log("Keep this token private. Do not commit it to Git.");
}

const isDirectRun = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) {
  authorizeOutlookMailbox().catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
