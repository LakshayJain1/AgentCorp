'use client';

import SetupWizard from '@/components/SetupWizard';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useEffect } from 'react';
import { useAuthUser } from '@/hooks/useAuthUser';

const ORG_ID_RE = /^org_[a-f0-9]{32}$/;

export default function OnboardPage() {
  const router = useRouter();
  const isInitialized = useGameStore((s) => s.isInitialized);
  const { user, isLoading } = useAuthUser();

  useEffect(() => {
    if (isLoading || !user) return;

    // Arrived from an invitation email: once signed in, go straight to the
    // invited workspace instead of making them set up their own.
    const invite = new URLSearchParams(window.location.search).get('invite');
    if (invite && ORG_ID_RE.test(invite)) {
      router.replace(`/workspace?invite=${invite}`);
      return;
    }

    // Only leave once signed in — /workspace sends signed-out users back here,
    // so redirecting on isInitialized alone would loop.
    if (isInitialized) router.replace('/workspace');
  }, [isInitialized, isLoading, user, router]);

  return <SetupWizard />;
}
