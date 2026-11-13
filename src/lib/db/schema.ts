import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/**
 * Server-authoritative workspace (org). The browser used to mint `orgId`
 * locally; integration tokens must be scoped to an id the client cannot invent.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerSub: text('owner_sub').notNull(),
    name: text('name').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('workspaces_owner_sub_idx').on(t.ownerSub)],
);

/**
 * Per-user, per-workspace, per-provider OAuth connection.
 *
 * Tokens are stored AES-256-GCM encrypted (base64url in `text` columns).
 * `text` rather than `bytea` because the Neon HTTP driver does not round-trip
 * Buffers consistently; the at-rest guarantee is identical.
 */
export const userIntegrations = pgTable(
  'user_integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id'),
    accessToken: text('access_token').notNull(),
    refreshToken: text('refresh_token'),
    tokenIv: text('token_iv').notNull(),
    tokenTag: text('token_tag').notNull(),
    refreshTokenIv: text('refresh_token_iv'),
    refreshTokenTag: text('refresh_token_tag'),
    keyVersion: integer('key_version').notNull(),
    scopes: text('scopes').array().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('user_integrations_owner_provider_idx').on(
      t.userId,
      t.workspaceId,
      t.provider,
    ),
    index('user_integrations_workspace_idx').on(t.workspaceId),
  ],
);

/**
 * Short-lived OAuth handshake state. Persisted (not cookie-only) so the
 * callback can be validated on any serverless instance.
 */
export const oauthStates = pgTable(
  'oauth_states',
  {
    state: text('state').primaryKey(),
    userId: text('user_id').notNull(),
    workspaceId: uuid('workspace_id').notNull(),
    provider: text('provider').notNull(),
    codeVerifier: text('code_verifier'),
    redirectTo: text('redirect_to'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('oauth_states_expires_idx').on(t.expiresAt)],
);

/**
 * Live org snapshots powering the invite "viewer". `ownerSub` is bound on first
 * write and enforced on every later write, so one user can never overwrite
 * another user's org. `clerkOrgId` links the Clerk Organization created for
 * invitations back to this org.
 */
export const orgSnapshots = pgTable(
  'org_snapshots',
  {
    orgId: text('org_id').primaryKey(),
    ownerSub: text('owner_sub').notNull(),
    snapshot: jsonb('snapshot').notNull(),
    clerkOrgId: text('clerk_org_id'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('org_snapshots_clerk_org_idx').on(t.clerkOrgId)],
);

export type Workspace = typeof workspaces.$inferSelect;
export type UserIntegration = typeof userIntegrations.$inferSelect;
export type OAuthState = typeof oauthStates.$inferSelect;
