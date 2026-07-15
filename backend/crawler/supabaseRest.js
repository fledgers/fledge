import { getRequiredEnv } from "./env.js";

function getSupabaseUrl(tableName) {
  const baseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  return `${baseUrl}/rest/v1/${tableName}`;
}

function getSupabaseHeaders({ prefer } = {}) {
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  // Supabase's current sb_secret keys must not be sent as Bearer tokens.
  // The legacy service_role key remains supported while existing projects migrate.
  if (secretKey) {
    return {
      apikey: secretKey,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    };
  }

  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
    ...(prefer ? { Prefer: prefer } : {}),
  };
}

async function readResponse(response, action) {
  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Supabase ${action} failed: ${response.status} ${JSON.stringify(body)}`);
  }

  return body;
}

export async function insertRows(tableName, rows) {
  if (!rows.length) return [];

  const response = await fetch(getSupabaseUrl(tableName), {
    method: "POST",
    headers: getSupabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(rows),
  });

  return readResponse(response, "insert");
}

export async function selectRows(tableName, query = {}) {
  const searchParams = new URLSearchParams(query);
  const response = await fetch(`${getSupabaseUrl(tableName)}?${searchParams}`, {
    headers: getSupabaseHeaders(),
  });

  return readResponse(response, "select");
}

export async function callRpc(functionName, parameters = {}) {
  const baseUrl = getRequiredEnv("SUPABASE_URL").replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/rest/v1/rpc/${functionName}`, {
    method: "POST",
    headers: getSupabaseHeaders({ prefer: "return=representation" }),
    body: JSON.stringify(parameters),
  });

  return readResponse(response, "RPC call");
}
