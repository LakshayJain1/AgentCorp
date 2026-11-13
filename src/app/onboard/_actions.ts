'use server';

import { getUserId } from '@/lib/session';

// Onboarding completion is tracked in Zustand (localStorage) on the client.
// This server action just validates the user is authenticated — no external
// metadata API call needed.
export async function completeOnboarding(formData: {
  companyName: string;
  companyProduct: string;
  developersCount: number;
}) {
  const userId = await getUserId();
  if (!userId) {
    return { error: 'Not authenticated' };
  }
  // Intentionally a no-op beyond auth check: the game store's
  // initializePersonalizedOffice + Zustand persist handles all state.
  console.log('[Onboarding] completed for', userId, formData.companyName);
  return { success: true };
}
