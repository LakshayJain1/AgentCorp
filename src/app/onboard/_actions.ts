'use server';

import { auth0 } from '@/lib/auth0';

// Onboarding completion is tracked in Zustand (localStorage) on the client.
// This server action just validates the user is authenticated and returns
// their identity — no external metadata API call needed.
export async function completeOnboarding(formData: {
  companyName: string;
  companyProduct: string;
  developersCount: number;
}) {
  const session = await auth0.getSession();
  if (!session?.user?.sub) {
    return { error: 'Not authenticated' };
  }
  // Intentionally a no-op beyond auth check: the game store's
  // initializePersonalizedOffice + Zustand persist handles all state.
  console.log('[Auth0] Onboarding completed for', session.user.sub, formData);
  return { success: true };
}

// Keep old name so SetupWizard.tsx import doesn't break during transition.
export const completeClerkOnboarding = completeOnboarding;
