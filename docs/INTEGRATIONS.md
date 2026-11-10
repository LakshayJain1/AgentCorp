# Integrations: OAuth + encrypted token storage

Per-user provider connections for GitHub (Slack and Linear follow the same
pattern). Tokens are exchanged, encrypted, and used **only** on the server.

## How it works

```
browser ──GET /api/oauth/github/start──▶ server
                                          │  create state + PKCE verifier
                                          │  store state row (DB) + httpOnly cookie
                                          ▼
                                     github.com/login/oauth/authorize
                                          │  user consents
                                          ▼
browser ──GET /api/oauth/github/callback─▶ server
                                          │  verify cookie + state row + user
                                          │  exchange code → access/refresh token
                                          │  AES-256-GCM encrypt → Postgres
                                          ▼
                                    /workspace?integration=connected
```

Credentialed API calls then resolve the caller's token server-side:

```
GET /api/github/file  →  requireIntegration('github')
                          ├─ auth0.getSession()        (who)
                          ├─ resolveWorkspace(sub)     (server-owned workspace id)
                          ├─ getToken(...)             (decrypt / refresh inline)
                          └─ readRepoFile(token, ...)  (token never leaves server)
```

## Setup

### 0. Base URL

`APP_BASE_URL` is the public origin used to build every OAuth redirect URI.

- Local: `APP_BASE_URL=http://localhost:3000` (`.env.local`)
- Production: `APP_BASE_URL=https://agent-corp.vercel.app` (`.env`)

Each provider must have the exact callback URL registered
(`<APP_BASE_URL>/api/oauth/<provider>/callback`). GitHub OAuth Apps allow one
callback URL per app, so **dev and production each get their own GitHub app**:

| Environment | `.env` file | `APP_BASE_URL` | GitHub app |
| --- | --- | --- | --- |
| Local | `.env.local` | `http://localhost:3000` | `AgentCorp Dev` |
| Production | `.env` | `https://agent-corp.vercel.app` | `AgentCorp` |

Slack and Linear allow multiple redirect URLs on one app, so the same app
serves both environments.

### 1. Database (Neon)

Create a Neon project and copy the **pooled** connection string into
`DATABASE_URL` (include `?sslmode=require`).

```bash
pnpm db:generate   # regenerate SQL after schema edits
pnpm db:migrate    # apply drizzle/ to the database
```

The initial migration lives in `drizzle/` and creates `workspaces`,
`user_integrations`, and `oauth_states`.

### 2. Encryption key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Put it in `TOKEN_ENCRYPTION_KEY` (and optionally
`TOKEN_ENCRYPTION_KEY_VERSION`, default `1`).

**Rotation:** set `TOKEN_ENCRYPTION_KEYS` to a JSON map of
`{"1":"<old base64>","2":"<new base64>"}` and bump
`TOKEN_ENCRYPTION_KEY_VERSION=2`. Old rows stay readable via their stored
`key_version`; re-encrypt or let them rotate on next refresh, then drop the old
key.

### 3. Providers

**GitHub** — Settings → Developer settings → OAuth Apps → New OAuth App.

- Homepage URL: `APP_BASE_URL`
- Authorization callback URL: `<APP_BASE_URL>/api/oauth/github/callback`
- Enable **Expire user access tokens** (issues 8h tokens + refresh tokens)

**Slack** — on hold. The `slack_post_message` tool is registered and ready; only
the OAuth app credentials are missing. Resume by creating a Slack app
(api.slack.com/apps) with redirect URLs
`<APP_BASE_URL>/api/oauth/slack/callback` and bot scopes `chat:write`,
`channels:read`, then set `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`.

**Linear** — linear.app/settings/api/applications → New OAuth application.

- Callback URL: `<APP_BASE_URL>/api/oauth/linear/callback`
- Scopes: `read`, `write`
- Tokens are app-actor tokens (`actor=app`) and expire after 24h; the refresh
  token is rotated automatically.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/oauth/[provider]/start` | Create state, redirect to provider |
| `GET` | `/api/oauth/[provider]/callback` | Verify state, exchange, encrypt, store |
| `GET` | `/api/integrations` | Connection summaries + available providers |
| `DELETE` | `/api/integrations?provider=github` | Revoke at provider, wipe locally |
| `POST` | `/api/tools/execute` | Run `slack_post_message` / `linear_create_issue` |

`/api/integrations` never returns token material, not even masked. The tool
gateway returns only the provider's textual result.

## Security properties

- **Encryption:** AES-256-GCM, 12-byte random IV, per-token auth tag.
- **AAD:** `${userId}:${workspaceId}:${provider}:${access|refresh}` — a copied
  row cannot be replayed for another user, workspace, provider, or slot.
- **Workspace ids are server-minted.** The browser can no longer invent an
  `orgId` that scopes tokens.
- **Refresh is single-flight.** The refresh ciphertext is atomically nulled
  (`UPDATE … WHERE refresh_token = $old`) before rotating, so two serverless
  instances cannot invalidate each other's rotated token.
- **State is single-use** and bound to the Auth0 subject; a cookie provides
  defence in depth.
- **No tokens in Zustand, localStorage, responses, or logs.**

## Not yet wired

- Vercel, Notion, Supabase, Railway, Discord, and Jira still show as "coming
  soon"; they have no OAuth adapter yet.
- Model-driven function calling: agents call tools through `ToolRegistry`, but
  the LLM does not yet choose tools itself (`/api/ai` is unchanged).
- AI BYOK keys are still desktop-only (Electron secure storage), not part of
  the server integration store.
