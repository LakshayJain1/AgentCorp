import 'server-only';

import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { userIntegrations, type UserIntegration } from '@/lib/db/schema';
import { decrypt, encrypt, tokenAad } from './crypto';
import { getProvider } from './registry';
import type { OAuthTokens } from './providers/types';

/** Refresh this many milliseconds before expiry. */
const REFRESH_SKEW_MS = 60_000;

export interface ConnectionSummary {
  provider: string;
  accountId: string | null;
  scopes: string[];
  connectedAt: Date;
  expiresAt: Date | null;
}

function accessAad(row: Pick<UserIntegration, 'userId' | 'workspaceId' | 'provider'>): string {
  return tokenAad(row.userId, row.workspaceId, row.provider, 'access');
}

function refreshAad(row: Pick<UserIntegration, 'userId' | 'workspaceId' | 'provider'>): string {
  return tokenAad(row.userId, row.workspaceId, row.provider, 'refresh');
}

function decryptAccess(row: UserIntegration): string {
  return decrypt(
    {
      ciphertext: row.accessToken,
      iv: row.tokenIv,
      tag: row.tokenTag,
      keyVersion: row.keyVersion,
    },
    accessAad(row),
  );
}

function decryptRefresh(row: UserIntegration): string | null {
  if (!row.refreshToken) return null;
  if (!row.refreshTokenIv || !row.refreshTokenTag) return null;
  return decrypt(
    {
      ciphertext: row.refreshToken,
      iv: row.refreshTokenIv,
      tag: row.refreshTokenTag,
      keyVersion: row.keyVersion,
    },
    refreshAad(row),
  );
}

async function loadRow(
  userId: string,
  workspaceId: string,
  provider: string,
): Promise<UserIntegration | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.workspaceId, workspaceId),
        eq(userIntegrations.provider, provider),
        isNull(userIntegrations.revokedAt),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Persist (or replace) a connection. Only this module and `crypto.ts` ever
 * see plaintext tokens.
 */
export async function saveToken(
  userId: string,
  workspaceId: string,
  provider: string,
  tokens: OAuthTokens,
  opts?: { refresh?: boolean },
): Promise<void> {
  const db = getDb();
  const aad = { userId, workspaceId, provider };
  const access = encrypt(tokens.accessToken, accessAad(aad));
  const refresh = tokens.refreshToken
    ? encrypt(tokens.refreshToken, refreshAad(aad))
    : null;

  // Access and refresh tokens get independent IV/tag pairs (and distinct AAD
  // slots), so one can never be decrypted in place of the other.
  await db
    .insert(userIntegrations)
    .values({
      userId,
      workspaceId,
      provider,
      providerAccountId: tokens.accountId ?? null,
      accessToken: access.ciphertext,
      refreshToken: refresh?.ciphertext ?? null,
      tokenIv: access.iv,
      tokenTag: access.tag,
      refreshTokenIv: refresh?.iv ?? null,
      refreshTokenTag: refresh?.tag ?? null,
      keyVersion: access.keyVersion,
      scopes: tokens.scopes,
      expiresAt: tokens.expiresAt ?? null,
    })
    .onConflictDoUpdate({
      target: [
        userIntegrations.userId,
        userIntegrations.workspaceId,
        userIntegrations.provider,
      ],
      set: {
        providerAccountId: tokens.accountId ?? null,
        accessToken: access.ciphertext,
        refreshToken: refresh?.ciphertext ?? null,
        tokenIv: access.iv,
        tokenTag: access.tag,
        refreshTokenIv: refresh?.iv ?? null,
        refreshTokenTag: refresh?.tag ?? null,
        keyVersion: access.keyVersion,
        scopes: tokens.scopes,
        expiresAt: tokens.expiresAt ?? null,
        lastRefreshedAt: new Date(),
        // A refresh must not look like a fresh connection.
        ...(opts?.refresh ? {} : { connectedAt: new Date() }),
        revokedAt: null,
      },
    });
}

async function markRevoked(id: string): Promise<void> {
  const db = getDb();
  await db
    .update(userIntegrations)
    .set({
      revokedAt: new Date(),
      accessToken: '',
      refreshToken: null,
      tokenIv: '',
      tokenTag: '',
      refreshTokenIv: null,
      refreshTokenTag: null,
    })
    .where(eq(userIntegrations.id, id));
}

/**
 * Return a usable access token, refreshing inline when it is within the skew
 * window. Returns null when the provider is not connected or can no longer be
 * refreshed — callers translate that to a 409.
 */
export async function getToken(
  userId: string,
  workspaceId: string,
  provider: string,
): Promise<string | null> {
  const adapter = getProvider(provider);
  if (!adapter) return null;

  let row = await loadRow(userId, workspaceId, provider);
  if (!row) return null;

  const expiringSoon =
    row.expiresAt !== null && row.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS;

  if (!expiringSoon) {
    try {
      return decryptAccess(row);
    } catch {
      await markRevoked(row.id);
      return null;
    }
  }

  const plainRefreshToken = (() => {
    try {
      return decryptRefresh(row);
    } catch {
      return null;
    }
  })();

  const refreshCiphertext = row.refreshToken;
  if (!plainRefreshToken || !refreshCiphertext || !adapter.refresh) {
    await markRevoked(row.id);
    return null;
  }

  // Claim the refresh: nulling the ciphertext is atomic, so only one
  // serverless instance can rotate a given token (GitHub/Linear rotate them).
  const db = getDb();
  const claimed = await db
    .update(userIntegrations)
    .set({ refreshToken: null })
    .where(
      and(
        eq(userIntegrations.id, row.id),
        eq(userIntegrations.refreshToken, refreshCiphertext),
      ),
    )
    .returning({ id: userIntegrations.id });

  if (claimed.length === 0) {
    // Another request is refreshing; re-read once and use its result if ready.
    row = await loadRow(userId, workspaceId, provider);
    if (!row) return null;
    if (row.expiresAt && row.expiresAt.getTime() - Date.now() < REFRESH_SKEW_MS) {
      return null;
    }
    try {
      return decryptAccess(row);
    } catch {
      return null;
    }
  }

  try {
    const refreshed = await adapter.refresh(plainRefreshToken);
    await saveToken(
      userId,
      workspaceId,
      provider,
      {
        ...refreshed,
        accountId: refreshed.accountId ?? row.providerAccountId,
        scopes: refreshed.scopes.length > 0 ? refreshed.scopes : row.scopes,
      },
      { refresh: true },
    );
    return refreshed.accessToken;
  } catch {
    await markRevoked(row.id);
    return null;
  }
}

export async function listConnected(
  userId: string,
  workspaceId: string,
): Promise<ConnectionSummary[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.workspaceId, workspaceId),
        isNull(userIntegrations.revokedAt),
      ),
    );

  return rows.map((row) => ({
    provider: row.provider,
    accountId: row.providerAccountId,
    scopes: row.scopes,
    connectedAt: row.connectedAt,
    expiresAt: row.expiresAt,
  }));
}

/** Revoke at the provider (best effort) and wipe local ciphertext. */
export async function deleteToken(
  userId: string,
  workspaceId: string,
  provider: string,
): Promise<boolean> {
  const row = await loadRow(userId, workspaceId, provider);
  if (!row) return false;

  const adapter = getProvider(provider);
  if (adapter?.revoke) {
    try {
      await adapter.revoke(decryptAccess(row));
    } catch {
      // Provider unreachable or token already dead — still wipe locally.
    }
  }

  await markRevoked(row.id);
  return true;
}
