'use client';

import SetupWizard from '@/components/SetupWizard';
import { useRouter } from 'next/navigation';
import { useGameStore } from '@/store/gameStore';
import { useEffect } from 'react';

export default function OnboardPage() {
  const router = useRouter();
  const isInitialized = useGameStore((s) => s.isInitialized);

  useEffect(() => {
    if (isInitialized) {
      router.replace('/workspace');
    }
  }, [isInitialized, router]);

  return <SetupWizard />;
}
