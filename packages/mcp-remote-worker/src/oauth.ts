
export interface OAuthEnv {
  DB: D1Database;
  AUTH_KV: KVNamespace;
  OAUTH_SIGNING_SECRET: string;
  MCP_MAILBOX: string;
  MAIL_API_URL: string;
}

type SignedPayload = {
  typ: "code" | "access" | "refresh";
  iss: string;
  aud: string;
  sub: string;
  scope: string;
  client_id: string;
  redirect_uri?: string;
  code_challenge?: string;
  iat: number;
  exp: number;
  jti: string;
};

export const ISSUER = "https://mcp.jcllyuki.com";
export const RESOURCE = ISSUER;
export const MAIL_SCOPE = "mail.read";

const CHATGPT_CLIENT_ID = "https://chatgpt.com/oauth/client.json";
const CHATGPT_REDIRECT_URI = "https://chatgpt.com/connector_platform_oauth_redirect";
const ACCESS_TTL_SECONDS = 3600;
const REFRESH_TTL_SECONDS = 2592000;
const CODE_TTL_SECONDS = 300;
const TEXT = new TextEncoder();

function b64url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function unb64url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function hmacKey(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    TEXT.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

async function sign(payload: SignedPayload, secret: string) {
  const body = b64url(TEXT.encode(JSON.stringify(payload)));
  const key = await hmacKey(secret);
  const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, TEXT.encode(body)));
  return body + "." + b64url(signature);
}

async function verify(token: string, secret: string): Promise<SignedPayload | null> {
  try {
    const parts = token.split(".");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    const key = await hmacKey(secret);
    const ok = await crypto.subtle.verify("HMAC", key, unb64url(parts[1]), TEXT.encode(parts[0]));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(parts[0]))) as SignedPayload;
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

async function pkceS256(verifier: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", TEXT.encode(verifier)));
  return b64url(digest);
}

function bearer(request: Request) {
  const header = request.headers.get("authorization") || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

export function toolSecurity() {
  return [{ type: "oauth2" as const, scopes: [MAIL_SCOPE] }];
}

function authServerMetadata() {
  return {
    issuer: ISSUER,
    authorization_endpoint: ISSUER + "/oauth/authorize",
    token_endpoint: ISSUER + "/oauth/token",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [MAIL_SCOPE],
    token_endpoint_auth_methods_supported: ["none"],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
  };
}

function resourceMetadata() {
  return {
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [MAIL_SCOPE],
    resource_documentation: "https://jcllyuki.com",
  };
}

function challenge(error?: string, description?: string) {
  const parts = [
    'Bearer resource_metadata="' + ISSUER + '/.well-known/oauth-protected-resource"',
    'scope="' + MAIL_SCOPE + '"',
  ];
  if (error) parts.push('error="' + error + '"');
  if (description) parts.push('error_description="' + description.replace(/"/g, "'") + '"');
  return parts.join(", ");
}

export function oauthUnauthorized(
  error = "invalid_token",
  description = "Authentication is required",
) {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status: 401,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "www-authenticate": challenge(error, description),
      "cache-control": "no-store",
    },
  });
}

function oauthError(status: number, error: string, description: string) {
  return new Response(JSON.stringify({ error, error_description: description }), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function normalizeScope(scope: string) {
  const requested = new Set(scope.split(/\s+/).filter(Boolean));
  if (requested.size === 0) requested.add(MAIL_SCOPE);
  if (requested.size !== 1 || !requested.has(MAIL_SCOPE)) return null;
  return MAIL_SCOPE;
}

type AuthorizeParams =
  | { error: string }
  | {
      responseType: string;
      clientId: string;
      redirectUri: string;
      state: string;
      codeChallenge: string;
      scope: string;
      resource: string;
    };

function validateAuthorize(params: URLSearchParams): AuthorizeParams {
  const responseType = params.get("response_type") || "";
  const clientId = params.get("client_id") || "";
  const redirectUri = params.get("redirect_uri") || "";
  const state = params.get("state") || "";
  const codeChallenge = params.get("code_challenge") || "";
  const codeChallengeMethod = params.get("code_challenge_method") || "";
  const scope = normalizeScope(params.get("scope") || "");
  const resource = params.get("resource") || RESOURCE;

  if (responseType !== "code") return { error: "Unsupported response_type" };
  if (clientId !== CHATGPT_CLIENT_ID) return { error: "Only the ChatGPT OAuth client is allowed" };
  if (redirectUri !== CHATGPT_REDIRECT_URI) return { error: "Invalid redirect_uri" };
  if (!state) return { error: "Missing state" };
  if (!scope) return { error: "Unsupported scope" };
  if (!codeChallenge || codeChallengeMethod !== "S256") return { error: "PKCE S256 is required" };
  if (resource !== RESOURCE) return { error: "Invalid resource" };

  return { responseType, clientId, redirectUri, state, codeChallenge, scope, resource };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function authPage(env: OAuthEnv, params: AuthorizeParams, error = "") {
  if ("error" in params) return new Response("Invalid authorization request", { status: 400 });

  const hidden: Record<string, string> = {
    response_type: params.responseType,
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    state: params.state,
    code_challenge: params.codeChallenge,
    code_challenge_method: "S256",
    scope: params.scope,
    resource: params.resource,
  };

  const hiddenInputs = Object.entries(hidden)
    .map(function (entry) {
      return '<input type="hidden" name="' + escapeHtml(entry[0]) + '" value="' + escapeHtml(entry[1]) + '">';
    })
    .join("");

  const errorHtml = error
    ? '<div class="error" role="alert">' + escapeHtml(error) + "</div>"
    : "";

  const html =
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Connect Yuki Mail to ChatGPT</title><style>' +
    ':root{color-scheme:light;background:#f7f2ea;color:#332d29;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}' +
    '*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;background:#f7f2ea}' +
    '.card{width:min(440px,100%);background:#fffdf8;border:1px solid #dfd4c7;border-radius:18px;padding:28px;box-shadow:0 24px 70px rgba(73,54,43,.12)}' +
    '.brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}.mark{display:grid;place-items:center;width:40px;height:40px;border-radius:12px;border:1px solid #d8c7b8;color:#a3583f;font-size:20px}' +
    'h1{font-size:22px;margin:0}.tag{margin:4px 0 0;color:#7a6e66;font-size:13px}.copy{color:#5f554f;line-height:1.55;font-size:14px;margin:0 0 18px}' +
    'label{display:grid;gap:7px;margin:13px 0;font-size:13px;font-weight:600}.input{width:100%;border:1px solid #d8cec3;border-radius:10px;background:#fffdf8;padding:11px 12px;font:inherit;color:#332d29;outline:none}.input:focus{border-color:#a3583f;box-shadow:0 0 0 3px rgba(163,88,63,.12)}' +
    '.readonly{background:#f4eee6;color:#74685f}.button{width:100%;margin-top:10px;border:0;border-radius:10px;background:#a3583f;color:white;font-weight:700;padding:12px 16px;cursor:pointer}' +
    '.scope{margin:18px 0 0;padding:12px;border-radius:10px;background:#f4eee6;color:#655a53;font-size:12px;line-height:1.5}.error{margin:0 0 14px;padding:10px 12px;border-radius:9px;background:#fff0ed;color:#9b3d2d;font-size:13px}' +
    '</style></head><body><main class="card">' +
    '<div class="brand"><span class="mark">✉</span><div><h1>Connect Yuki Mail</h1><p class="tag">A quiet place for your letters.</p></div></div>' +
    '<p class="copy">Sign in with your Yuki Mail administrator account to allow ChatGPT read-only access to <strong>' +
    escapeHtml(env.MCP_MAILBOX) +
    "</strong>.</p>" +
    errorHtml +
    '<form method="post" action="/oauth/authorize">' +
    hiddenInputs +
    '<label>Email<input class="input readonly" name="email" value="' +
    escapeHtml(env.MCP_MAILBOX) +
    '" readonly autocomplete="username"></label>' +
    '<label>Password<input class="input" type="password" name="password" required autocomplete="current-password"></label>' +
    '<button class="button" type="submit">Connect to ChatGPT</button></form>' +
    '<div class="scope"><strong>Permission:</strong> read messages, search mail, read verification codes, and preview attachments. Sending, deleting, and creating mailboxes are not available in this V1 connection.</div>' +
    "</main></body></html>";

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "x-frame-options": "DENY",
      "content-security-policy":
        "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function constantTimeStringEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < maxLength; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function hashYukiPassword(password: string, salt: string) {
  const digest = new Uint8Array(
    await crypto.subtle.digest("SHA-256", TEXT.encode(salt + password)),
  );
  let binary = "";
  for (const byte of digest) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function verifyYukiCredentials(env: OAuthEnv, email: string, password: string) {
  if (!email || email.toLowerCase() !== env.MCP_MAILBOX.toLowerCase() || !password) return false;

  const user = await env.DB.prepare(`
    SELECT password, salt, status, is_del AS isDel
    FROM user
    WHERE LOWER(email) = LOWER(?)
    LIMIT 1
  `).bind(env.MCP_MAILBOX).first<{
    password: string;
    salt: string;
    status: number;
    isDel: number;
  }>();

  if (!user || user.isDel !== 0 || user.status !== 0) return false;

  const candidate = await hashYukiPassword(password, user.salt);
  return constantTimeStringEqual(candidate, user.password);
}

async function authorizeGet(request: Request, env: OAuthEnv) {
  const params = validateAuthorize(new URL(request.url).searchParams);
  if ("error" in params) return oauthError(400, "invalid_request", params.error);
  return authPage(env, params);
}

async function authorizePost(request: Request, env: OAuthEnv) {
  const ip = request.headers.get("cf-connecting-ip") || "unknown";
  const failKey = "mcp:oauth:login-fail:" + ip;
  const failCount = Number((await env.AUTH_KV.get(failKey)) || "0");
  if (failCount >= 8) {
    return new Response("Too many failed sign-in attempts. Try again later.", {
      status: 429,
      headers: { "retry-after": "600", "cache-control": "no-store" },
    });
  }

  const form = await request.formData();
  await env.AUTH_KV.put("mcp:diag:last-auth-stage", "form-parsed", { expirationTtl: 300 });
  const paramsMap = new URLSearchParams();
  [
    "response_type",
    "client_id",
    "redirect_uri",
    "state",
    "code_challenge",
    "code_challenge_method",
    "scope",
    "resource",
  ].forEach(function (key) {
    paramsMap.set(key, String(form.get(key) || ""));
  });

  const params = validateAuthorize(paramsMap);
  if ("error" in params) return oauthError(400, "invalid_request", params.error);

  const email = String(form.get("email") || "");
  const password = String(form.get("password") || "");
  await env.AUTH_KV.put("mcp:diag:last-auth-stage", "before-verify", { expirationTtl: 300 });
  if (!(await verifyYukiCredentials(env, email, password))) {
    await env.AUTH_KV.put(failKey, String(failCount + 1), { expirationTtl: 600 });
    return authPage(env, params, "Invalid Yuki Mail credentials.");
  }

  await env.AUTH_KV.put("mcp:diag:last-auth-stage", "verified", { expirationTtl: 300 });
  await env.AUTH_KV.delete(failKey);

  const now = Math.floor(Date.now() / 1000);
  const code = await sign(
    {
      typ: "code",
      iss: ISSUER,
      aud: RESOURCE,
      sub: env.MCP_MAILBOX,
      scope: params.scope,
      client_id: params.clientId,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
      iat: now,
      exp: now + CODE_TTL_SECONDS,
      jti: crypto.randomUUID(),
    },
    env.OAUTH_SIGNING_SECRET,
  );

  await env.AUTH_KV.put("mcp:diag:last-auth-stage", "signed", { expirationTtl: 300 });
  const redirect = new URL(params.redirectUri);
  redirect.searchParams.set("code", code);
  redirect.searchParams.set("state", params.state);
  redirect.searchParams.set("iss", ISSUER);
  await env.AUTH_KV.put("mcp:diag:last-auth-stage", "redirect-ready", { expirationTtl: 300 });
  return new Response(null, {
    status: 303,
    headers: {
      location: redirect.toString(),
      "cache-control": "no-store",
      pragma: "no-cache",
    },
  });
}

async function issueTokens(env: OAuthEnv, source: SignedPayload) {
  const now = Math.floor(Date.now() / 1000);
  const accessToken = await sign(
    {
      typ: "access",
      iss: ISSUER,
      aud: RESOURCE,
      sub: env.MCP_MAILBOX,
      scope: MAIL_SCOPE,
      client_id: source.client_id,
      iat: now,
      exp: now + ACCESS_TTL_SECONDS,
      jti: crypto.randomUUID(),
    },
    env.OAUTH_SIGNING_SECRET,
  );
  const refreshToken = await sign(
    {
      typ: "refresh",
      iss: ISSUER,
      aud: RESOURCE,
      sub: env.MCP_MAILBOX,
      scope: MAIL_SCOPE,
      client_id: source.client_id,
      iat: now,
      exp: now + REFRESH_TTL_SECONDS,
      jti: crypto.randomUUID(),
    },
    env.OAUTH_SIGNING_SECRET,
  );
  return {
    access_token: accessToken,
    token_type: "Bearer",
    expires_in: ACCESS_TTL_SECONDS,
    refresh_token: refreshToken,
    scope: MAIL_SCOPE,
  };
}

async function token(request: Request, env: OAuthEnv) {
  await env.AUTH_KV.put("mcp:diag:last-token-stage", "token-request-received", { expirationTtl: 300 });
  const form = await request.formData();
  const grantType = String(form.get("grant_type") || "");
  const clientId = String(form.get("client_id") || "");
  const resource = String(form.get("resource") || RESOURCE);
  await env.AUTH_KV.put(
    "mcp:diag:last-token-stage",
    "parsed:" + (grantType || "missing-grant") + ":" + (clientId ? "client-present" : "client-missing"),
    { expirationTtl: 300 },
  );

  if (resource !== RESOURCE) return oauthError(400, "invalid_target", "Invalid MCP resource");

  if (grantType === "authorization_code") {
    const code = String(form.get("code") || "");
    const redirectUri = String(form.get("redirect_uri") || "");
    const verifier = String(form.get("code_verifier") || "");
    const payload = await verify(code, env.OAUTH_SIGNING_SECRET);

    if (
      !payload ||
      payload.typ !== "code" ||
      payload.iss !== ISSUER ||
      payload.aud !== RESOURCE ||
      payload.sub.toLowerCase() !== env.MCP_MAILBOX.toLowerCase() ||
      payload.client_id !== clientId ||
      payload.redirect_uri !== redirectUri ||
      !payload.code_challenge ||
      clientId !== CHATGPT_CLIENT_ID ||
      redirectUri !== CHATGPT_REDIRECT_URI
    ) {
      await env.AUTH_KV.put("mcp:diag:last-token-stage", "authorization-code-invalid", { expirationTtl: 300 });
      return oauthError(400, "invalid_grant", "Authorization code is invalid or expired");
    }

    const usedKey = "mcp:oauth:used-code:" + payload.jti;
    if (await env.AUTH_KV.get(usedKey)) {
      return oauthError(400, "invalid_grant", "Authorization code has already been used");
    }
    if (!verifier || (await pkceS256(verifier)) !== payload.code_challenge) {
      await env.AUTH_KV.put("mcp:diag:last-token-stage", "pkce-failed", { expirationTtl: 300 });
      return oauthError(400, "invalid_grant", "PKCE verification failed");
    }

    await env.AUTH_KV.put(usedKey, "1", { expirationTtl: CODE_TTL_SECONDS + 60 });
    await env.AUTH_KV.put("mcp:diag:last-token-stage", "authorization-code-success", { expirationTtl: 300 });
    return Response.json(await issueTokens(env, payload), {
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
  }

  if (grantType === "refresh_token") {
    const payload = await verify(String(form.get("refresh_token") || ""), env.OAUTH_SIGNING_SECRET);
    if (
      !payload ||
      payload.typ !== "refresh" ||
      payload.iss !== ISSUER ||
      payload.aud !== RESOURCE ||
      payload.sub.toLowerCase() !== env.MCP_MAILBOX.toLowerCase() ||
      payload.scope !== MAIL_SCOPE ||
      payload.client_id !== clientId
    ) {
      return oauthError(400, "invalid_grant", "Refresh token is invalid or expired");
    }

    return Response.json(await issueTokens(env, payload), {
      headers: { "cache-control": "no-store", pragma: "no-cache" },
    });
  }

  return oauthError(400, "unsupported_grant_type", "Unsupported grant type");
}

export async function authenticateMcpRequest(request: Request, env: OAuthEnv) {
  const value = bearer(request);
  if (!value) return false;
  const payload = await verify(value, env.OAUTH_SIGNING_SECRET);
  return Boolean(
    payload &&
      payload.typ === "access" &&
      payload.iss === ISSUER &&
      payload.aud === RESOURCE &&
      payload.sub.toLowerCase() === env.MCP_MAILBOX.toLowerCase() &&
      payload.scope.split(/\s+/).includes(MAIL_SCOPE),
  );
}

export async function handleOAuthRequest(
  request: Request,
  env: OAuthEnv,
): Promise<Response | null> {
  const url = new URL(request.url);

  if (
    url.pathname === "/.well-known/oauth-authorization-server" ||
    url.pathname === "/.well-known/openid-configuration"
  ) {
    return Response.json(authServerMetadata(), {
      headers: { "cache-control": "public, max-age=300" },
    });
  }

  if (url.pathname === "/.well-known/oauth-protected-resource") {
    return Response.json(resourceMetadata(), {
      headers: { "cache-control": "public, max-age=300" },
    });
  }

  if (url.pathname === "/oauth/authorize") {
    if (request.method === "GET") return authorizeGet(request, env);
    if (request.method === "POST") return authorizePost(request, env);
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (url.pathname === "/oauth/token") {
    if (request.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
    return token(request, env);
  }

  return null;
}
