import 'server-only';

import { auth } from '@clerk/nextjs/server';

/**
 * The signed-in user's stable id (Clerk `userId`, e.g. `user_2abc…`), or null.
 * Single place every server route/action asks "who is calling?".
 */
export async function getUserId(): Promise<string | null> {
  // Enabling Organizations in Clerk can leave new sessions 'pending' (a "choose an
  // organization" task). They are still fully authenticated users for AgentCorp, so
  // don't treat pending as signed out.
  const { userId } = await auth({ treatPendingAsSignedOut: false });
  return userId ?? null;
}
