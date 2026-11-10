import 'server-only';

import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { workspaces } from '@/lib/db/schema';

/**
 * Resolve (or lazily create) the workspace owned by an Auth0 subject.
 * The id is server-generated; the browser may cache it but can never mint it.
 */
export async function resolveWorkspace(userId: string, name?: string): Promise<string> {
  const db = getDb();

  const existing = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerSub, userId))
    .limit(1);
  if (existing[0]) return existing[0].id;

  const inserted = await db
    .insert(workspaces)
    .values({ ownerSub: userId, name: name?.trim() || 'My workspace' })
    .onConflictDoNothing({ target: workspaces.ownerSub })
    .returning({ id: workspaces.id });
  if (inserted[0]) return inserted[0].id;

  // Lost an insert race — the winner's row is now visible.
  const raced = await db
    .select({ id: workspaces.id })
    .from(workspaces)
    .where(eq(workspaces.ownerSub, userId))
    .limit(1);
  if (!raced[0]) throw new Error('workspace could not be resolved');
  return raced[0].id;
}
